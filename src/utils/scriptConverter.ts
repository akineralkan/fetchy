/**
 * scriptConverter.ts — Convert pre/post-request scripts from other API clients
 * (Postman, Hoppscotch, Bruno) into the Fetchy scripting API.
 *
 * Fetchy scripting API surface:
 *   Pre-request scripts:
 *     fetchy.environment.get(key)        → returns the current value
 *     fetchy.environment.set(key, value) → sets a variable
 *     fetchy.environment.all()           → returns all env variables
 *     console.log(...)                   → captured output
 *
 *   Post-request (test) scripts:
 *     fetchy.response.data               → parsed response body
 *     fetchy.response.headers            → response headers object
 *     fetchy.response.status             → HTTP status code (number)
 *     fetchy.response.statusText         → HTTP status text
 *     fetchy.environment.get/set/all     → same as above
 *     console.log(...)                   → captured output
 */

// ---------------------------------------------------------------------------
// Postman → Fetchy
// ---------------------------------------------------------------------------
// Postman uses the `pm` global:
//   pm.environment.get/set, pm.variables.get/set, pm.globals.get/set,
//   pm.collectionVariables.get/set, pm.response.json(), pm.response.code,
//   pm.response.status, pm.response.headers, pm.test(), pm.expect(), etc.

/**
 * Convert a Postman script string to Fetchy script syntax.
 */
