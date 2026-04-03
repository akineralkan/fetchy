---
id: jira-integration
title: Jira Integration
sidebar_label: Jira Integration
sidebar_position: 12
description: Create Jira bug reports directly from AI-generated bug analysis with custom field mapping, Insight object search, and secure PAT storage.
---

# Jira Integration

Fetchy integrates with Jira to let you create bug reports directly from AI-generated bug analysis — no copy-pasting, no context switching.

---

## Overview

When the AI Assistant generates a bug report from a failed API response, you can push it to Jira with one click. Fetchy handles:

- **Automatic title extraction** from the AI-generated markdown
- **Description cleaning** — removes markdown artifacts that don't render well in Jira
- **Custom field mapping** — map any Jira custom field with the correct type
- **Insight object search** — search and select Jira Insight/Assets objects live
- **Secure authentication** — your Personal Access Token (PAT) is encrypted at rest

---

## Setting Up

Navigate to **Settings → Integrations** to configure the Jira connection.

### 1. Enable Jira Integration

Toggle **Enable Jira Integration** to show the "Create Jira Bug" button in AI-generated bug reports.

### 2. Jira Base URL

Enter your Jira instance URL. This can be any Jira Server, Data Center, or Cloud instance:

```
https://your-company.atlassian.net
https://jira.your-company.com
```

### 3. Personal Access Token (PAT)

Enter your Jira PAT. You can generate one from your Jira profile:

- **Jira Cloud:** Profile → Security → API tokens → Create API token
- **Jira Server/DC:** Profile → Personal Access Tokens → Create token

:::info Security
Your PAT is **encrypted at rest** using your operating system's credential store (Windows DPAPI / macOS Keychain). It is **never** stored in plain text or written to `preferences.json`.
:::

### 4. Project Key

Enter the Jira project key where bug reports will be created (e.g., `MYPROJECT`, `WEBAPP`).

### 5. Test Connection

Click **Test Connection** to verify your credentials. Fetchy will attempt to reach the Jira REST API and display the authenticated user's name on success.

---

## Field Discovery

Click **Fetch Fields** to retrieve all available custom fields for your project and issue type. Fetchy queries the Jira `createmeta` API and displays:

- **Field ID** — the internal Jira identifier (e.g., `customfield_12345`)
- **Field Name** — the human-readable label
- **Required** badge — fields marked as required by your Jira project configuration
- **Type** — the Jira field schema type
- **Allowed Values** — if the field has a fixed set of options, they are listed as chips

Click the **+** icon next to any field to add it to your mappings, or use **Map Required Fields** to auto-add all required custom fields at once.

:::caution Hidden Required Fields
Some Jira projects have fields that are **required for issue creation but not marked with a `*`** in the Jira UI or the `createmeta` API response. If issue creation fails with a "Field 'X' is required" error, check your Jira project's field configuration — you may need to manually add that field to your mappings even though it doesn't appear as required in Field Discovery.
:::

---

## Custom Field Mappings

Each mapping consists of five parts:

| Column | Description |
|--------|-------------|
| **Name** | A friendly label for your reference (e.g., "Customer") |
| **Custom Field ID** | The Jira field ID (e.g., `customfield_17200`) |
| **Type** | How Fetchy should format the value when sending to Jira |
| **Default Value** | The value to send (depends on the type — see below) |
| **Actions** | Search (Insight fields) or delete the mapping |

### Field Types

#### Text

Sends a plain string value.

```json
{ "customfield_12345": "My text value" }
```

#### Select (Option)

Sends a value-object for Jira select/dropdown fields.

```json
{ "customfield_12345": { "value": "High" } }
```

#### Multi (Array)

Sends an array of value-objects for multi-select fields. Enter values separated by commas.

**Input:** `Frontend, Backend, API`

```json
{ "customfield_12345": [{ "value": "Frontend" }, { "value": "Backend" }, { "value": "API" }] }
```

#### Insight

Sends Jira Insight/Assets object references. Enter one or more object keys separated by commas.

**Input:** `GCE-38216, GCE-12345`

```json
{ "customfield_12345": [{ "key": "GCE-38216" }, { "key": "GCE-12345" }] }
```

Use the **Search** button to search for Insight objects by name — see [Insight Object Search](#insight-object-search) below.

#### Raw JSON

Sends the value as-is to the Jira API. Use this for complex field types not covered by the other options.

**Input:** `[{"key": "VAL-123"}]`

```json
{ "customfield_12345": [{ "key": "VAL-123" }] }
```

---

## Insight Object Search

For fields of type **Insight**, click the 🔍 search icon to open a live search panel:

1. **Type to filter** — results update as you type (with 300ms debounce)
2. **Browse results** — each result shows the object name and its key (e.g., `GCE-38216`)
3. **Click to select** — the Insight key is appended to the field's default value

Fetchy queries the Jira JQL Autocomplete Suggestions API to find matching objects. The raw Insight key (e.g., `GCE-38216`) is extracted automatically — even if Jira returns values in `"Name (KEY-123)"` format.

---

## Creating a Bug Report

Once Jira is configured, a **Create Jira Bug** button appears in every AI-generated bug report:

1. **Open the AI Assistant** and analyze a failed API response
2. Click **Bug Report** and add a note describing the issue
3. The AI generates a detailed bug report with title, severity, steps to reproduce, and more
4. Click **Create Jira Bug** in the bug report footer
5. Fetchy:
   - Extracts the title from the `## Title` section
   - Cleans the description (removes markdown headings, horizontal rules, duplicate numbering)
   - Builds all custom field payloads based on your mappings
   - Creates the issue via the Jira REST API
6. On success, a clickable link to the new Jira issue appears — it opens in your **system browser**

---

## Error Handling

If issue creation fails, Fetchy shows a compact error indicator with:

- A red ⚠ icon — hover to see the full error message
- A **Copy** button — copies the error text for troubleshooting

Common errors:

| Error | Solution |
|-------|----------|
| `401 Unauthorized` | Check your PAT — it may be expired or revoked |
| `404 Not Found` | Verify the base URL and project key |
| `Field 'X' is required` | Add the required field to your custom mappings |
| `does not match Filter Scopes` | The Insight object key isn't valid for that field's filter — check Jira config |

---

## Security

| Concern | How Fetchy handles it |
|---------|----------------------|
| **PAT storage** | Encrypted via OS credential store (DPAPI on Windows, Keychain on macOS) |
| **PAT in preferences** | Never written to `preferences.json` — stored separately in encrypted secrets file |
| **PAT in git** | Secrets stored in app data directory, completely outside the repository |
| **Network** | All Jira API calls use HTTPS — HTTP URLs are rejected |
| **External links** | Jira issue links open via `shell.openExternal` with URL validation |
