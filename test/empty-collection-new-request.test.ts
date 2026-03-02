/**
 * Tests for the "New Request" button that appears inside an empty collection.
 *
 * The button is rendered in Sidebar.tsx whenever:
 *
 *   collectionFolders.length === 0 && collectionRequests.length === 0
 *
 * When clicked it calls:
 *
 *   addRequest(collection.id, null)
 *
 * which delegates to createDefaultRequest() and appends the result to the
 * collection's requests array.
 *
 * These tests verify the underlying logic — the visibility condition evaluates
 * correctly for all relevant states, and the tree helpers produce the right
 * shape — without needing a DOM or React tree.
 */
import { describe, it, expect } from 'vitest';
import {
  createDefaultRequest,
  addRequestToFolder,
  addSubFolder,
} from '../src/store/requestTree';
import type { ApiRequest, RequestFolder } from '../src/types';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Mirrors the visibility condition used in Sidebar.tsx's renderCollection.
 * Returns true when the "New Request" button should be visible.
 */
function shouldShowNewRequestButton(
  folders: RequestFolder[],
  requests: ApiRequest[]
): boolean {
  return folders.length === 0 && requests.length === 0;
}

/** Builds a minimal RequestFolder for testing. */
function makeFolder(name = 'Folder'): RequestFolder {
  return { id: `folder-${Math.random()}`, name, requests: [], folders: [], expanded: false };
}

// ---------------------------------------------------------------------------
// shouldShowNewRequestButton (visibility condition)
// ---------------------------------------------------------------------------

