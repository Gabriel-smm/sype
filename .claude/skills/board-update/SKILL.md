---
name: board-update
description: Post a brief change note to the task's GitHub issue and SypeAI board item. Use at the end of every planning or reflect subagent run, or when a plan's scope changes.
---

1. Find the issue: from the branch name (`feature/<n>-…`) or `gh issue list --search "<topic>"`. None → `gh issue create --project "SypeAI"` first.
2. Write the note, 5 lines max:
   **[Plan|Reflect] update — <date>**
   - Changed: <one line>
   - Why: <one line>
   - Next: <next action + who (agent / Biel)>
   - Links: <plan file, PR, sub-issues>
3. Post it: `gh issue comment <n> --body-file note.md`
4. Board: move Status if it changed (`gh project item-edit`); new work → `gh issue create … --project "SypeAI"` (lands in Backlog).
5. Return the note text as your final message.

Rules: one note per run; link plans, never paste them; never close issues (merging the PR does that).
