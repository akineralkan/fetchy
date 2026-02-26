/**
 * Tests for Postman collection and environment import parsers.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { importPostmanCollection } from '../src/utils/postman';
import { importPostmanEnvironment } from '../src/utils/postman';

const fixturesDir = join(__dirname, 'data');

// --------------------------------------------------------------------------
// Postman Collection Import
// --------------------------------------------------------------------------

describe('importPostmanCollection', () => {
  it('should import a valid Postman collection from fixture file', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content);

    expect(collection).not.toBeNull();
    expect(collection!.name).toBe('Test Postman Collection');
    expect(collection!.description).toBe('A test collection exported from Postman');
  });

  it('should parse top-level requests', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    // Top-level has "Get Users" request
    expect(collection.requests.length).toBe(1);
    expect(collection.requests[0].name).toBe('Get Users');
    expect(collection.requests[0].method).toBe('GET');
    expect(collection.requests[0].url).toBe('https://api.example.com/users?page=1');
  });

  it('should parse folders and nested requests', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    expect(collection.folders.length).toBe(1);
    expect(collection.folders[0].name).toBe('Auth Folder');
    expect(collection.folders[0].requests.length).toBe(1);
    expect(collection.folders[0].requests[0].name).toBe('Login');
    expect(collection.folders[0].requests[0].method).toBe('POST');
  });

  it('should parse request headers', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    const getUsers = collection.requests[0];
    expect(getUsers.headers.length).toBe(1);
    expect(getUsers.headers[0].key).toBe('Accept');
    expect(getUsers.headers[0].value).toBe('application/json');
  });

  it('should parse query parameters', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    const getUsers = collection.requests[0];
    expect(getUsers.params.length).toBe(1);
    expect(getUsers.params[0].key).toBe('page');
    expect(getUsers.params[0].value).toBe('1');
  });

  it('should parse basic auth', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    const login = collection.folders[0].requests[0];
    expect(login.auth.type).toBe('basic');
    if (login.auth.type === 'basic') {
      expect(login.auth.basic?.username).toBe('admin');
      expect(login.auth.basic?.password).toBe('secret');
    }
  });

  it('should parse request body', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    const login = collection.folders[0].requests[0];
    // Postman fixture uses mode: "raw" so it maps to body type 'json' via raw content detection
    expect(['json', 'raw']).toContain(login.body.type);
  });

  it('should parse collection variables', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    expect(collection.variables).toBeDefined();
    expect(collection.variables!.length).toBe(2);
    expect(collection.variables![0].key).toBe('baseUrl');
    expect(collection.variables![0].value).toBe('https://api.example.com');
  });

  it('should handle empty content', () => {
    expect(() => importPostmanCollection('')).toThrow();
  });

  it('should handle invalid JSON', () => {
    expect(() => importPostmanCollection('not json')).toThrow();
  });

  it('should handle JSON with missing info field', () => {
    const content = JSON.stringify({ item: [] });
    // Postman importer requires the "info" field; it throws without it
    expect(() => importPostmanCollection(content)).toThrow();
  });

  it('should generate unique IDs for all items', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    const ids = new Set<string>();
    ids.add(collection.id);
    for (const req of collection.requests) ids.add(req.id);
    for (const folder of collection.folders) {
      ids.add(folder.id);
      for (const req of folder.requests) ids.add(req.id);
    }

    // All IDs should be unique
    const totalItems = 1 + collection.requests.length +
      collection.folders.length +
      collection.folders.reduce((sum, f) => sum + f.requests.length, 0);
    expect(ids.size).toBe(totalItems);
  });
});

// --------------------------------------------------------------------------
// Postman Environment Import
// --------------------------------------------------------------------------

describe('importPostmanEnvironment', () => {
  it('should import a valid Postman environment from fixture file', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const envs = importPostmanEnvironment(content);

    expect(envs.length).toBe(1);
    expect(envs[0].name).toBe('Test Postman Environment');
  });

  it('should parse all variables', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const env = importPostmanEnvironment(content)[0];

    expect(env.variables.length).toBe(4);
  });

  it('should map variable keys and values', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const env = importPostmanEnvironment(content)[0];

    const baseUrl = env.variables.find(v => v.key === 'baseUrl');
    expect(baseUrl).toBeDefined();
    expect(baseUrl!.value).toBe('https://api.example.com');
    expect(baseUrl!.enabled).toBe(true);
  });

  it('should mark secret variables', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const env = importPostmanEnvironment(content)[0];

    const apiKey = env.variables.find(v => v.key === 'apiKey');
    expect(apiKey).toBeDefined();
    expect(apiKey!.isSecret).toBe(true);
  });

  it('should respect disabled state', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const env = importPostmanEnvironment(content)[0];

    const debugMode = env.variables.find(v => v.key === 'debugMode');
    expect(debugMode).toBeDefined();
    expect(debugMode!.enabled).toBe(false);
  });

  it('should handle array of environments', () => {
    const envs = [
      { name: 'Env1', values: [{ key: 'a', value: '1', enabled: true }] },
      { name: 'Env2', values: [{ key: 'b', value: '2', enabled: true }] },
    ];
    const result = importPostmanEnvironment(JSON.stringify(envs));
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Env1');
    expect(result[1].name).toBe('Env2');
  });

  it('should handle empty content', () => {
    expect(() => importPostmanEnvironment('')).toThrow();
  });

  it('should handle invalid JSON', () => {
    expect(() => importPostmanEnvironment('not json')).toThrow();
  });

  it('should handle environment with no values', () => {
    const content = JSON.stringify({ name: 'Empty', values: [] });
    const result = importPostmanEnvironment(content);
    expect(result.length).toBe(1);
    expect(result[0].variables.length).toBe(0);
  });

  it('should generate unique IDs for environment and variables', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const envs = importPostmanEnvironment(content);

    const ids = new Set<string>();
    for (const env of envs) {
      ids.add(env.id);
      for (const v of env.variables) ids.add(v.id);
    }
    // Should have unique IDs for env + 4 variables = 5
    expect(ids.size).toBe(5);
  });
});
