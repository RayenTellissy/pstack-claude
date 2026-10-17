#!/usr/bin/env node
// Reports upstream pstack changes since the commit in scripts/upstream.json,
// mapped to this port's paths. Porting them is done by hand.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const USAGE = `Usage: node scripts/check-upstream.mjs [--markdown] [--diff [path]] [--done <commit>]

Lists the upstream pstack commits and files changed since the commit in
scripts/upstream.json. Exits 0 when up to date and 1 when there is
something to port.

  --markdown       Print the report as Markdown with GitHub links.
  --diff [path]    Print the upstream diff for one file (port or upstream
                   path), or for all of pstack.
  --done <commit>  After porting, record <commit> as the last synced one.`;

// Upstream paths, relative to the upstream directory, that the port leaves out.
const SKIPPED = [
  [".cursor-plugin/", "Cursor plugin manifest"],
  ["plugin.json", "Cursor plugin manifest"],
  ["assets/", "Cursor marketplace assets"],
  ["automations/", "Cursor automations"],
  ["docs/harness/", "upstream's harness adapters"],
  ["skills/make-bot-ui/", "needs Cursor's bot UI"],
  ["skills/poteto-mode/scripts/bun.lock", "the port uses package-lock.json"],
];

// Upstream paths that live somewhere else in the port.
const MOVED = [
  ["README.md", "pstack/README.md"],
  ["LICENSE", "pstack/LICENSE"],
  ["docs/", "pstack/docs/"],
  [
    "skills/poteto-mode/references/bugbot-triage.md",
    "skills/poteto-mode/references/review-bot-triage.md",
  ],
];

// The folders the install copies into ~/.claude.
const INSTALLED = ["skills/", "agents/", "output-styles/", "pstack/"];

const statePath = join(import.meta.dirname, "upstream.json");

class UsageError extends Error {}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function matchesPrefix(path, prefix) {
  return prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix;
}

function mapPath(path) {
  for (const [prefix, reason] of SKIPPED) {
    if (matchesPrefix(path, prefix)) return { skip: reason };
  }
  for (const [from, to] of MOVED) {
    if (matchesPrefix(path, from)) return { portPath: to + path.slice(from.length) };
  }
  return { portPath: path };
}

function upstreamCache(repository) {
  const cache =
    process.env.PSTACK_UPSTREAM_CACHE ??
    join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "pstack-claude", "upstream");
  if (!existsSync(join(cache, ".git"))) {
    mkdirSync(dirname(cache), { recursive: true });
    git(["clone", "--quiet", "--filter=blob:none", "--no-checkout", repository, cache]);
  }
  return cache;
}

function upstreamVersion(cache, commit, directory) {
  try {
    return JSON.parse(git(["show", `${commit}:${directory}/.cursor-plugin/plugin.json`], cache)).version;
  } catch {
    return commit.slice(0, 12);
  }
}

function isAncestor(cache, ancestor, commit) {
  return spawnSync("git", ["merge-base", "--is-ancestor", ancestor, commit], { cwd: cache }).status === 0;
}

function lineCounts(cache, base, tip, directory) {
  const counts = new Map();
  const tokens = git(["diff", "--numstat", "-M", "-z", base, tip, "--", directory], cache).split("\0");
  for (let index = 0; index < tokens.length; index += 1) {
    if (!tokens[index]) continue;
    const [added, removed, path] = tokens[index].split("\t");
    if (path === "") {
      counts.set(tokens[index + 2], { added, removed });
      index += 2;
    } else {
      counts.set(path, { added, removed });
    }
  }
  return counts;
}

function changedFiles(cache, base, tip, directory) {
  const counts = lineCounts(cache, base, tip, directory);
  const tokens = git(["diff", "--name-status", "-M", "-z", base, tip, "--", directory], cache)
    .split("\0")
    .filter(Boolean);
  const files = [];
  for (let index = 0; index < tokens.length; ) {
    const kind = tokens[index][0];
    const renamed = kind === "R" || kind === "C";
    const oldUpstreamPath = renamed ? tokens[index + 1] : null;
    const upstreamPath = renamed ? tokens[index + 2] : tokens[index + 1];
    index += renamed ? 3 : 2;

    const path = upstreamPath.slice(directory.length + 1);
    const oldPath = oldUpstreamPath?.slice(directory.length + 1) ?? null;
    files.push({
      kind: renamed ? "R" : kind === "T" ? "M" : kind,
      upstreamPath,
      oldUpstreamPath,
      path,
      oldPath,
      ...mapPath(path),
      oldPortPath: oldPath ? mapPath(oldPath).portPath ?? oldPath : null,
      ...(counts.get(upstreamPath) ?? { added: "-", removed: "-" }),
    });
  }
  return files;
}

function describeLines({ kind, added, removed }) {
  if (added === "-") return "binary";
  if (kind === "A") return `+${added}`;
  if (kind === "D") return `-${removed}`;
  return `+${added} -${removed}`;
}

function outsideInstall(portPath) {
  return !INSTALLED.some((folder) => portPath.startsWith(folder));
}

function buildReport({ state, cache, base, tip, markdown }) {
  const repository = state.repository.replace(/\.git$/, "");
  const slug = new URL(repository).pathname.slice(1);
  const commits = git(["log", "--format=%H %s", `${base}..${tip}`, "--", state.directory], cache)
    .split("\n")
    .filter(Boolean)
    .map((line) => ({ sha: line.slice(0, 40), subject: line.slice(41) }));
  if (commits.length === 0) return null;

  const files = changedFiles(cache, base, tip, state.directory);
  const newVersion = upstreamVersion(cache, tip, state.directory);
  const code = (text) => (markdown ? `\`${text}\`` : text);
  const fileLink = (text, commit, upstreamPath) =>
    markdown ? `[${code(text)}](${repository}/blob/${commit}/${upstreamPath})` : text;
  const note = (portPath) => (outsideInstall(portPath) ? " (outside the installed folders: decide where it goes)" : "");

  const groups = [
    ["Changed", files.filter((file) => !file.skip && file.kind === "M"), (file) =>
      `${fileLink(file.portPath, tip, file.upstreamPath)}  ${describeLines(file)}`],
    ["Added", files.filter((file) => !file.skip && file.kind === "A"), (file) =>
      `${fileLink(file.portPath, tip, file.upstreamPath)}  ${describeLines(file)}${note(file.portPath)}`],
    ["Renamed", files.filter((file) => !file.skip && file.kind === "R"), (file) =>
      `${code(file.oldPortPath)} -> ${fileLink(file.portPath, tip, file.upstreamPath)}  ${describeLines(file)}${note(file.portPath)}`],
    ["Deleted", files.filter((file) => !file.skip && file.kind === "D"), (file) =>
      `${fileLink(file.portPath, base, file.upstreamPath)}  ${describeLines(file)}`],
    ["Skipped, not part of the port", files.filter((file) => file.skip), (file) =>
      `${code(`${state.directory}/${file.path}`)} (${file.skip})`],
  ];

  const lines = [];
  const heading = (level, text) => lines.push(markdown ? `${"#".repeat(level)} ${text}` : text);
  heading(2, `pstack ${state.version} -> ${newVersion}`);
  lines.push(
    "",
    `${commits.length} upstream commit${commits.length === 1 ? "" : "s"} changed ${files.length} pstack file${files.length === 1 ? "" : "s"} since the last sync.`,
    ""
  );
  heading(3, "Commits");
  for (const { sha, subject } of commits) {
    lines.push(
      markdown
        ? `- [${sha.slice(0, 7)}](${repository}/commit/${sha}) ${subject.replace(/(^|[^\w/])#(\d+)/g, `$1${slug}#$2`)}`
        : `  ${sha.slice(0, 7)} ${subject}`
    );
  }
  lines.push("");
  heading(3, "Files, by port path");
  for (const [title, members, render] of groups) {
    if (members.length === 0) continue;
    lines.push("", markdown ? `**${title} (${members.length})**` : `${title} (${members.length}):`);
    for (const file of members) lines.push(markdown ? `- ${render(file)}` : `  ${render(file)}`);
  }
  lines.push("");
  heading(3, "Porting");
  lines.push(
    `1. Read a file's upstream diff: ${code("node scripts/check-upstream.mjs --diff <path>")}`,
    "2. Port the change by hand.",
    `3. Record the sync: ${code(`node scripts/check-upstream.mjs --done ${tip.slice(0, 12)}`)}, then commit ${code("scripts/upstream.json")} with the port.`
  );
  return lines.join("\n");
}

