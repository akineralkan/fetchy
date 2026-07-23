---
id: first-request
title: Your First Request
sidebar_label: Your First Request
sidebar_position: 3
description: Learn how to create and send your first API request in Fetchy.
---

# Your First Request

Get up and running in under a minute.

---

## Step 1 — Create or Select a Workspace

On first launch, Fetchy prompts you to create a workspace:

1. Enter a **workspace name** (e.g., "My Project")
2. Choose a **home directory** — where collections and environments will be stored
3. Choose a **secrets directory** — where secret variable values will be stored separately

Click **Create Workspace** to proceed.

:::tip
Right after creating your workspace, a short interactive tour introduces Fetchy's main features. Skip it anytime, or replay it later from **Settings → General → Replay Tour**.
:::

---

## Step 2 — Create a New Request

Use any of these methods:

- Press **`Ctrl+N`** (the fastest way)
- Click the **+** button in the sidebar
- Click **New Request** in the welcome screen

A new untitled request tab opens.

---

## Step 3 — Configure the Request

1. **Method** — Select the HTTP method from the dropdown (default: `GET`)
2. **URL** — Enter your endpoint, e.g.:
   ```
   https://jsonplaceholder.typicode.com/posts/1
   ```
3. **Headers / Params** — Add any required headers or query parameters using the tabs below the URL bar
4. **Body** — For POST/PUT requests, switch to the **Body** tab and choose a content type

---

## Step 4 — Send the Request

- Press **`Ctrl+Enter`** or click the **Send** button

The response panel shows:
- **Status code** (color-coded)
- **Response body** with syntax highlighting
- **Response headers**
- **Response time** and **size**

---

## Step 5 — Save the Request

Press **`Ctrl+S`** to save. Fetchy will ask you to:

1. Select or create a **collection** to save it to
2. Optionally place it in a **folder** within the collection
3. Give the request a **name**

---

## Example: Test with JSONPlaceholder

```
GET https://jsonplaceholder.typicode.com/users
```

Expected response: a JSON array of 10 users. ✅

---

## Next Steps

- [HTTP Requests →](/docs/features/http-requests) — Deep dive into all request configuration options
- [Environment Variables →](/docs/features/environments) — Use variables to manage base URLs and API keys
- [Collections →](/docs/features/collections) — Organize requests into reusable collections
