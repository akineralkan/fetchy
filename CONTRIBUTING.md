# Contributing to Fetchy

Thank you for your interest in contributing to **Fetchy** — a privacy-focused, self-hosted REST API client. This document outlines how you can participate, whether by reporting issues, requesting features, or contributing code.

---

## Table of Contents

- [AI-Driven Development](#ai-driven-development)
- [Understanding the Codebase](#understanding-the-codebase)
- [Demands / Feature Requests](#demands--feature-requests)
- [Bug Reports](#bug-reports)
- [Contributing Code](#contributing-code)
- [Feature Branch Requirements](#feature-branch-requirements)
- [Branching Strategy](#branching-strategy)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Pull Requests](#pull-requests)

---

## AI-Driven Development

> **Important:** Contributors are not expected to write code manually.

Fetchy is an **AI-native project**. All contributors are expected to leverage AI coding agents throughout the entire development lifecycle — from planning and implementation to testing and documentation.

- Use AI agents such as **GitHub Copilot Agent**, **Copilot Edits**, or equivalent agentic tools for all development work.
- Let the AI agent handle code generation, refactoring, test writing, and documentation updates.
- Your role as a contributor is to **guide, review, and validate** the agent's output rather than write code by hand.
- Pull requests written entirely without AI assistance are not the expected workflow and may receive feedback asking you to adopt agentic tooling.
- If you are new to AI-assisted development, the [GitHub Copilot documentation](https://docs.github.com/en/copilot) is a good starting point.

---

## Understanding the Codebase

Before contributing, AI agents (and human contributors) should familiarize themselves with the project structure and conventions:

- **[AGENTS.md](AGENTS.md)** — Comprehensive guide for AI coding agents. Covers project structure, architecture, key concepts, coding conventions, and common tasks. **Start here** if you're new to the codebase.
- **[ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md)** — Technical assessment of the codebase including known issues and anti-patterns to avoid.
- **[ROADMAP.md](ROADMAP.md)** — Prioritized remediation checklist tracking completed and pending improvements.
- **[FEATURE_DEMANDS.md](FEATURE_DEMANDS.md)** — Product feature backlog for future development.

---

## Demands / Feature Requests

If you have an idea for a new feature or a demand for functionality that Fetchy doesn't currently support, open a GitHub Issue and tag it as **Demand**.

**Steps to submit a feature request:**

- Navigate to the [Issues](../../issues) tab of the repository.
- Click **New issue**.
- Give your issue a clear and descriptive title (e.g. `[Demand] Support OAuth 2.0 PKCE flow`).
- In the body, describe the problem you are trying to solve, the proposed feature, and any relevant context or examples.
- Click **Submit new issue**.
- After submitting, apply the **`Demand`** label from the *Labels* panel on the right side of the issue.
- If you do not have permission to set labels, a maintainer will apply the label during triage.

---

## Bug Reports

If you encounter unexpected behaviour, crashes, or incorrect output, open a GitHub Issue and tag it as **Bug**.

**Steps to submit a bug report:**

- Navigate to the [Issues](../../issues) tab of the repository.
- Click **New issue**.
- Give your issue a clear and descriptive title (e.g. `[Bug] Response body not displayed for 204 responses`).
- In the body, include the following information:
  - Steps to reproduce the issue.
  - Expected behaviour.
  - Actual behaviour.
  - Screenshots or error logs if applicable.
  - Your operating system and Fetchy version.
- Click **Submit new issue**.
- After submitting, apply the **`Bug`** label from the *Labels* panel on the right side of the issue.
- If you do not have permission to set labels, a maintainer will apply the label during triage.

---

## Contributing Code

Fetchy welcomes code contributions for new features, bug fixes, and improvements. All contributions must go through a branch and a pull request — **direct commits to `main` are strongly discouraged** (see [Branching Strategy](#branching-strategy)).

**Steps to contribute code:**

- Fork the repository by clicking the **Fork** button at the top of the repository page (if you are an external contributor).
- Clone your fork or the repository locally:
  ```bash
  git clone https://github.com/<your-username>/Fetchy.git
  cd Fetchy
  ```
- Install dependencies and verify the project builds:
  ```bash
  npm install
  npm run build
  npm test
  ```
- Create a new branch from the latest `main` following the [branch naming conventions](#branch-naming-conventions):
  ```bash
  git checkout main
  git pull origin main
  git checkout -b feat/your-feature-name
  ```
- Make your changes, keeping commits small and focused. Write or update tests where applicable.
- Ensure linting and tests pass before pushing:
  ```bash
  npm run lint
  npm test
  ```
- Push your branch and open a pull request against `main`:
  ```bash
  git push origin feat/your-feature-name
  ```
- On GitHub, navigate to the repository and click **Compare & pull request**.
- Fill in the pull request template: describe the change, reference the related issue (e.g. `Closes #42`), and note any testing done.
- Request a review from a maintainer.

---

## Feature Branch Requirements

Every `feat/` branch must satisfy **all three of the following** before a pull request can be merged:

- **Implementation** — The feature must be fully implemented and working. Keep the code focused on the scope of the feature and avoid bundling unrelated changes.
- **Tests** — New functionality must be covered by appropriate unit or integration tests. Existing tests must continue to pass (`npm test`).
- **Documentation** — User-facing features must include a corresponding documentation update in the `docs/` directory. If the feature changes an existing behaviour, the relevant documentation pages must be updated accordingly. Pull requests that introduce a new feature without documentation will not be merged.

> **In short:** code + tests + docs — all three, every time.

---

## Branching Strategy

Fetchy follows [**Trunk-Based Development**](https://trunkbaseddevelopment.com/) as its branching strategy.

- `main` is the trunk and should always be in a releasable state.
- Contributors work on **short-lived feature branches** that are merged back into `main` quickly.
- Long-running branches are discouraged; keep branches focused and merge them as soon as the work is complete and reviewed.
- **Do not push commits directly to `main`.** All changes must arrive via a pull request, regardless of how small.

---

## Branch Naming Conventions

Use one of the following prefixes when creating a branch:

| Prefix | Purpose | Example |
|---|---|---|
| `feat/` | New feature | `feat/add-graphql-support` |
| `bugfix/` | Bug fix | `bugfix/fix-null-response-body` |
| `improv/` | Improvement to existing functionality | `improv/response-panel-performance` |

Keep branch names lowercase, hyphen-separated, and descriptive enough to convey intent at a glance.

---

## Pull Requests

- Every pull request must target the `main` branch.
- A pull request should address a **single concern** — avoid bundling unrelated changes.
- Reference the related issue in the pull request description where applicable.
- Ensure all CI checks pass before requesting a review.
- At least one maintainer approval is required before merging.
- Squash or rebase before merging to keep the commit history on `main` clean and linear.

---

Thank you for helping make Fetchy better!
