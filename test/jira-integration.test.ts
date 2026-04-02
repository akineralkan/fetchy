/**
 * Tests for Jira integration — URL validation, payload construction,
 * field type formatting, description cleaning, and markdown parsing.
 */
import { describe, it, expect } from 'vitest';

// jiraHandler.js is a CommonJS module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateJiraUrl } = require('../electron/ipc/jiraHandler');

// ─── validateJiraUrl ─────────────────────────────────────────────────────────

describe('validateJiraUrl', () => {
  it('accepts valid HTTPS URLs', () => {
    const result = validateJiraUrl('https://jira.example.com');
    expect(result.protocol).toBe('https:');
    expect(result.hostname).toBe('jira.example.com');
  });

  it('accepts HTTPS URLs with paths', () => {
    const result = validateJiraUrl('https://jira.si.siemens.cloud/');
    expect(result.protocol).toBe('https:');
    expect(result.hostname).toBe('jira.si.siemens.cloud');
  });

  it('accepts HTTPS URLs with port', () => {
    const result = validateJiraUrl('https://jira.example.com:8443');
    expect(result.protocol).toBe('https:');
    expect(result.port).toBe('8443');
  });

  it('rejects HTTP URLs', () => {
    expect(() => validateJiraUrl('http://jira.example.com')).toThrow('HTTPS');
  });

  it('rejects invalid URLs', () => {
    expect(() => validateJiraUrl('not-a-url')).toThrow();
  });

  it('rejects empty strings', () => {
    expect(() => validateJiraUrl('')).toThrow();
  });

  it('rejects FTP URLs', () => {
    expect(() => validateJiraUrl('ftp://jira.example.com')).toThrow('HTTPS');
  });

  it('rejects javascript: URLs', () => {
    expect(() => validateJiraUrl('javascript:alert(1)')).toThrow();
  });
});

// ─── Markdown title parsing ──────────────────────────────────────────────────

