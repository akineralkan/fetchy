---
description: 'Pantheon multi-agent system: agent roster, model defaults, task lifecycle, shared protocols, coordination file formats, and common constraints'
applyTo: '**/*.agent.md,**/.github/pantheon-temp/**,**/.github/pantheon-worklog/**'
---

# Pantheon Multi-Agent System

## Agent Roster & Model Defaults

All agents are invoked as subagents by **Zeus - Orchestrator** via `runSubagent`. Configuration is stored in `.github/pantheon-temp/session-model-config.md`.

| Step | Agent | Invocation Name | Default Model | Role |
|---|---|---|---|---|
| 1 | Zeus - Orchestrator | `Zeus-Orchestrator` | Claude Sonnet 4.6 (copilot) | Pipeline orchestration |
| 2 | Hermes - JiraRetriever | `Hermes-JiraRetriever` | Claude Haiku 4.5 (copilot) | Jira retrieval |
| 3 | Prometheus - Developer | `Prometheus-Developer` | Claude Sonnet 4.6 (copilot) | Full development & implementation |
| 4 | Themis - Test Engineer | `Themis-TestEngineer` | Claude Sonnet 4.6 (copilot) | Unit testing & QA |
| 5 | Charon - GitMaster | `Charon-GitMaster` | Claude Haiku 4.5 (copilot) | Git operations & MR creation |
| 6 | Metis - Reviewer | `Metis-Reviewer` | Claude Sonnet 4.6 (copilot) | AI review of MR & description update |
| 7 | Harmonia - Dashboard | `Harmonia-Dashboard` | Claude Haiku 4.5 (copilot) | Pantheon-Lens dashboard launcher & monitor |

---

## Task Status Lifecycle

```
RETRIEVED → TODO → IMPLEMENTING → IMPLEMENTED → TESTING → TESTED → PUSHING → PUSHED → REVIEWING → REVIEWED
              ↑                                          |
              └──────────── TODO ←─────────────┘ (on test failure)

- `RETRIEVED` is a `.github/pantheon-temp/jira-items.md` status. Task lifecycle is reflected in `.github/pantheon-temp/jira-items.md`.
- Intermediate states (`IMPLEMENTING`, `TESTING`, `PUSHING`, `REVIEWING`) indicate an agent is actively working on the task.
- Tasks can transition to `TODO` from `TESTING` if tests fail due to a production code issue.
- `PUSHED` means the branch is pushed and the MR/PR is created; `REVIEWED` means Metis has appended an AI Review to the MR description. Both still require human approval before merge.
- Task status transitions need not be strictly followed — Zeus can skip statuses as needed.

```

---

## Shared Skills (ALL AGENTS)

### Timestamp

All agents MUST use the `get-timestamp` skill to obtain the current time whenever a timestamp is required. Load the skill by reading `pantheon/skills/get-timestamp/SKILL.md` and follow its instructions. Never guess, hardcode, or infer a timestamp — always retrieve it from the terminal at the moment it is needed.

---

## Standard Workflow Pattern (ALL AGENTS)

All agents MUST follow this lifecycle:

1. Update Agent State → WORKING
2. Read agentic files such as `.github/pantheon-temp/communications.md`, `.github/pantheon-temp/key-decisions.md`, `.github/pantheon-temp/jira-items.md`
3. Do Agent specific work: The unique operations each agent performs.
4. Update Agent State → IDLE

---

## Granular Logging (ALL AGENTS)

All agents MUST log progress to `.github/pantheon-temp/communications.md` at **every meaningful sub-step** — not only at start and finish. This ensures real-time pipeline visibility and accurate dashboard monitoring.

**Required logging cadence per workflow step:**
- **Before starting** a step: `[Agent]: Starting [step name]...`
- **During** a step, for each meaningful sub-operation: `[Agent]: [Operation being performed] ([relevant detail])...`
- **After completing** a step: `[Agent]: [Step name] complete. [Outcome/result].`
- **On error, warning, or decision**: `[Agent]: [Error or decision encountered]. Action taken: [description].`

Never batch multiple sub-steps into a single log message — log each one separately and immediately when it occurs, always appended to `.github/pantheon-temp/communications.md`. Each entry MUST follow the standard format:

`[TIMESTAMP] [PROJECT-NAME] [TASK-ID] [Agent Name]: [Message]`

Agent-specific granular log examples are defined within each agent's workflow steps.

---

## Agent Constraints (ALL AGENTS)

All agents MUST follow these constraints:

1. **Sequential Workflow** — Complete all workflow steps in order. Never skip steps unless instructed by Zeus. Zeus may skip steps if instructed by the user. (Note: task *status* transitions may be skipped by Zeus; workflow *steps* may not be skipped by other agents.)
2. **No Cross-Agent Mutation** — Never alter the state or tasks of other agents.
3. **File Hygiene** — Keep coordination files clean. Adhere strictly to specified output formats. Always verify for duplicates before appending to any coordination file.
4. **Single Lock** — Lock only one task at a time. Always set an intermediate task lock state before starting work. Complete the full cycle before picking up the next.
5. **Scope Discipline** — Never perform work outside your declared role. Delegate by communicating needs.
6. **Single Instance** — One Zeus orchestrator per workspace. Running multiple Zeus instances concurrently is unsupported and may cause coordination file corruption.

---

## Coordination Files

