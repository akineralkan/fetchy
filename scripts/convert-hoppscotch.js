/**
 * convert-hoppscotch.js
 *
 * Standalone Node.js script that cleans up a Hoppscotch personal collections
 * JSON export into a clean Hoppscotch-schema JSON that Fetchy's built-in
 * Hoppscotch importer will process correctly.
 *
 * The output keeps Hoppscotch field names (endpoint, authType, contentType,
 * active, etc.) so that the importer maps them to Fetchy's internal model.
 * It strips Hoppscotch-only noise (_ref_id, responses, v, requestVariables)
 * and converts {{var}} mustache syntax to <<var>> angle-bracket syntax.
 *
 * Usage:
 *   node scripts/convert-hoppscotch.js <input.json> [output.json]
 *
 * If output is omitted, writes to <input>-fetchy.json
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Mustache → angle-bracket variable conversion (deep)
// ---------------------------------------------------------------------------
function convertMustacheToAngleBrackets(text) {
  return text.replace(/\{\{([^}]+)\}\}/g, '<<$1>>');
}

function convertMustacheVarsDeep(value) {
  if (typeof value === 'string') {
    return convertMustacheToAngleBrackets(value);
  }
  if (Array.isArray(value)) {
    return value.map(convertMustacheVarsDeep);
  }
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = convertMustacheVarsDeep(v);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Hoppscotch script → Fetchy script conversion (pw.* → fetchy.*)
// ---------------------------------------------------------------------------
function convertHoppscotchScript(script) {
  if (!script) return '';
  let result = script;
  result = result.replace(/\bpw\.env\.get\b/g, 'fetchy.environment.get');
  result = result.replace(/\bpw\.env\.set\b/g, 'fetchy.environment.set');
  result = result.replace(/\bpw\.response\.body\b/g, 'fetchy.response.data');
  result = result.replace(/\bpw\.response\.status\b/g, 'fetchy.response.status');
  result = result.replace(/\bpw\.response\.headers\b/g, 'fetchy.response.headers');
  result = result.replace(/\bpw\.expect\b/g, '// pw.expect (not supported in Fetchy) — ');
  result = result.replace(
    /\bpw\.test\(\s*(["'`].*?["'`])\s*,\s*(function\s*\([^)]*\)\s*\{)/g,
    '// Hoppscotch test: $1\n($2'
  );
  return result;
}

// ---------------------------------------------------------------------------
// Clean a single request — keep Hoppscotch field names, strip noise
// ---------------------------------------------------------------------------
const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'QUERY'];

function cleanRequest(req) {
  const method = (req.method || 'GET').toUpperCase();
  const safeMethod = VALID_METHODS.includes(method) ? method : 'GET';

  const headers = (req.headers || []).map((h) => ({
    key: h.key || '',
    value: h.value || '',
    active: h.active !== false,
    description: h.description || '',
  }));

  const params = (req.params || []).map((p) => ({
    key: p.key || '',
    value: p.value || '',
    active: p.active !== false,
    description: p.description || '',
  }));

  // Keep body in Hoppscotch format: { contentType, body }
  const body = {
    contentType: (req.body && req.body.contentType) || null,
    body: (req.body && req.body.body) || null,
  };

  // Keep auth in Hoppscotch format: { authType, authActive, ... }
  const auth = req.auth ? { ...req.auth } : { authType: 'none', authActive: true };
  // Strip _ref_id-like noise from auth if present
  delete auth._ref_id;

  const out = {
    v: req.v || '4',
    name: req.name || 'Untitled Request',
    method: safeMethod,
    endpoint: req.endpoint || '',
    params,
    headers,
    body,
    auth,
    preRequestScript: req.preRequestScript
      ? convertHoppscotchScript(req.preRequestScript)
      : '',
    testScript: req.testScript ? convertHoppscotchScript(req.testScript) : '',
  };

  return out;
}

// ---------------------------------------------------------------------------
// Clean a folder (recursive) — keep Hoppscotch structure
// ---------------------------------------------------------------------------
function cleanFolder(folder) {
  const subFolders = (folder.folders || []).map(cleanFolder);
  const requests = (folder.requests || []).map(cleanRequest);

  const out = {
    v: folder.v || 2,
    name: folder.name || 'Untitled Folder',
    folders: subFolders,
    requests,
    headers: (folder.headers || []).map((h) => ({
      key: h.key || '',
      value: h.value || '',
      active: h.active !== false,
      description: h.description || '',
    })),
    auth: folder.auth ? { ...folder.auth } : { authType: 'none', authActive: true },
  };
  delete out.auth._ref_id;

  if (folder.description) out.description = folder.description;

  const variables = (folder.variables || []).map((v) => ({
    key: v.key || '',
    initialValue: v.initialValue ?? v.value ?? '',
    currentValue: v.currentValue ?? '',
    secret: v.secret || false,
  }));
  if (variables.length > 0) out.variables = variables;

  return out;
}

// ---------------------------------------------------------------------------
// Clean a top-level collection — keep Hoppscotch structure
// ---------------------------------------------------------------------------
function cleanCollection(coll) {
  const subFolders = (coll.folders || []).map(cleanFolder);
  const requests = (coll.requests || []).map(cleanRequest);

  const variables = (coll.variables || []).map((v) => ({
    key: v.key || '',
    initialValue: v.initialValue ?? v.value ?? '',
    currentValue: v.currentValue ?? '',
    secret: v.secret || false,
  }));

  const out = {
    v: coll.v || 2,
    name: coll.name || 'Imported Collection',
    folders: subFolders,
    requests,
    headers: (coll.headers || []).map((h) => ({
      key: h.key || '',
      value: h.value || '',
      active: h.active !== false,
      description: h.description || '',
    })),
    auth: coll.auth ? { ...coll.auth } : { authType: 'none', authActive: true },
  };
  delete out.auth._ref_id;

  if (coll.description) out.description = coll.description;
  if (variables.length > 0) out.variables = variables;

  return out;
}

// ---------------------------------------------------------------------------
// Main: parse, clean, convert variables, return array
// ---------------------------------------------------------------------------
function convertForFetchy(content) {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Empty content provided');
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid JSON: Could not parse the Hoppscotch collection file');
  }

  const collections = Array.isArray(parsed) ? parsed : [parsed];

  if (collections.length === 0) {
    throw new Error('No collections found in the file');
  }

  for (const coll of collections) {
    if (!coll || typeof coll !== 'object') {
      throw new Error('Invalid Hoppscotch collection: item is not an object');
    }
    if (!coll.name && !coll.requests && !coll.folders) {
      throw new Error(
        'Invalid Hoppscotch collection format: expected "name", "requests", or "folders" field'
      );
    }
  }

  // Clean then convert {{var}} → <<var>>
  return collections.map((c) => convertMustacheVarsDeep(cleanCollection(c)));
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/convert-hoppscotch.js <input.json> [output.json]');
  process.exit(1);
}

const inputPath = path.resolve(args[0]);
const outputPath = args[1]
  ? path.resolve(args[1])
  : inputPath.replace(/\.json$/i, '-fetchy.json');

console.log(`Reading: ${inputPath}`);
const raw = fs.readFileSync(inputPath, 'utf-8');

console.log('Converting Hoppscotch collections for Fetchy import...');
const result = convertForFetchy(raw);

console.log(`Converted ${result.length} collection(s). Writing: ${outputPath}`);
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

// Print summary
function countAll(collections) {
  let folders = 0;
  let requests = 0;
  function walkFolder(f) {
    folders++;
    requests += f.requests.length;
    f.folders.forEach(walkFolder);
  }
  for (const c of collections) {
    requests += c.requests.length;
    c.folders.forEach(walkFolder);
  }
  return { folders, requests };
}

const stats = countAll(result);
console.log(`Done! ${result.length} collections, ${stats.folders} folders, ${stats.requests} requests.`);