export const convertPostmanScript = (script: string): string => {
  if (!script) return '';

  let result = script;

  // --- Environment / variable accessors → fetchy.environment ---
  // pm.environment.get("x") → fetchy.environment.get("x")
  result = result.replace(/\bpm\.environment\.get\b/g, 'fetchy.environment.get');
  // pm.environment.set("x", v) → fetchy.environment.set("x", v)
  result = result.replace(/\bpm\.environment\.set\b/g, 'fetchy.environment.set');

  // pm.variables.get/set → fetchy.environment.get/set  (best-effort mapping)
  result = result.replace(/\bpm\.variables\.get\b/g, 'fetchy.environment.get');
  result = result.replace(/\bpm\.variables\.set\b/g, 'fetchy.environment.set');

  // pm.globals.get/set → fetchy.environment.get/set
  result = result.replace(/\bpm\.globals\.get\b/g, 'fetchy.environment.get');
  result = result.replace(/\bpm\.globals\.set\b/g, 'fetchy.environment.set');

  // pm.collectionVariables.get/set → fetchy.environment.get/set
  result = result.replace(/\bpm\.collectionVariables\.get\b/g, 'fetchy.environment.get');
  result = result.replace(/\bpm\.collectionVariables\.set\b/g, 'fetchy.environment.set');

  // --- Response accessors → fetchy.response ---
  // pm.response.json() → fetchy.response.data
  result = result.replace(/\bpm\.response\.json\(\)/g, 'fetchy.response.data');
  // pm.response.code → fetchy.response.status
  result = result.replace(/\bpm\.response\.code\b/g, 'fetchy.response.status');
  // pm.response.status → fetchy.response.statusText
  result = result.replace(/\bpm\.response\.status\b/g, 'fetchy.response.statusText');
  // pm.response.headers → fetchy.response.headers
  result = result.replace(/\bpm\.response\.headers\b/g, 'fetchy.response.headers');
  // pm.response.text() → JSON.stringify(fetchy.response.data)
  result = result.replace(/\bpm\.response\.text\(\)/g, 'JSON.stringify(fetchy.response.data)');

  // --- pm.test(...) → wrap content in console.log or leave as comment ---
  // pm.test("name", function() { ... }) → // Test: "name"\n(function() { ... })()
  result = result.replace(
    /\bpm\.test\(\s*(["'`].*?["'`])\s*,\s*(function\s*\([^)]*\)\s*\{)/g,
    '// Postman test: $1\n($2'
  );
  // Close the wrapping IIFE — find trailing });  that closed pm.test and convert to })();
  // This is best-effort; complex nesting may need manual review
  result = result.replace(/\}\s*\)\s*;?\s*(?=\n|$)/g, '})();');

  // pm.expect → console.log (best-effort — no assertion library in Fetchy)
  result = result.replace(/\bpm\.expect\b/g, '// pm.expect (not supported in Fetchy) — ');

  return result;
};

// ---------------------------------------------------------------------------
// Hoppscotch → Fetchy
// ---------------------------------------------------------------------------
// Hoppscotch uses the `pw` global:
//   pw.env.get/set, pw.expect(), pw.response (alias for response object)

/**
 * Convert a Hoppscotch script string to Fetchy script syntax.
 */
export const convertHoppscotchScript = (script: string): string => {
  if (!script) return '';

  let result = script;

  // pw.env.get("x") → fetchy.environment.get("x")
  result = result.replace(/\bpw\.env\.get\b/g, 'fetchy.environment.get');
  // pw.env.set("x", v) → fetchy.environment.set("x", v)
  result = result.replace(/\bpw\.env\.set\b/g, 'fetchy.environment.set');

  // pw.response.body → fetchy.response.data
  result = result.replace(/\bpw\.response\.body\b/g, 'fetchy.response.data');
  // pw.response.status → fetchy.response.status
  result = result.replace(/\bpw\.response\.status\b/g, 'fetchy.response.status');
  // pw.response.headers → fetchy.response.headers
  result = result.replace(/\bpw\.response\.headers\b/g, 'fetchy.response.headers');

  // pw.expect → console.log (best-effort)
  result = result.replace(/\bpw\.expect\b/g, '// pw.expect (not supported in Fetchy) — ');

  // pw.test("name", fn) → same IIFE pattern
  result = result.replace(
    /\bpw\.test\(\s*(["'`].*?["'`])\s*,\s*(function\s*\([^)]*\)\s*\{)/g,
    '// Hoppscotch test: $1\n($2'
  );

  return result;
};

// ---------------------------------------------------------------------------
// Bruno → Fetchy
// ---------------------------------------------------------------------------
// Bruno uses the `bru` and `req`/`res` globals:
//   bru.getEnvVar/setEnvVar, bru.getVar/setVar, bru.getProcessEnv,
//   req.getUrl/setUrl, req.getHeader/setHeader, req.getBody/setBody,
//   res.getBody/getStatus/getHeader/getHeaders

/**
 * Convert a Bruno script string to Fetchy script syntax.
 */
export const convertBrunoScript = (script: string): string => {
  if (!script) return '';

  let result = script;

  // --- Environment/variable accessors ---
  // bru.getEnvVar("x") → fetchy.environment.get("x")
  result = result.replace(/\bbru\.getEnvVar\b/g, 'fetchy.environment.get');
  // bru.setEnvVar("x", v) → fetchy.environment.set("x", v)
  result = result.replace(/\bbru\.setEnvVar\b/g, 'fetchy.environment.set');
  // bru.getVar("x") → fetchy.environment.get("x")
  result = result.replace(/\bbru\.getVar\b/g, 'fetchy.environment.get');
  // bru.setVar("x", v) → fetchy.environment.set("x", v)
  result = result.replace(/\bbru\.setVar\b/g, 'fetchy.environment.set');

  // bru.getProcessEnv("x") → not supported, comment out
  result = result.replace(
    /\bbru\.getProcessEnv\(/g,
    '/* bru.getProcessEnv not supported in Fetchy */ fetchy.environment.get('
  );

  // bru.setGlobalEnvVar / bru.getGlobalEnvVar → fetchy.environment.set / get
  result = result.replace(/\bbru\.setGlobalEnvVar\b/g, 'fetchy.environment.set');
  result = result.replace(/\bbru\.getGlobalEnvVar\b/g, 'fetchy.environment.get');

  // --- Response accessors (post-response scripts) ---

  // Function-call style:
  // res.getBody() → fetchy.response.data
  result = result.replace(/\bres\.getBody\(\)/g, 'fetchy.response.data');
  // res.getStatus() → fetchy.response.status
  result = result.replace(/\bres\.getStatus\(\)/g, 'fetchy.response.status');
  // res.getHeaders() → fetchy.response.headers
  result = result.replace(/\bres\.getHeaders\(\)/g, 'fetchy.response.headers');
  // res.getHeader("x") → fetchy.response.headers["x"]
  result = result.replace(
    /\bres\.getHeader\(\s*(["'`])(.*?)\1\s*\)/g,
    'fetchy.response.headers[$1$2$1]'
  );

  // Property-access style (Bruno also exposes res.status, res.body, res.headers directly):
  // res.body → fetchy.response.data
  result = result.replace(/\bres\.body\b/g, 'fetchy.response.data');
  // res.status → fetchy.response.status
  result = result.replace(/\bres\.status\b/g, 'fetchy.response.status');
  // res.headers → fetchy.response.headers
  result = result.replace(/\bres\.headers\b/g, 'fetchy.response.headers');
  // res.statusText → fetchy.response.statusText
  result = result.replace(/\bres\.statusText\b/g, 'fetchy.response.statusText');

  // --- Request accessors (pre-request scripts) ---
  // req.getUrl() / req.getMethod() / req.getHeader() — no direct equivalent, leave with comment
  result = result.replace(/\breq\.getUrl\(\)/g, '/* req.getUrl() — not supported in Fetchy */');
  result = result.replace(/\breq\.getMethod\(\)/g, '/* req.getMethod() — not supported in Fetchy */');
  result = result.replace(
    /\breq\.getHeader\(/g,
    '/* req.getHeader() — not supported in Fetchy */ ('
  );

  return result;
};
