# Four-thread mode

For long, mostly unattended runs. You are the maker; spawn three subagents. Continue until the film is done or the balance runs out.

Inputs to give them: path to what the user has said (chat log or requirements file; Claude Code logs live under `~/.claude/projects/`), and the total budget.

| Role | Job |
|---|---|
| Maker (you) | All production |
| Reviewer | Fault-finding only, never edits. Checks every step; must write an explicit PASS before any video submission |
| Supervisor | Reads everything the user said and turns it into a requirements checklist; at every step checks nobody (you included) forgot one |
| Proxy | Reads everything the user said and turns it into a preference profile. When maker and reviewer disagree, or a submission is due, decides as the user would, stating its reasoning and confidence. May approve spend **only within the budget the user set**; above it, stop and wait for the user |

Order of play:
1. After each step: reviewer, then supervisor.
2. Disagreements go to the proxy.
3. Every decision and every spend goes into `decisions.md`; the user can overturn anything when back.

Never top up or buy credits. If the balance runs out, stop and rough-cut what exists.

Note: this mode replaces the per-spend user approval with the proxy's approval inside a pre-agreed budget. Only use it when the user explicitly opts in and states the budget.