describe('shouldShowNewRequestButton', () => {
  it('returns true for a brand-new empty collection (no requests, no folders)', () => {
    expect(shouldShowNewRequestButton([], [])).toBe(true);
  });

  it('returns false once one request is present', () => {
    const requests = [createDefaultRequest()];
    expect(shouldShowNewRequestButton([], requests)).toBe(false);
  });

  it('returns false once one folder is present (even if folder is empty)', () => {
    const folders = [makeFolder()];
    expect(shouldShowNewRequestButton(folders, [])).toBe(false);
  });

  it('returns false when both folders and requests are present', () => {
    const requests = [createDefaultRequest()];
    const folders = [makeFolder()];
    expect(shouldShowNewRequestButton(folders, requests)).toBe(false);
  });

  it('returns true again only when both arrays are empty', () => {
    // Simulates "all requests deleted" without removing folders
    const folders = [makeFolder()];
    expect(shouldShowNewRequestButton(folders, [])).toBe(false);

    expect(shouldShowNewRequestButton([], [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createDefaultRequest (the request created when the button is clicked)
// ---------------------------------------------------------------------------

describe('createDefaultRequest', () => {
  it('creates a request with the default "GET" method', () => {
    const req = createDefaultRequest();
    expect(req.method).toBe('GET');
  });

  it('creates a request with an empty URL', () => {
    const req = createDefaultRequest();
    expect(req.url).toBe('');
  });

  it('creates a request named "New Request"', () => {
    const req = createDefaultRequest();
    expect(req.name).toBe('New Request');
  });

  it('creates a request with an empty headers array', () => {
    const req = createDefaultRequest();
    expect(req.headers).toEqual([]);
  });

  it('creates a request with an empty params array', () => {
    const req = createDefaultRequest();
    expect(req.params).toEqual([]);
  });

  it('creates a request with body type "none"', () => {
    const req = createDefaultRequest();
    expect(req.body.type).toBe('none');
  });

  it('creates a request with auth type "none"', () => {
    const req = createDefaultRequest();
    expect(req.auth.type).toBe('none');
  });

  it('creates a unique ID each time', () => {
    const a = createDefaultRequest();
    const b = createDefaultRequest();
    expect(a.id).not.toBe(b.id);
  });

  it('applies overrides correctly', () => {
    const req = createDefaultRequest({ name: 'My Request', method: 'POST', url: 'https://example.com' });
    expect(req.name).toBe('My Request');
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://example.com');
    // Untouched defaults should still be present
    expect(req.headers).toEqual([]);
    expect(req.auth.type).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Adding a request to a collection (tree-level integration)
// ---------------------------------------------------------------------------

describe('adding a request to an empty collection (top-level)', () => {
  it('transitions the collection from empty to having one request', () => {
    // Start: empty collection
    let requests: ApiRequest[] = [];
    const folders: RequestFolder[] = [];

    expect(shouldShowNewRequestButton(folders, requests)).toBe(true);

    // Simulate addRequest(collectionId, null) → appends to top-level requests
    const newReq = createDefaultRequest();
    requests = [...requests, newReq];

    expect(requests).toHaveLength(1);
    expect(requests[0].id).toBe(newReq.id);
    expect(shouldShowNewRequestButton(folders, requests)).toBe(false);
  });

  it('button stays hidden after multiple requests are added', () => {
    let requests: ApiRequest[] = [];
    const folders: RequestFolder[] = [];

    const r1 = createDefaultRequest({ name: 'Request 1' });
    const r2 = createDefaultRequest({ name: 'Request 2' });
    requests = [...requests, r1, r2];

    expect(shouldShowNewRequestButton(folders, requests)).toBe(false);
    expect(requests).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// addRequestToFolder (nested request creation)
// ---------------------------------------------------------------------------

describe('addRequestToFolder', () => {
  it('appends a request to the target folder', () => {
    const folder = makeFolder('Auth');
    const req = createDefaultRequest({ name: 'Login' });

    const { folders, found } = addRequestToFolder([folder], folder.id, req);

    expect(found).toBe(true);
    expect(folders[0].requests).toHaveLength(1);
    expect(folders[0].requests[0].name).toBe('Login');
  });

  it('returns found=false when the target folder does not exist', () => {
    const folder = makeFolder();
    const req = createDefaultRequest();

    const { found } = addRequestToFolder([folder], 'non-existent-id', req);

    expect(found).toBe(false);
  });

  it('appends to a nested sub-folder', () => {
    const child = makeFolder('Child');
    const parent: RequestFolder = { ...makeFolder('Parent'), folders: [child] };
    const req = createDefaultRequest({ name: 'Deep Request' });

    const { folders, found } = addRequestToFolder([parent], child.id, req);

    expect(found).toBe(true);
    expect(folders[0].folders[0].requests).toHaveLength(1);
    expect(folders[0].folders[0].requests[0].name).toBe('Deep Request');
  });

  it('does not mutate the original folders array', () => {
    const folder = makeFolder();
    const original = [folder];
    const req = createDefaultRequest();

    const { folders } = addRequestToFolder(original, folder.id, req);

    // Original array reference must be unchanged
    expect(original).toHaveLength(1);
    expect(original[0].requests).toHaveLength(0);
    expect(folders).not.toBe(original);
  });
});

// ---------------------------------------------------------------------------
// addSubFolder (folder creation that also hides the button)
// ---------------------------------------------------------------------------

describe('addSubFolder', () => {
  it('appends a sub-folder to the target parent folder', () => {
    const parent = makeFolder('Parent');
    const child = makeFolder('Child');

    const { folders, found } = addSubFolder([parent], parent.id, child);

    expect(found).toBe(true);
    expect(folders[0].folders).toHaveLength(1);
    expect(folders[0].folders[0].name).toBe('Child');
  });

  it('returns found=false when the parent folder does not exist', () => {
    const parent = makeFolder();
    const child = makeFolder();

    const { found } = addSubFolder([parent], 'does-not-exist', child);

    expect(found).toBe(false);
  });

  it('does not mutate the original folders array', () => {
    const parent = makeFolder();
    const original = [parent];
    const child = makeFolder();

    const { folders } = addSubFolder(original, parent.id, child);

    expect(original[0].folders).toHaveLength(0);
    expect(folders[0].folders).toHaveLength(1);
  });
});
