---
id: request-history
title: Request History
sidebar_label: Request History
sidebar_position: 9
description: Browse, search, filter, and re-send past requests from the history panel.
---

# Request History

Fetchy automatically records every request you send. The **History** tab in the sidebar lets you browse, search, and re-send past requests.

---

## Viewing History

Click the **History** tab in the sidebar to open the history panel. Each entry shows:

- HTTP method badge (color-coded)
- Request URL
- Timestamp

---

## Searching

Use the search bar at the top of the panel to filter entries by URL. Results update as you type.

---

## Filtering by HTTP Method

Click the **filter icon** (funnel) next to the search bar to filter history entries by HTTP method:

- **ALL** — show every request (default)
- **GET**, **POST**, **PUT**, **PATCH**, **DELETE** — show only requests of that method

The filter button turns accent-colored when an active filter is applied.

---

## Sorting

Click the **sort icon** (arrows) to toggle the sort order:

- **Newest first** (default) — most recent requests at the top
- **Oldest first** — earliest requests at the top

---

## Re-sending a Request

Click any history entry to open it in a new tab with all original settings (URL, method, headers, body, auth) pre-filled. You can edit and re-send it immediately.

---

## Configuring History Limit

Go to **Settings** → **Max History Items** to control how many entries are retained (10–500). Older entries are automatically removed when the limit is reached.

---

## See Also

- [HTTP Requests →](/docs/features/http-requests)
- [Environments →](/docs/features/environments)
