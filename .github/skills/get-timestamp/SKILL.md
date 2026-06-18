---
name: get-timestamp
description: 'Get the current timestamp in ISO 8601 UTC format for use in Pantheon coordination files'
---

# Get Current Timestamp (ISO 8601 UTC)

When you need the current timestamp for any coordination file entry (communications, key-decisions, jira-items, worklog, etc.), always retrieve it at runtime using the terminal — never guess or hardcode a timestamp.

## Steps

1. Run the following command in the terminal:

```powershell
[System.DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
```

2. Use the exact string returned by the command as the `[TIMESTAMP]` value in all coordination file entries.

## Example

Command output: `2026-06-17T09:42:11Z`

Use as: `[2026-06-17T09:42:11Z] MY-PROJECT TASK-123 Prometheus - Developer: Starting implementation.`
