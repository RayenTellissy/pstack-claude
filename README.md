# pstack-claude

[pstack](https://github.com/cursor/plugins/tree/main/pstack), poteto's rigorous agent workflow skills, ported from Cursor to Claude Code.

The full README is [`pstack/README.md`](pstack/README.md). The walkthrough is the [pstack guide](pstack/docs/guide/README.md).

## Install

The top-level directories mirror `~/.claude/`. From the repo root, copy them in:

```bash
cp -R skills agents output-styles pstack ~/.claude/
```

Start a new Claude Code session, then run `/setup-pstack` to pick a reasoning budget, or skip it to keep the defaults. Use `/poteto-mode` at the start of any task that needs rigor. To keep it on every turn, run `/output-style poteto-mode`.

The poteto-mode scripts (`orch`, `watch-pr`) need [Node.js](https://nodejs.org) 22.18 or later.

## What changed from upstream

- Models. Fable takes judgment, prose, and the hardest changes. Opus takes the code, at `high` effort. Review panels run both. `/setup-pstack` writes `~/.claude/pstack/models.md`.
- Subagents. `Task` becomes the Agent tool. Read-only reviewers use the bundled `pstack-readonly` agent. Cloud agents become subagents in their own git worktree.
- Custom Mode becomes the `poteto-mode` output style.
- Skills that use other pstack skills read them by path (`~/.claude/skills/<name>/SKILL.md`). Every pstack skill but `setup-pstack` sets `disable-model-invocation`, so the Skill tool refuses them.
- Cursor-only dependencies map to Claude Code equivalents: `/simplify` for `/deslop`, browser automation or Bash with a PTY (`expect` or `script`) for the control skills, and skill-creator for `create-skill`.
- Not ported: the benny automations, `make-bot-ui`, and Origin. Bugbot triage covers review bots in general.

The first commit is the untouched upstream, so `git diff $(git rev-list --max-parents=0 HEAD) -M` shows the whole port.

## License

[MIT](LICENSE), copyright Lauren Tan.
