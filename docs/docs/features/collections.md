---
id: collections
title: Collections
sidebar_label: Collections
sidebar_position: 3
description: Organize API requests into collections and folders with drag-and-drop support.
---

# Collections

Collections are the primary way to organize your API requests in Fetchy.

---

## Structure

```
📁 My API Collection
  ├── 📁 Users
  │     ├── 📄 List Users          GET /users
  │     ├── 📄 Get User by ID      GET /users/:id
  │     ├── 📄 Create User         POST /users
  │     └── 📄 Delete User         DELETE /users/:id
  ├── 📁 Authentication
  │     ├── 📄 Login               POST /auth/login
  │     └── 📄 Refresh Token       POST /auth/refresh
  └── 📄 Health Check              GET /health
```

---

## Creating a Collection

1. Click the **+** icon next to "Collections" in the sidebar, or
2. Right-click in the sidebar → **New Collection**
3. Enter a name and optional description

---

## Adding Folders and Requests

- **New Folder** — right-click a collection or folder → **New Folder**
- **New Request** — right-click a collection or folder → **New Request**, or press **`Ctrl+N`**

---

## Drag & Drop

Reorder items by dragging them:

- Drag **requests** to move them within or between folders
- Drag **folders** to reorder them
- Drag **collections** to reorder in the sidebar

---

## Collection Settings

Right-click a collection → **Collection Settings** to configure:

### Authentication
Set a default auth for all requests in the collection. Child requests set to `inherit` will use this auth.

### Collection Variables

Define variables scoped to this collection. Each variable has:
- **Initial Value** — shareable, stored in the collection file
- **Current Value** — local only, not exported with the collection

Use collection variables with `<<variable_name>>` in requests.

---

## Expand / Collapse All

To quickly expand or collapse all folders in a collection, right-click the collection header and choose:

- **Expand All** — opens the collection and all nested folders
- **Collapse All** — collapses the collection and all nested folders

---

## Collection Runner

Run all requests in a collection automatically:

1. Right-click a collection → **Run Collection**
2. Configure:
   - **Mode** — Sequential (one at a time) or Parallel (all at once)
   - **Delay** — Milliseconds between requests (sequential mode)
   - **Iterations** — Number of times to run the full collection
   - **Stop on Error** — Halt execution if any request fails
3. Click **Run**

Results show per-request status, response time, and pass/fail state.

---

## Export a Collection

Right-click a collection → **Export** to save it as a Postman v2.1-compatible JSON file.

---

## See Also

- [Authentication →](/docs/features/authentication) — Collection-level auth
- [Import & Export →](/docs/features/import-export) — Import collections from Postman or OpenAPI
- [Collection Runner Guide →](/docs/guides/collections)
