# Set up pstack

In this page you install pstack, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install pstack

The repository's top-level directories mirror `~/.claude/`. From the repository root, run:

```bash
cp -R skills agents output-styles pstack ~/.claude/
```

Then start a new Claude Code session, so it loads the new skills, agents, and output style. The poteto-mode scripts (`orch`, `watch-pr`) need `bun`. Nothing else needs it.

## Pick your models

Run:

```text
/setup-pstack
```

[`/setup-pstack`](../../../skills/setup-pstack/SKILL.md) asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels) with its model and effort, and asks what you want. pstack runs on two models, `fable` and `opus`. Answer the questions. It writes `~/.claude/pstack/models.md`, a small model config that pstack skills read each time they pick a model.

The defaults run at `xhigh` effort, except the code-writing roles at `high`. That is the `large` budget. `unlimited` lifts every role to `max`. `medium` and `small` lower the effort and spend fewer tokens.

You only override what you care about. A role with no line in the model config keeps the skill's default. To restore a default, delete that role's line. A rerun of `/setup-pstack` keeps any role whose model differs from the default. When a default changes, a config written before the change still pins the old default, so delete those role lines, or delete the file, then run `/setup-pstack` again.

You might be wondering how to run a role on your chat's own model. Set the role to `inherit` and pstack omits the subagent's `model` and `effort`, so the subagent runs on your parent session's model. `inherit` is not a model. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every `/swarm` worker unless a race names a model for each arm.

## Accept the verification offer, or don't

At the end of setup, `/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/create-verification-skill`](../../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.claude/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

After setup, the model config applies from the next subagent spawn, because skills read it each time they pick a model.

## Keep the cost in check

pstack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- Rerun `/setup-pstack` and pick a smaller reasoning budget.
- Set a role to `inherit` so it runs on the chat's own model.
- Shorten a panel list. Each entry runs one subagent.
- Save `/poteto-mode` for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the task list (`TaskCreate` and `TaskUpdate`, or `TodoWrite`). Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. To keep `/poteto-mode` on for the whole chat, switch to the `poteto-mode` output style:

```text
/output-style poteto-mode
```

That turns on the [`poteto-mode` output style](../../../output-styles/poteto-mode.md), which stays in context on every turn until you switch styles. [Claude Code's output style docs](https://code.claude.com/docs/en/output-styles) cover the other ways to switch. Plain `/poteto-mode` attaches the skill to one message, and it fades as the chat moves on.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).
