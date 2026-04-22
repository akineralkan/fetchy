import { describe, expect, it } from 'vitest';

import { buildEntityIndex, type EntityIndex } from '../src/store/entityIndex';
import type { Collection, RequestAuth, RequestFolder } from '../src/types';
import { resolveInheritedAuth } from '../src/utils/authInheritance';

function makeFolder(id: string, auth?: RequestAuth, folders: RequestFolder[] = []): RequestFolder {
  return {
    id,
    name: id,
    folders,
    requests: [],
    auth,
  };
}

function makeCollection(folders: RequestFolder[], auth?: RequestAuth): Collection {
  return {
    id: 'collection-1',
    name: 'Collection',
    folders,
    requests: [],
    auth,
  };
}

describe('resolveInheritedAuth', () => {
  it('returns collection auth when no folder id is provided', () => {
    const collectionAuth: RequestAuth = {
      type: 'bearer',
      bearer: { token: 'collection-token' },
    };

    expect(resolveInheritedAuth(makeCollection([], collectionAuth))).toEqual(collectionAuth);
  });

  it('returns the closest concrete auth from the recursive folder chain', () => {
    const inheritedAuth: RequestAuth = {
      type: 'basic',
      basic: { username: 'fetchy', password: 'secret' },
    };
    const collection = makeCollection(
      [
        makeFolder('root', { type: 'none' }, [
          makeFolder('parent', inheritedAuth, [
            makeFolder('target', { type: 'inherit' }),
          ]),
        ]),
      ],
      {
        type: 'bearer',
        bearer: { token: 'collection-token' },
      }
    );

    expect(resolveInheritedAuth(collection, 'target')).toEqual(inheritedAuth);
  });

  it('uses the entity index path when an index is provided', () => {
    const inheritedAuth: RequestAuth = {
      type: 'api-key',
      apiKey: { key: 'X-API-Key', value: 'abc123', addTo: 'header' },
    };
    const collection = makeCollection(
      [
        makeFolder('root', { type: 'inherit' }, [
          makeFolder('child', inheritedAuth, [
            makeFolder('target', { type: 'none' }),
          ]),
        ]),
      ],
      {
        type: 'bearer',
        bearer: { token: 'collection-token' },
      }
    );
    const index = buildEntityIndex([collection]);

    expect(resolveInheritedAuth(collection, 'target', index)).toEqual(inheritedAuth);
  });

  it('falls back to collection auth when no folder in the chain has concrete auth', () => {
    const collectionAuth: RequestAuth = {
      type: 'api-key',
      apiKey: { key: 'X-Collection-Key', value: 'secret', addTo: 'header' },
    };
    const collection = makeCollection(
      [
        makeFolder('root', { type: 'inherit' }, [
          makeFolder('target', { type: 'none' }),
        ]),
      ],
      collectionAuth
    );

    expect(resolveInheritedAuth(collection, 'target')).toEqual(collectionAuth);
  });

  it('falls back to collection auth when the provided index is stale', () => {
    const collectionAuth: RequestAuth = {
      type: 'basic',
      basic: { username: 'fallback-user', password: 'fallback-pass' },
    };
    const collection = makeCollection([], collectionAuth);
    const staleIndex: EntityIndex = {
      requests: new Map(),
      folders: new Map([
        ['ghost-folder', { collectionId: collection.id, parentId: null }],
      ]),
    };

    expect(resolveInheritedAuth(collection, 'ghost-folder', staleIndex)).toEqual(collectionAuth);
  });

  it('returns null when neither folder inheritance nor collection auth resolves', () => {
    const collection = makeCollection([], { type: 'inherit' });

    expect(resolveInheritedAuth(collection, 'missing-folder')).toBeNull();
  });
});