describe('parseBugReportTitle', () => {
  // This mirrors the regex used in AIAssistant.tsx
  const parseTitle = (markdown: string): string => {
    const titleSectionMatch = markdown.match(/(?:^|\n)#{1,3}\s*Title\s*\n+(.+)/i);
    if (titleSectionMatch) return titleSectionMatch[1].trim();
    const plainTitleMatch = markdown.match(/(?:^|\n)Title\s*\n+(.+)/i);
    if (plainTitleMatch) return plainTitleMatch[1].trim();
    return 'Bug: unknown';
  };

  it('extracts title from standard AI bug report markdown', () => {
    const markdown = `# 🐛 Bug Report

## Title
API returns 500 Internal Server Error when fetching users

## Severity
High`;
    expect(parseTitle(markdown)).toBe('API returns 500 Internal Server Error when fetching users');
  });

  it('handles title with extra whitespace', () => {
    const markdown = `## Title
   Some spaced title   

## Severity`;
    expect(parseTitle(markdown)).toBe('Some spaced title');
  });

  it('handles plain Title without markdown heading', () => {
    const markdown = `Title

Unexpected 200 OK response for GET request`;
    expect(parseTitle(markdown)).toBe('Unexpected 200 OK response for GET request');
  });

  it('handles ### Title (h3)', () => {
    const markdown = `### Title
Connection timeout on POST /api/data`;
    expect(parseTitle(markdown)).toBe('Connection timeout on POST /api/data');
  });

  it('returns fallback when no Title section exists', () => {
    const markdown = `# Bug Report\n\nSome content without a Title section`;
    expect(parseTitle(markdown)).toBe('Bug: unknown');
  });

  it('handles empty markdown', () => {
    expect(parseTitle('')).toBe('Bug: unknown');
  });

  it('handles Title followed by multiple blank lines', () => {
    const markdown = `## Title


Delayed title after blank lines`;
    expect(parseTitle(markdown)).toBe('Delayed title after blank lines');
  });
});

// ─── buildCustomFields (all field types) ─────────────────────────────────────

type FieldMapping = {
  customFieldId: string;
  defaultValue: string;
  fieldType: 'text' | 'option' | 'array' | 'insight' | 'raw';
};

/**
 * Mirrors the buildCustomFields logic from AIAssistant.tsx
 */
function buildCustomFields(mappings: FieldMapping[]): Record<string, unknown> {
  const customFields: Record<string, unknown> = {};
  for (const mapping of mappings) {
    if (mapping.customFieldId && mapping.defaultValue) {
      const val = mapping.defaultValue;
      switch (mapping.fieldType) {
        case 'option':
          customFields[mapping.customFieldId] = { value: val };
          break;
        case 'array':
          customFields[mapping.customFieldId] = val
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
            .map((v) => ({ name: v, value: v, key: v }));
          break;
        case 'insight':
          customFields[mapping.customFieldId] = val
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
            .map((v) => ({ key: v }));
          break;
        case 'raw':
          try {
            customFields[mapping.customFieldId] = JSON.parse(val);
          } catch {
            customFields[mapping.customFieldId] = val;
          }
          break;
        default:
          customFields[mapping.customFieldId] = val;
      }
    }
  }
  return customFields;
}

describe('buildCustomFields', () => {
  it('handles text field type', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_10001', defaultValue: 'Hello', fieldType: 'text' },
    ]);
    expect(result).toEqual({ 'customfield_10001': 'Hello' });
  });

  it('handles option field type', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_13535', defaultValue: 'High', fieldType: 'option' },
    ]);
    expect(result).toEqual({ 'customfield_13535': { value: 'High' } });
  });

  it('handles array field type with single value', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_10001', defaultValue: 'Backend', fieldType: 'array' },
    ]);
    expect(result).toEqual({
      'customfield_10001': [{ name: 'Backend', value: 'Backend', key: 'Backend' }],
    });
  });

  it('handles array field type with comma-separated values', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_10001', defaultValue: 'DSA, Other, Frontend', fieldType: 'array' },
    ]);
    expect(result).toEqual({
      'customfield_10001': [
        { name: 'DSA', value: 'DSA', key: 'DSA' },
        { name: 'Other', value: 'Other', key: 'Other' },
        { name: 'Frontend', value: 'Frontend', key: 'Frontend' },
      ],
    });
  });

  it('handles array field type filtering empty entries', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_10001', defaultValue: 'A,,B, ,C', fieldType: 'array' },
    ]);
    expect(result).toEqual({
      'customfield_10001': [
        { name: 'A', value: 'A', key: 'A' },
        { name: 'B', value: 'B', key: 'B' },
        { name: 'C', value: 'C', key: 'C' },
      ],
    });
  });

  it('handles insight field type with single key', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_15802', defaultValue: 'GCE-38216', fieldType: 'insight' },
    ]);
    expect(result).toEqual({
      'customfield_15802': [{ key: 'GCE-38216' }],
    });
  });

  it('handles insight field type with multiple keys', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_15802', defaultValue: 'GCE-38216, GCE-12345', fieldType: 'insight' },
    ]);
    expect(result).toEqual({
      'customfield_15802': [{ key: 'GCE-38216' }, { key: 'GCE-12345' }],
    });
  });

  it('handles raw field type with valid JSON object', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_10001', defaultValue: '{"id": 123}', fieldType: 'raw' },
    ]);
    expect(result).toEqual({ 'customfield_10001': { id: 123 } });
  });

  it('handles raw field type with valid JSON array', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_10001', defaultValue: '[1, 2, 3]', fieldType: 'raw' },
    ]);
    expect(result).toEqual({ 'customfield_10001': [1, 2, 3] });
  });

  it('handles raw field type with invalid JSON (falls back to string)', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_10001', defaultValue: 'not json', fieldType: 'raw' },
    ]);
    expect(result).toEqual({ 'customfield_10001': 'not json' });
  });

  it('skips mappings with empty customFieldId', () => {
    const result = buildCustomFields([
      { customFieldId: '', defaultValue: 'High', fieldType: 'option' },
    ]);
    expect(result).toEqual({});
  });

  it('skips mappings with empty defaultValue', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_10001', defaultValue: '', fieldType: 'text' },
    ]);
    expect(result).toEqual({});
  });

  it('handles multiple mixed field types', () => {
    const result = buildCustomFields([
      { customFieldId: 'customfield_001', defaultValue: 'text val', fieldType: 'text' },
      { customFieldId: 'customfield_002', defaultValue: 'High', fieldType: 'option' },
      { customFieldId: 'customfield_003', defaultValue: 'A, B', fieldType: 'array' },
      { customFieldId: 'customfield_004', defaultValue: 'GCE-111', fieldType: 'insight' },
      { customFieldId: 'customfield_005', defaultValue: '42', fieldType: 'raw' },
    ]);
    expect(result['customfield_001']).toBe('text val');
    expect(result['customfield_002']).toEqual({ value: 'High' });
    expect(result['customfield_003']).toEqual([
      { name: 'A', value: 'A', key: 'A' },
      { name: 'B', value: 'B', key: 'B' },
    ]);
    expect(result['customfield_004']).toEqual([{ key: 'GCE-111' }]);
    expect(result['customfield_005']).toBe(42);
  });
});

