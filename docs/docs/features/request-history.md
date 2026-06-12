---
sidebar_position: 4
title: Request History
---

# Request History

Fetchy automatically records every HTTP request you send, so you can revisit, replay, or reference them at any time.

---

## Viewing History

Click the **History** tab (clock icon) in the sidebar to see all your past requests. Each entry shows:

- **Method badge** – color-coded HTTP verb (GET, POST, PUT, PATCH, DELETE)
- **URL** – the full request URL
- **Timestamp** – when the request was made
- **Status & size** – the response status code and body size (when available)

Click any history entry to load it into the request panel.

---

## Searching History

Use the **search bar** at the top of the History panel to filter entries by URL or request name. The list updates as you type.

To clear the search, click the **×** button inside the input field.

---

## Filtering & Sorting

Click the **Filter** icon (funnel) in the toolbar next to the search bar to open the filter/sort dropdown. The icon turns accent color when any non-default option is active.

### Filter by Method

Show only requests of a specific HTTP method:

| Option | Shows |
|--------|-------|
| **All Methods** | All requests (default) |
| **GET** | GET requests only |
| **POST** | POST requests only |
| **PUT** | PUT requests only |
| **PATCH** | PATCH requests only |
| **DELETE** | DELETE requests only |

### Sort by

| Option | Description |
|--------|-------------|
| **Newest First** | Most recent requests at the top (default) |
| **Oldest First** | Earliest requests at the top |
| **Name (A-Z)** | Alphabetical ascending by request name or URL |
| **Name (Z-A)** | Alphabetical descending by request name or URL |
| **Method** | Alphabetical order by HTTP method |

Click **Clear All Filters** at the bottom of the dropdown to reset all options to their defaults.

---

## Clearing History

Click **Clear All** (top-right of the history list) to permanently remove all history entries. This action cannot be undone.

The maximum number of history entries retained can be configured in **Settings → Max History Items**.
