/**
 * helpers.ts - Barrel re-exports for backward compatibility.
 *
 * Each concern has been extracted to its own focused module:
 *   - httpUtils.ts      : HTTP formatting helpers (formatBytes, formatTime, method/status colors, JSON utils)
 *   - jwt.ts            : JWT decoding and validation utilities
 *   - variables.ts      : Variable replacement and request variable resolution
 *   - curlParser.ts     : cURL command parser
 *   - codeGenerator.ts  : Code generation for multiple languages (cURL, JS, Python, Java, .NET, Go, Rust, C++)
 *   - postman.ts        : Postman collection/environment import / export
 *   - openapi.ts        : OpenAPI specification import
 *   - hoppscotch.ts     : Hoppscotch collection/environment import
 *   - bruno.ts          : Bruno collection/environment import
 */

export * from './httpUtils';
export * from './jwt';
export * from './variables';
export * from './curlParser';
export * from './codeGenerator';
export * from './postman';
export * from './openapi';
export * from './hoppscotch';
export * from './bruno';
export * from './scriptConverter';

// ---------------------------------------------------------------------------
// Variable syntax conversion: {{var}} → <<var>>
// ---------------------------------------------------------------------------

/**
 * Replace all occurrences of {{variableName}} with <<variableName>> in a string.
 */
export const convertMustacheToAngleBrackets = (text: string): string =>
  text.replace(/\{\{([^}]+)\}\}/g, '<<$1>>');

/**
 * Deep-walk any value (object, array, string) and convert every
 * {{var}} reference to <<var>>. Non-string leaves are returned as-is.
 */
export const convertMustacheVarsDeep = <T>(value: T): T => {
  if (typeof value === 'string') {
    return convertMustacheToAngleBrackets(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(convertMustacheVarsDeep) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = convertMustacheVarsDeep(v);
    }
    return out as T;
  }
  return value;
};
