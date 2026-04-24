/**
 * Tests for src/components/openapi/utils.ts
 *
 * Covers:
 *  - resolveRef: $ref resolution against OpenAPI specs
 *  - generateExampleFromSchema: example generation from schema types
 *  - getSchemaTypeDisplay: human-readable schema type strings
 */

import { describe, expect, it } from 'vitest';
import {
  resolveRef,
  generateExampleFromSchema,
  getSchemaTypeDisplay,
} from '../src/components/openapi/utils';

// ─── resolveRef ─────────────────────────────────────────────────────────────

describe('resolveRef', () => {
  const spec = {
    components: {
      schemas: {
        User: { type: 'object', properties: { name: { type: 'string' } } },
        Address: { type: 'object', properties: { city: { type: 'string' } } },
      },
    },
  };

  it('resolves a valid $ref path to the target object', () => {
    const result = resolveRef('#/components/schemas/User', spec as any);
    expect(result).toEqual({ type: 'object', properties: { name: { type: 'string' } } });
  });

  it('resolves a nested $ref path', () => {
    const result = resolveRef('#/components/schemas/Address', spec as any);
    expect(result).toEqual({ type: 'object', properties: { city: { type: 'string' } } });
  });

  it('returns null for non-#/ prefix refs', () => {
    expect(resolveRef('http://external.com/schema', spec as any)).toBeNull();
  });

  it('returns null for empty ref string', () => {
    expect(resolveRef('', spec as any)).toBeNull();
  });

  it('returns null when intermediate path segment is missing', () => {
    expect(resolveRef('#/components/nonexistent/Foo', spec as any)).toBeNull();
  });

  it('returns null when final segment does not exist', () => {
    expect(resolveRef('#/components/schemas/NonExistent', spec as any)).toBeNull();
  });

  it('returns null when path traverses a non-object', () => {
    const specWithPrimitive = { info: 'just a string' };
    expect(resolveRef('#/info/title', specWithPrimitive as any)).toBeNull();
  });
});

// ─── generateExampleFromSchema ──────────────────────────────────────────────

describe('generateExampleFromSchema', () => {
  const emptySpec = {} as any;

  it('returns the example when provided', () => {
    expect(generateExampleFromSchema({ example: 42 }, emptySpec)).toBe(42);
  });

  it('generates object example from properties', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    };
    expect(generateExampleFromSchema(schema, emptySpec)).toEqual({ name: 'string', age: 0 });
  });

  it('returns empty object for object type with no properties', () => {
    expect(generateExampleFromSchema({ type: 'object' }, emptySpec)).toEqual({});
  });

  it('generates array example from items', () => {
    const schema = { type: 'array', items: { type: 'string' } };
    expect(generateExampleFromSchema(schema, emptySpec)).toEqual(['string']);
  });

  it('returns empty array for array type with no items', () => {
    expect(generateExampleFromSchema({ type: 'array' }, emptySpec)).toEqual([]);
  });

  it('returns date-time format for string date-time', () => {
    expect(generateExampleFromSchema({ type: 'string', format: 'date-time' }, emptySpec)).toBe('2024-01-15T10:30:00Z');
  });

  it('returns date format for string date', () => {
    expect(generateExampleFromSchema({ type: 'string', format: 'date' }, emptySpec)).toBe('2024-01-15');
  });

  it('returns email format for string email', () => {
    expect(generateExampleFromSchema({ type: 'string', format: 'email' }, emptySpec)).toBe('user@example.com');
  });

  it('returns uuid format for string uuid', () => {
    expect(generateExampleFromSchema({ type: 'string', format: 'uuid' }, emptySpec)).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns uri format for string uri', () => {
    expect(generateExampleFromSchema({ type: 'string', format: 'uri' }, emptySpec)).toBe('https://example.com');
  });

  it('returns first enum value for string with enum', () => {
    expect(generateExampleFromSchema({ type: 'string', enum: ['active', 'inactive'] }, emptySpec)).toBe('active');
  });

  it('returns "string" for plain string type', () => {
    expect(generateExampleFromSchema({ type: 'string' }, emptySpec)).toBe('string');
  });

  it('returns 0 for integer type', () => {
    expect(generateExampleFromSchema({ type: 'integer' }, emptySpec)).toBe(0);
  });

  it('returns 0.0 for number type', () => {
    expect(generateExampleFromSchema({ type: 'number' }, emptySpec)).toBe(0.0);
  });

  it('returns minimum for integer when minimum is set', () => {
    expect(generateExampleFromSchema({ type: 'integer', minimum: 5 }, emptySpec)).toBe(5);
  });

  it('returns default for number when default is set', () => {
    expect(generateExampleFromSchema({ type: 'number', default: 3.14 }, emptySpec)).toBe(3.14);
  });

  it('returns true for boolean type', () => {
    expect(generateExampleFromSchema({ type: 'boolean' }, emptySpec)).toBe(true);
  });

  it('returns null for unknown type', () => {
    expect(generateExampleFromSchema({ type: 'custom' }, emptySpec)).toBeNull();
  });

  it('returns null when no type is specified', () => {
    expect(generateExampleFromSchema({}, emptySpec)).toBeNull();
  });

  it('resolves $ref and generates example', () => {
    const spec = {
      components: {
        schemas: {
          Pet: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    };
    const schema = { $ref: '#/components/schemas/Pet' };
    expect(generateExampleFromSchema(schema, spec as any)).toEqual({ name: 'string' });
  });

  it('handles circular $ref by returning empty object', () => {
    const spec = {
      components: {
        schemas: {
          Node: { type: 'object', properties: { child: { $ref: '#/components/schemas/Node' } } },
        },
      },
    };
    const schema = { $ref: '#/components/schemas/Node' };
    const result = generateExampleFromSchema(schema, spec as any) as any;
    expect(result).toHaveProperty('child');
    expect(result.child).toEqual({});
  });

  it('returns empty object when $ref cannot be resolved', () => {
    expect(generateExampleFromSchema({ $ref: '#/components/schemas/Missing' }, emptySpec)).toEqual({});
  });
});

// ─── getSchemaTypeDisplay ───────────────────────────────────────────────────

describe('getSchemaTypeDisplay', () => {
  it('extracts type name from $ref', () => {
    expect(getSchemaTypeDisplay({ $ref: '#/components/schemas/User' })).toBe('User');
  });

  it('returns "object" for $ref with empty last segment', () => {
    expect(getSchemaTypeDisplay({ $ref: '#/' })).toBe('object');
  });

  it('returns array<TypeName> for array with $ref items', () => {
    expect(getSchemaTypeDisplay({
      type: 'array',
      items: { $ref: '#/components/schemas/Pet' },
    })).toBe('array<Pet>');
  });

  it('returns array<type> for array with plain type items', () => {
    expect(getSchemaTypeDisplay({
      type: 'array',
      items: { type: 'string' },
    })).toBe('array<string>');
  });

  it('returns array<any> for array with items missing type', () => {
    expect(getSchemaTypeDisplay({
      type: 'array',
      items: {},
    })).toBe('array<any>');
  });

  it('returns the type as-is for simple types', () => {
    expect(getSchemaTypeDisplay({ type: 'string' })).toBe('string');
    expect(getSchemaTypeDisplay({ type: 'integer' })).toBe('integer');
    expect(getSchemaTypeDisplay({ type: 'boolean' })).toBe('boolean');
  });

  it('returns "any" when no type or $ref is present', () => {
    expect(getSchemaTypeDisplay({})).toBe('any');
  });
});
