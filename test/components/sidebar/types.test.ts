/**
 * Tests for src/components/sidebar/types.ts
 *
 * Covers the exported TypeScript types via type-level assertions and
 * runtime duck-typing checks.
 */

import { describe, expect, it } from 'vitest';
import type {
  SortOption,
  FilterMethod,
  DragItem,
  ContextMenuState,
  EditingProps,
} from '../../src/components/sidebar/types';

// ─── Type-level smoke tests ───────────────────────────────────────────────────

describe('SortOption type', () => {
  it('accepts valid sort option values at runtime', () => {
    const validOptions: SortOption[] = ['name-asc', 'name-desc', 'method', 'created'];
    expect(validOptions).toHaveLength(4);
  });
});

describe('FilterMethod type', () => {
  it('includes "all" as a valid filter method', () => {
    const filterMethod: FilterMethod = 'all';
    expect(filterMethod).toBe('all');
  });

  it('accepts HTTP method strings as filter methods', () => {
    const methods: FilterMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    expect(methods).toHaveLength(5);
  });
});

describe('DragItem shape', () => {
  it('can represent a collection drag item', () => {
    const item: DragItem = {
      type: 'collection',
      id: 'col-1',
      collectionId: 'col-1',
      index: 0,
    };
    expect(item.type).toBe('collection');
    expect(item.folderId).toBeUndefined();
    expect(item.index).toBe(0);
  });

  it('can represent a request drag item with folderId', () => {
    const item: DragItem = {
      type: 'request',
      id: 'req-1',
      collectionId: 'col-1',
      folderId: 'folder-1',
      index: 2,
    };
    expect(item.type).toBe('request');
    expect(item.folderId).toBe('folder-1');
  });
});

describe('ContextMenuState shape', () => {
  it('can represent a collection context menu', () => {
    const menu: ContextMenuState = {
      x: 100,
      y: 200,
      type: 'collection',
      collectionId: 'col-1',
    };
    expect(menu.type).toBe('collection');
    expect(menu.folderId).toBeUndefined();
    expect(menu.requestId).toBeUndefined();
  });

  it('can represent a request context menu with requestId', () => {
    const menu: ContextMenuState = {
      x: 50,
      y: 75,
      type: 'request',
      collectionId: 'col-1',
      folderId: 'folder-1',
      requestId: 'req-1',
    };
    expect(menu.requestId).toBe('req-1');
    expect(menu.folderId).toBe('folder-1');
  });
});