function main() {
  const { values: options, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      markdown: { type: "boolean", default: false },
      diff: { type: "boolean", default: false },
      done: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const cache = upstreamCache(state.repository);
  git(["fetch", "--quiet", "--filter=blob:none", "origin", state.branch], cache);
  const tip = git(["rev-parse", "--verify", "FETCH_HEAD^{commit}"], cache).trim();
  const base = state.commit;
  if (!isAncestor(cache, base, tip)) {
    throw new UsageError(`Upstream ${state.branch} no longer contains the last synced commit ${base.slice(0, 12)}.`);
  }

  if (options.done) {
    const resolved = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${options.done}^{commit}`], {
      cwd: cache,
      encoding: "utf8",
    });
    if (resolved.status !== 0) throw new UsageError(`Unknown upstream commit ${options.done}.`);
    const commit = resolved.stdout.trim();
    if (!isAncestor(cache, base, commit) || !isAncestor(cache, commit, tip)) {
      throw new UsageError(`${options.done} is not on upstream ${state.branch} after ${base.slice(0, 12)}.`);
    }
    const version = upstreamVersion(cache, commit, state.directory);
    writeFileSync(statePath, `${JSON.stringify({ ...state, commit, version }, null, 2)}\n`);
    console.log(`Recorded pstack ${version} (${commit.slice(0, 12)}) as synced. Commit scripts/upstream.json with the port.`);
    return 0;
  }

  if (options.diff) {
    let paths = [state.directory];
    const wanted = positionals[0]?.replace(/^\.\//, "");
    if (wanted) {
      const file = changedFiles(cache, base, tip, state.directory).find((candidate) =>
        [candidate.portPath, candidate.oldPortPath, candidate.upstreamPath, candidate.oldUpstreamPath, candidate.path, candidate.oldPath].includes(wanted)
      );
      if (!file) throw new UsageError(`No upstream change since the last sync touches ${wanted}.`);
      paths = [file.oldUpstreamPath, file.upstreamPath].filter(Boolean);
    }
    const color = process.stdout.isTTY ? "--color=always" : "--no-color";
    process.stdout.write(git(["diff", color, "-M", base, tip, "--", ...paths], cache));
    return 0;
  }

  const report = buildReport({ state, cache, base, tip, markdown: options.markdown });
  if (report === null) {
    console.log(`Up to date with pstack ${state.version} (${state.repository.replace(/\.git$/, "")} ${base.slice(0, 12)}).`);
    return 0;
  }
  console.log(report);
  return 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof UsageError || error.status ? error.message : error);
  process.exitCode = 2;
}