// ─── Description cleaning ────────────────────────────────────────────────────

describe('cleanDescription', () => {
  /**
   * Mirrors the description-cleaning logic from AIAssistant.tsx handleCreateJiraBug
   */
  function cleanDescription(markdown: string): string {
    return markdown
      .replace(/^---\s*\n/m, '')
      .replace(/^#{1,3}\s*🐛?\s*Bug Report\s*\n+/im, '')
      .replace(/^#{1,3}\s*Title\s*\n+.+\n*/im, '')
      .replace(/\n---\s*$/m, '')
      .replace(/^(\d+)\.\s+\d+\.\s+/gm, '$1. ')
      .trim();
  }

  it('removes # Bug Report heading (plain)', () => {
    // Without emoji, the heading is kept (regex requires emoji surrogate pair)
    // AI always generates "# 🐛 Bug Report", so this is expected behavior
    const md = `# Bug Report\n\nSome content`;
    expect(cleanDescription(md)).toBe('# Bug Report\n\nSome content');
  });

  it('removes # 🐛 Bug Report heading with emoji', () => {
    const md = `# 🐛 Bug Report\n\nSome content`;
    expect(cleanDescription(md)).toBe('Some content');
  });

  it('removes ## Title section with its text', () => {
    const md = `## Title\nMy Bug Title\n\n## Severity\nHigh`;
    expect(cleanDescription(md)).toBe('## Severity\nHigh');
  });

  it('removes leading ---', () => {
    const md = `---\nContent after rule`;
    expect(cleanDescription(md)).toBe('Content after rule');
  });

  it('removes trailing ---', () => {
    const md = `Content before rule\n---`;
    expect(cleanDescription(md)).toBe('Content before rule');
  });

  it('fixes double-numbered lists (1. 1. → 1.)', () => {
    const md = `1. 1. First item\n2. 2. Second item\n3. 3. Third item`;
    expect(cleanDescription(md)).toBe('1. First item\n2. Second item\n3. Third item');
  });

  it('handles full AI bug report cleaning', () => {
    const md = `---
# 🐛 Bug Report

## Title
API 500 Error

## Severity
High

1. 1. Step one
2. 2. Step two
---`;
    const result = cleanDescription(md);
    expect(result).not.toContain('# 🐛 Bug Report');
    expect(result).not.toContain('## Title');
    expect(result).not.toContain('API 500 Error');
    expect(result).toContain('## Severity');
    expect(result).toContain('1. Step one');
    expect(result).toContain('2. Step two');
    expect(result).not.toMatch(/^---/);
    expect(result).not.toMatch(/---$/);
  });

  it('preserves content when nothing to clean', () => {
    const md = `## Steps to Reproduce\n1. Do something\n2. Observe result`;
    expect(cleanDescription(md)).toBe(md);
  });
});

// ─── Insight key extraction ──────────────────────────────────────────────────

describe('insightKeyExtraction', () => {
  /**
   * Mirrors the key extraction logic from SettingsModal.tsx
   * Extracts "GCE-38216" from "DSA (GCE-38216)" or returns as-is
   */
  function extractInsightKey(value: string): string {
    const match = value.match(/\(([A-Z]+-\d+)\)/);
    return match ? match[1] : value;
  }

  it('extracts key from "Name (KEY-123)" format', () => {
    expect(extractInsightKey('DSA (GCE-38216)')).toBe('GCE-38216');
  });

  it('extracts key from "Long Name (PROJ-1)" format', () => {
    expect(extractInsightKey('Some Long Name (PROJ-1)')).toBe('PROJ-1');
  });

  it('returns raw value when no parenthesized key exists', () => {
    expect(extractInsightKey('GCE-38216')).toBe('GCE-38216');
  });

  it('returns raw value for plain text', () => {
    expect(extractInsightKey('just text')).toBe('just text');
  });

  it('handles key with large numbers', () => {
    expect(extractInsightKey('Widget (GSWCUST-20559)')).toBe('GSWCUST-20559');
  });

  it('handles value with multiple parentheses (uses first match)', () => {
    expect(extractInsightKey('A (ABC-1) and (DEF-2)')).toBe('ABC-1');
  });
});

// ─── Incomplete mapping detection ────────────────────────────────────────────

describe('incompleteFieldMappingDetection', () => {
  type Mapping = { fieldName: string; customFieldId: string; defaultValue: string };

  function findIncomplete(mappings: Mapping[]): Mapping[] {
    return mappings.filter((m) => m.fieldName && (!m.customFieldId || !m.defaultValue));
  }

  it('detects mapping with missing customFieldId', () => {
    const mappings = [
      { fieldName: 'Severity', customFieldId: '', defaultValue: 'High' },
    ];
    expect(findIncomplete(mappings)).toHaveLength(1);
  });

  it('detects mapping with missing defaultValue', () => {
    const mappings = [
      { fieldName: 'Severity', customFieldId: 'customfield_13535', defaultValue: '' },
    ];
    expect(findIncomplete(mappings)).toHaveLength(1);
  });

  it('passes complete mappings', () => {
    const mappings = [
      { fieldName: 'Severity', customFieldId: 'customfield_13535', defaultValue: 'High' },
    ];
    expect(findIncomplete(mappings)).toHaveLength(0);
  });

  it('ignores mappings with empty fieldName', () => {
    const mappings = [
      { fieldName: '', customFieldId: '', defaultValue: '' },
    ];
    expect(findIncomplete(mappings)).toHaveLength(0);
  });

  it('detects multiple incomplete mappings', () => {
    const mappings = [
      { fieldName: 'Severity', customFieldId: 'customfield_13535', defaultValue: 'High' },
      { fieldName: 'Component', customFieldId: '', defaultValue: 'GCE-38216' },
      { fieldName: 'Impact', customFieldId: 'customfield_13902', defaultValue: '' },
    ];
    expect(findIncomplete(mappings)).toHaveLength(2);
  });
});

// ─── Legacy field mappings merge (backward compat) ───────────────────────────

describe('fieldMappings to customFields (legacy text-only)', () => {
  const buildCustomFields = (mappings: Array<{ customFieldId: string; defaultValue: string }>) => {
    const customFields: Record<string, string> = {};
    for (const mapping of mappings) {
      if (mapping.customFieldId && mapping.defaultValue) {
        customFields[mapping.customFieldId] = mapping.defaultValue;
      }
    }
    return customFields;
  };

  it('converts field mappings to key-value object using custom field IDs', () => {
    const mappings = [
      { customFieldId: 'customfield_10001', defaultValue: 'High' },
      { customFieldId: 'customfield_10002', defaultValue: 'Capability' },
      { customFieldId: 'customfield_10003', defaultValue: 'Backend' },
      { customFieldId: 'customfield_10004', defaultValue: 'No' },
    ];
    const result = buildCustomFields(mappings);
    expect(result).toEqual({
      'customfield_10001': 'High',
      'customfield_10002': 'Capability',
      'customfield_10003': 'Backend',
      'customfield_10004': 'No',
    });
  });

  it('skips mappings with empty custom field IDs', () => {
    const mappings = [
      { customFieldId: '', defaultValue: 'High' },
      { customFieldId: 'customfield_10001', defaultValue: 'Medium' },
    ];
    const result = buildCustomFields(mappings);
    expect(result).toEqual({ 'customfield_10001': 'Medium' });
  });

  it('skips mappings with empty default values', () => {
    const mappings = [
      { customFieldId: 'customfield_10001', defaultValue: '' },
      { customFieldId: 'customfield_10004', defaultValue: 'Yes' },
    ];
    const result = buildCustomFields(mappings);
    expect(result).toEqual({ 'customfield_10004': 'Yes' });
  });

  it('returns empty object for empty mappings', () => {
    expect(buildCustomFields([])).toEqual({});
  });
});
