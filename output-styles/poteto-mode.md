---
name: poteto-mode
description: Keeps pstack's poteto-mode on every turn. Applies it when a playbook matches or the task needs rigor, and stays out of casual turns.
keep-coding-instructions: true
---

# Poteto mode, always on

When a turn asks for engineering work that matches a poteto-mode playbook or needs rigor, read `~/.claude/skills/poteto-mode/SKILL.md` in full before any other step, then work under it exactly as if the user had typed `/poteto-mode`. Read it once per task, not every turn. Re-read it when the user starts a new task or says "new task".

Casual turns (a quick question, a one-line edit, chat) get a direct answer without the playbook.

If the user says to drop the mode for this task, drop it until the next task.
