---
id: jira-bug-reports
title: Guide — Creating Jira Bug Reports from AI Analysis
sidebar_label: Jira Bug Reports
sidebar_position: 5
description: Step-by-step guide to configuring Jira and creating your first bug report from an AI-generated analysis.
---

# Guide: Creating Jira Bug Reports from AI Analysis

This guide walks you through connecting Fetchy to your Jira instance and creating your first bug report from an AI-generated analysis.

---

## Goal

By the end of this guide you will have:

1. Connected Fetchy to your Jira instance
2. Mapped the required custom fields for your project
3. Created a Jira bug report directly from an AI bug analysis

---

## Prerequisites

- A Jira Server, Data Center, or Cloud instance
- A Personal Access Token (PAT) with issue-creation permissions
- A Jira project key where bugs should be created
- The AI Assistant configured with a working AI provider (see **Settings → AI**)

---

## Step 1 — Enable the Integration

1. Open **Settings** (gear icon or `Ctrl+,`)
2. Navigate to the **Integrations** tab
3. Toggle **Enable Jira Integration** on

---

## Step 2 — Enter Connection Details

1. **Jira Base URL** — Enter your Jira instance URL:
   ```
   https://your-company.atlassian.net
   ```
2. **Personal Access Token** — Paste your PAT (it will be encrypted and stored securely)
3. **Project Key** — Enter the target project (e.g., `WEBAPP`)

---

## Step 3 — Test the Connection

1. Click **Test Connection**
2. If successful, you'll see a green checkmark and the authenticated user name
3. If it fails, verify:
   - The URL is correct and uses `https://`
   - Your PAT is valid and not expired
   - Your network can reach the Jira instance

---

## Step 4 — Discover and Map Fields

1. Click **Fetch Fields** to retrieve all custom fields for your project
2. A scrollable panel appears showing every custom field with its ID, name, type, and allowed values
3. Fields marked with a red **required** badge must be mapped
4. Click **Map Required Fields** to auto-add all required fields, or click the **+** icon next to individual fields

### Configuring Field Types

For each mapped field, set the correct **Type**:

| Jira Field Type | Fetchy Type | Example Value |
|-----------------|-------------|---------------|
| Text field | **Text** | `Release 2.5` |
| Single select / dropdown | **Select** | `High` |
| Multi-select / checkboxes | **Multi** | `Frontend, Backend` |
| Insight / Assets object | **Insight** | `GCE-38216` |
| Complex / nested object | **Raw JSON** | `[{"key":"VAL"}]` |

### Searching for Insight Objects

If a field uses Jira Insight/Assets:

1. Set the field type to **Insight**
2. Click the 🔍 search icon next to the field
3. Start typing — results filter live as you type
4. Click a result to add its key to the field value
5. Multiple keys can be comma-separated: `GCE-38216, GCE-12345`

---

## Step 5 — Generate and Send a Bug Report

1. Send an API request that returns an error or unexpected response
2. Open the **AI Assistant** panel
3. Click **Bug Report**
4. Add a brief note describing what went wrong (e.g., "Expected 200 but got 500 on login endpoint")
5. Click **Generate** — the AI creates a detailed markdown bug report
6. Review the bug report in the modal
7. Click **Create Jira Bug** in the footer

Fetchy will:
- Extract the title from the report
- Clean the markdown description for Jira
- Apply all your custom field mappings
- Create the issue in Jira

---

## Step 6 — View the Issue

On success, a clickable link appears (e.g., `WEBAPP-1234`). Click it to open the issue in your system browser.

---

## Troubleshooting

### "Field 'X' is required"

Your Jira project requires a custom field that isn't mapped. Use **Fetch Fields** to find it and add it to your mappings.

:::note
Some Jira fields are required for issue creation but **not marked with a `*`** in the Jira UI or API. If you see this error for a field that doesn't appear as required in Field Discovery, add it to your mappings manually.
:::

### "does not match Filter Scopes"

The Insight object key you provided isn't valid for that field's filter configuration in Jira. Use the Insight search to find a valid key.

### "401 Unauthorized"

Your PAT may be expired or revoked. Generate a new one from your Jira profile.

---

## Tips

- **Re-fetch fields** after changing the project key — different projects may have different required fields
- **Use Insight search** instead of entering keys manually — it validates that the object exists
- **Raw JSON type** is useful for edge cases where the Jira field structure is unusual
- **PAT security** — your token is encrypted with your OS credential store and never appears in config files