All coordination files live under `.github/pantheon-temp/` (except `worklog.jsonl`, which is stored under `.github/pantheon-worklog/`):

| File | Purpose |
|---|---|
| `.github/pantheon-temp/agent-states.md` | Agent state tracker (`WORKING` / `IDLE`) |
| `.github/pantheon-temp/credentials.md` | Agent credentials storage (JIRA_EMAIL, JIRA_API_TOKEN etc.) |
| `.github/pantheon-temp/communications.md` | Inter-agent communication log |
| `.github/pantheon-temp/key-decisions.md` | Architectural decisions and tech debt |
| `.github/pantheon-temp/jira-items.md` | Retrieved Jira items |
| `.github/pantheon-worklog/worklog.jsonl` | Agent work log (JSONL, append-only) |
| `.github/pantheon-temp/session-model-config.md` | Per-agent model configuration |

### State Management Rules
- Each agent switches strictly between `WORKING` and `IDLE`.

---

## Coordination File Formats

### .github/pantheon-temp/communications.md

Each entry must include a timestamp, project name, and task ID:
`[TIMESTAMP] [PROJECT-NAME] [TASK-ID] [Agent Name]: [Message]`

Where `TIMESTAMP` is the current ISO 8601 UTC time, `PROJECT-NAME` is read from `.github/pantheon-temp/session-model-config.md`, and `TASK-ID` is the Jira task ID being worked on. For non-task communications (e.g., pipeline setup, dashboard operations), use `N/A` as the task ID.
When reading communications for context, filter by relevant task IDs.

### .github/pantheon-temp/agent-states.md

Each agent gets exactly one line:
```
[Agent Full Name]: [WORKING | IDLE]
```

Full agent list:
```
Zeus - Orchestrator: IDLE
Hermes - JiraRetriever: IDLE
Prometheus - Developer: IDLE
Themis - Test Engineer: IDLE
Charon - GitMaster: IDLE
Metis - Reviewer: IDLE
Harmonia - Dashboard: IDLE
```

### .github/pantheon-temp/key-decisions.md

```
[TIMESTAMP] [PROJECT-NAME] [Task ID] - [ARCHITECTURE | PATTERN | TRADE-OFF | DECISION | TECH DEBT | SCOPE | PRIORITY | EXCLUSION | TEST FINDING | RISK | LIMITATION | DEVOPS | INFRA | REVIEW]: [Brief, compact explanation].
```

### .github/pantheon-temp/jira-items.md

```markdown
## [ITEM-KEY]:
**Title** - [Summary]
**ProjectName:** [Project Name]
**Status:** [RETRIEVED → TODO → IMPLEMENTING → IMPLEMENTED → TESTING → TESTED → PUSHING → PUSHED → REVIEWING → REVIEWED]
**Link:** https://fdsone.atlassian.net/browse/[ITEM-KEY]
**Description:** [Full description]
**Timestamp:** [ISO 8601 UTC when item was retrieved]
```

### .github/pantheon-temp/session-model-config.md

```markdown
# Agent Model Configuration
**ProjectName:** [Project Name]
| Agent | Model |
|---|---|
| Zeus - Orchestrator | Claude Sonnet 4.6 (copilot) |
| Hermes - JiraRetriever | Claude Haiku 4.5 (copilot) |
| Prometheus - Developer | Claude Sonnet 4.6 (copilot) |
| Themis - Test Engineer | Claude Sonnet 4.6 (copilot) |
| Charon - GitMaster | Claude Haiku 4.5 (copilot) |
| Metis - Reviewer | Claude Sonnet 4.6 (copilot) |
| Harmonia - Dashboard | Claude Haiku 4.5 (copilot) |
```

**Lifecycle:** Created by Zeus during first-cycle setup. Includes `ProjectName` used by all agents when writing to coordination files. Persists for the session duration. Can be edited by the user mid-session to change agent models or project name. Zeus re-reads this file before each subagent invocation.

### .github/pantheon-worklog/worklog.jsonl

One JSON object per line, append-only:
```json
{"projectName":"<Project Name>","timestamp":"<ISO8601_UTC>","agent":"<Full Agent Name>","model":"<Model Used>","contextSize":"<Total Character Count for context size>","totalInputOutputSize":"<Total Character Count for input and output for agent run session>","duration":"<Working Time>","workingTaskId":["<JiraTaskId>"],"topic":"<Summary>","status":"<success|partial|blocked|failed>"}
```

| Field | Rule |
|---|---|
| `projectName` | Project name read from `session-model-config.md` |
| `timestamp` | ISO 8601 UTC at IDLE transition |
| `agent` | Full display name (e.g., `"Prometheus - Developer"`) |
| `model` | LLM model used for this invocation |
| `contextSize` | Total character count for context size |
| `totalInputOutputSize` | Total character count for input and output for agent run session |
| `duration` | Wall-clock time from WORKING to IDLE |
| `workingTaskId` | Array of Task IDs being worked on. Empty `[]` for non-task work (Hermes). |
| `status` | `success` \| `partial` \| `blocked` \| `failed` |

**Ownership:** Every agent is responsible for writing its own worklog entry at the end of its run session (just before setting state to `IDLE`). Zeus does not manage worklog entries on behalf of other agents; Zeus only appends its own entry.

**File rules:**
- If `.github/pantheon-worklog/worklog.jsonl` does not exist, create it as an empty file.
- Never delete or modify existing log entries.
- One JSON line per agent per invocation.
