/**
 * Tests for src/utils/curlParser.ts — cURL command parser.
 *
 * The parseCurlCommand function converts a raw cURL command string into
 * a structured ApiRequest object. This is the primary way users import
 * requests from other tools.
 */
import { describe, it, expect } from 'vitest';
import { parseCurlCommand } from '../src/utils/curlParser';

// ─── Basic parsing ───────────────────────────────────────────────────────────

describe('parseCurlCommand — basic', () => {
  it('parses a simple GET request', () => {
    const result = parseCurlCommand('curl https://api.example.com/users');
    expect(result).not.toBeNull();
    expect(result!.method).toBe('GET');
    expect(result!.url).toBe('https://api.example.com/users');
  });

  it('returns null for non-curl input', () => {
    const result = parseCurlCommand('wget https://example.com');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseCurlCommand('');
    expect(result).toBeNull();
  });

  it('handles line continuations (backslash + newline)', () => {
    const cmd = `curl \\\n  -X POST \\\n  https://api.example.com/data`;
    const result = parseCurlCommand(cmd);
    expect(result).not.toBeNull();
    expect(result!.method).toBe('POST');
    expect(result!.url).toBe('https://api.example.com/data');
  });

  it('handles Windows line continuations (backslash + \\r\\n)', () => {
    const cmd = `curl \\\r\n  https://api.example.com/data`;
    const result = parseCurlCommand(cmd);
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://api.example.com/data');
  });

  it('handles URL where %27 (encoded quote) acts as the closing single quote', () => {
    // Some tools URL-encode the closing quote instead of emitting a literal '
    // e.g. curl 'https://example.com/path?param=value%27 --header 'X-Foo: bar'
    // Without the fix, "param" gets value "value' --header" instead of "value'"
    const cmd = `curl --location --request PUT 'https://example.com/resource?rawConfig=true%27 \\
--header 'X-Tenant: 12345' \\
--header 'Content-Type: application/json'`;
    const result = parseCurlCommand(cmd);
    expect(result).not.toBeNull();
    // query params are extracted from URL and stored separately
    expect(result!.url).toBe('https://example.com/resource');
    const rawConfigParam = result!.params.find(p => p.key === 'rawConfig');
    expect(rawConfigParam?.value).toBe('true'); // %27 was the closing shell quote, not part of the value
    const tenant = result!.headers.find(h => h.key === 'X-Tenant');
    expect(tenant?.value).toBe('12345');
  });

  it('parses real-world PUT with %27-terminated URL, Bearer JWT, and JSON body', () => {
    // Regression: URL ends with %27 (URL-encoded ') instead of a literal closing quote.
    // This caused the query param rawConfig to absorb " --header" into its value.
    const JWT = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.dummy-signature';
    const cmd =
      `curl --location --request PUT 'https://idp.internal.example.com/identity-providers/ae42a505-cbd8-4a13-b171-d1d73de72b93?rawConfig=true%27 \\\n` +
      `--header 'Authorization: Bearer ${JWT}' \\\n` +
      `--header 'X-Identity-Zone-Id: 1000010149' \\\n` +
      `--header 'Content-Type: application/json' \\\n` +
      `--data '{"id":"ae42a505-cbd8-4a13-b171-d1d73de72b93","active":true}'`;

    const result = parseCurlCommand(cmd);
    expect(result).not.toBeNull();

    // Method and URL base
    expect(result!.method).toBe('PUT');
    expect(result!.url).toBe('https://idp.internal.example.com/identity-providers/ae42a505-cbd8-4a13-b171-d1d73de72b93');

    // Query param must be rawConfig=true' — NOT "true' --header ..."
    const rawConfigParam = result!.params.find(p => p.key === 'rawConfig');
    expect(rawConfigParam).toBeDefined();
    expect(rawConfigParam!.value).toBe('true');

    // Bearer token extracted into auth, not left as a header
    expect(result!.auth.type).toBe('bearer');
    expect(result!.auth.bearer!.token).toBe(JWT);

    // X-Identity-Zone-Id header present
    const zoneHeader = result!.headers.find(h => h.key === 'X-Identity-Zone-Id');
    expect(zoneHeader?.value).toBe('1000010149');

    // JSON body
    expect(result!.body.type).toBe('json');
  });
});

// ─── HTTP methods ────────────────────────────────────────────────────────────

describe('parseCurlCommand — methods', () => {
  it('parses -X POST', () => {
    const result = parseCurlCommand('curl -X POST https://api.example.com');
    expect(result!.method).toBe('POST');
  });

  it('parses --request PUT', () => {
    const result = parseCurlCommand('curl --request PUT https://api.example.com');
    expect(result!.method).toBe('PUT');
  });

  it('parses combined -XDELETE', () => {
    const result = parseCurlCommand('curl -XDELETE https://api.example.com/item/1');
    expect(result!.method).toBe('DELETE');
  });

  it('parses -X PATCH', () => {
    const result = parseCurlCommand('curl -X PATCH https://api.example.com');
    expect(result!.method).toBe('PATCH');
  });

  it('defaults to GET when no method specified', () => {
    const result = parseCurlCommand('curl https://api.example.com');
    expect(result!.method).toBe('GET');
  });

  it('auto-sets POST when -d is used without -X', () => {
    const result = parseCurlCommand('curl -d "data" https://api.example.com');
    expect(result!.method).toBe('POST');
  });
});

// ─── Headers ─────────────────────────────────────────────────────────────────

describe('parseCurlCommand — headers', () => {
  it('parses a single -H header', () => {
    const result = parseCurlCommand("curl -H 'Content-Type: application/json' https://api.example.com");
    expect(result!.headers.length).toBeGreaterThanOrEqual(1);
    const ct = result!.headers.find(h => h.key === 'Content-Type');
    expect(ct).toBeDefined();
    expect(ct!.value).toBe('application/json');
  });

  it('parses multiple headers', () => {
    const cmd = `curl -H 'Authorization: Bearer token123' -H 'Accept: application/json' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    // Authorization header is extracted into auth.bearer, so only Accept remains in headers
    expect(result!.headers.find(h => h.key === 'Accept')!.value).toBe('application/json');
    expect(result!.auth.type).toBe('bearer');
    expect(result!.auth.bearer!.token).toBe('token123');
  });

  it('parses --header long form', () => {
    const result = parseCurlCommand("curl --header 'X-Custom: value' https://api.example.com");
    const h = result!.headers.find(h => h.key === 'X-Custom');
    expect(h).toBeDefined();
    expect(h!.value).toBe('value');
  });

  it('handles headers with colons in value', () => {
    const result = parseCurlCommand("curl -H 'Authorization: Bearer abc:def:ghi' https://api.example.com");
    // Authorization: Bearer is extracted into auth object, preserving full token with colons
    expect(result!.auth.type).toBe('bearer');
    expect(result!.auth.bearer!.token).toBe('abc:def:ghi');
  });
});

// ─── Body data ───────────────────────────────────────────────────────────────

describe('parseCurlCommand — body', () => {
  it('parses JSON body with -d and Content-Type header', () => {
    const cmd = `curl -X POST -H 'Content-Type: application/json' -d '{"name":"test"}' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('json');
    expect(result!.body.raw).toBeDefined();
    // The parser pretty-prints JSON
    expect(JSON.parse(result!.body.raw!)).toEqual({ name: 'test' });
  });

  it('auto-detects JSON body from content shape (without Content-Type header)', () => {
    const cmd = `curl -X POST -d '{"key":"value"}' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('json');
  });

  it('parses URL-encoded body with Content-Type header', () => {
    const cmd = `curl -X POST -H 'Content-Type: application/x-www-form-urlencoded' -d 'key=value&foo=bar' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('x-www-form-urlencoded');
    expect(result!.body.urlencoded).toBeDefined();
    expect(result!.body.urlencoded!.length).toBe(2);
    expect(result!.body.urlencoded![0].key).toBe('key');
    expect(result!.body.urlencoded![0].value).toBe('value');
  });

  it('parses --data-urlencode option', () => {
    const cmd = `curl --data-urlencode 'field=value' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('x-www-form-urlencoded');
    expect(result!.body.urlencoded![0].key).toBe('field');
    expect(result!.body.urlencoded![0].value).toBe('value');
  });

  it('parses --data-raw option as body data', () => {
    const cmd = `curl -X POST --data-raw '{"test":true}' -H 'Content-Type: application/json' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('json');
  });

  it('concatenates multiple -d options with &', () => {
    const cmd = `curl -X POST -d 'a=1' -d 'b=2' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    // Should combine as "a=1&b=2", detected as urlencoded
    expect(result!.body.type).toBe('x-www-form-urlencoded');
    expect(result!.body.urlencoded).toBeDefined();
  });
});

// ─── Form data ───────────────────────────────────────────────────────────────

describe('parseCurlCommand — form data', () => {
  it('parses -F form field', () => {
    const cmd = `curl -F 'name=John' https://api.example.com/upload`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('form-data');
    expect(result!.body.formData).toBeDefined();
    expect(result!.body.formData![0].key).toBe('name');
    expect(result!.body.formData![0].value).toBe('John');
  });

  it('parses --form long option', () => {
    const cmd = `curl --form 'file=@photo.jpg' https://api.example.com/upload`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('form-data');
    expect(result!.body.formData![0].key).toBe('file');
    expect(result!.body.formData![0].value).toContain('photo.jpg');
  });

  it('parses multiple -F fields', () => {
    const cmd = `curl -F 'name=John' -F 'age=30' https://api.example.com/upload`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.formData).toHaveLength(2);
  });
});

// ─── Authentication ──────────────────────────────────────────────────────────

describe('parseCurlCommand — authentication', () => {
  it('parses -u basic auth', () => {
    const cmd = `curl -u 'admin:password123' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.auth.type).toBe('basic');
    expect(result!.auth.basic!.username).toBe('admin');
    expect(result!.auth.basic!.password).toBe('password123');
  });

  it('parses --user long option', () => {
    const cmd = `curl --user 'user:pass' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.auth.type).toBe('basic');
    expect(result!.auth.basic!.username).toBe('user');
  });

  it('handles -u without password', () => {
    const cmd = `curl -u 'admin' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.auth.type).toBe('basic');
    expect(result!.auth.basic!.username).toBe('admin');
    expect(result!.auth.basic!.password).toBe('');
  });
});

// ─── Special headers ─────────────────────────────────────────────────────────

describe('parseCurlCommand — special flags', () => {
  it('parses -A user agent', () => {
    const cmd = `curl -A 'MyApp/1.0' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.headers.find(h => h.key === 'User-Agent')!.value).toBe('MyApp/1.0');
  });

  it('parses -e referer', () => {
    const cmd = `curl -e 'https://referer.com' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.headers.find(h => h.key === 'Referer')!.value).toBe('https://referer.com');
  });

  it('parses -b cookie', () => {
    const cmd = `curl -b 'session=abc123' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.headers.find(h => h.key === 'Cookie')!.value).toBe('session=abc123');
  });

  it('parses --compressed flag', () => {
    const cmd = `curl --compressed https://api.example.com`;
    const result = parseCurlCommand(cmd);
    const ae = result!.headers.find(h => h.key === 'Accept-Encoding');
    expect(ae).toBeDefined();
    expect(ae!.value).toContain('gzip');
  });

  it('ignores -L, -k, -v, -s, -i flags without error', () => {
    const cmd = `curl -L -k -v -s -i https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result).not.toBeNull();
    // URL is reconstructed via new URL() as origin + pathname, adding trailing /
    expect(result!.url).toBe('https://api.example.com/');
  });
});

// ─── URL handling ────────────────────────────────────────────────────────────

describe('parseCurlCommand — URL handling', () => {
  it('extracts query parameters into params array', () => {
    const result = parseCurlCommand('curl "https://api.example.com/search?q=test&page=1"');
    // Parser strips query string from URL and populates params array
    expect(result!.url).toBe('https://api.example.com/search');
    expect(result!.params.length).toBe(2);
    expect(result!.params.find(p => p.key === 'q')!.value).toBe('test');
    expect(result!.params.find(p => p.key === 'page')!.value).toBe('1');
  });

  it('handles URL with port number', () => {
    const result = parseCurlCommand('curl http://localhost:3000/api');
    expect(result!.url).toBe('http://localhost:3000/api');
  });
});

// ─── Complex real-world commands ─────────────────────────────────────────────

describe('parseCurlCommand — real-world examples', () => {
  it('parses a complete POST with auth and JSON body', () => {
    const cmd = `curl -X POST \\
      -H 'Content-Type: application/json' \\
      -H 'Authorization: Bearer my-token' \\
      -d '{"name":"Test","email":"test@example.com"}' \\
      https://api.example.com/users`;
    const result = parseCurlCommand(cmd);
    expect(result!.method).toBe('POST');
    expect(result!.url).toBe('https://api.example.com/users');
    expect(result!.body.type).toBe('json');
    // Authorization: Bearer header is extracted into auth object
    expect(result!.auth.type).toBe('bearer');
    expect(result!.auth.bearer!.token).toBe('my-token');
  });

  it('parses a GitHub API-style request', () => {
    const cmd = `curl -H "Accept: application/vnd.github+json" -H "Authorization: Bearer ghp_1234" https://api.github.com/repos/owner/repo`;
    const result = parseCurlCommand(cmd);
    expect(result!.method).toBe('GET');
    // Authorization header extracted to auth, so only Accept remains
    expect(result!.headers).toHaveLength(1);
    expect(result!.headers[0].key).toBe('Accept');
    expect(result!.auth.type).toBe('bearer');
    expect(result!.auth.bearer!.token).toBe('ghp_1234');
    expect(result!.url).toBe('https://api.github.com/repos/owner/repo');
  });

  it('all parsed headers are enabled', () => {
    const cmd = `curl -H 'A: 1' -H 'B: 2' https://example.com`;
    const result = parseCurlCommand(cmd);
    result!.headers.forEach(h => expect(h.enabled).toBe(true));
  });

  it('all parsed headers have an id', () => {
    const cmd = `curl -H 'X: 1' https://example.com`;
    const result = parseCurlCommand(cmd);
    result!.headers.forEach(h => expect(h.id).toBeDefined());
  });
});

// ─── Additional coverage tests ───────────────────────────────────────────────

describe('parseCurlCommand — cookie file reference', () => {
  it('skips -b when value starts with @ (cookie file)', () => {
    const cmd = `curl -b @/tmp/cookies.txt https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result).not.toBeNull();
    // File-based cookies are NOT added as a Cookie header
    expect(result!.headers.find(h => h.key === 'Cookie')).toBeUndefined();
  });

  it('adds -b value as Cookie header when not a file', () => {
    const cmd = `curl --cookie 'session=abc' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.headers.find(h => h.key === 'Cookie')!.value).toBe('session=abc');
  });
});

describe('parseCurlCommand — unknown flags', () => {
  it('skips unknown flag and its value argument', () => {
    // --max-time 30 is unknown; parser should skip it and its argument
    const cmd = `curl --max-time 30 https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result).not.toBeNull();
    expect(result!.url).toContain('api.example.com');
  });

  it('skips unknown flag whose next token starts with -', () => {
    const cmd = `curl --unknown -X POST https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result).not.toBeNull();
    expect(result!.method).toBe('POST');
  });
});

describe('parseCurlCommand — URL without protocol', () => {
  it('assumes https for URL with a dot but no protocol', () => {
    const cmd = `curl api.example.com/users`;
    const result = parseCurlCommand(cmd);
    expect(result).not.toBeNull();
    expect(result!.url).toContain('https://api.example.com');
  });

  it('handles URL without a dot and no protocol', () => {
    const cmd = `curl localhost:3000/api`;
    const result = parseCurlCommand(cmd);
    expect(result).not.toBeNull();
  });
});

describe('parseCurlCommand — XML and plain text body', () => {
  it('parses XML body with Content-Type text/xml', () => {
    const cmd = `curl -X POST -H 'Content-Type: text/xml' -d '<root><item/></root>' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('raw');
    expect(result!.body.raw).toBe('<root><item/></root>');
  });

  it('parses XML body with Content-Type application/xml', () => {
    const cmd = `curl -X POST -H 'Content-Type: application/xml' -d '<data>test</data>' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('raw');
  });

  it('parses plain text body with Content-Type text/plain', () => {
    const cmd = `curl -X POST -H 'Content-Type: text/plain' -d 'hello world' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('raw');
    expect(result!.body.raw).toBe('hello world');
  });
});

describe('parseCurlCommand — Basic auth from Authorization header', () => {
  it('decodes base64 Basic auth from Authorization header', () => {
    // base64("admin:secret") = "YWRtaW46c2VjcmV0"
    const cmd = `curl -H 'Authorization: Basic YWRtaW46c2VjcmV0' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.auth.type).toBe('basic');
    expect(result!.auth.basic!.username).toBe('admin');
    expect(result!.auth.basic!.password).toBe('secret');
    // Authorization header should be removed
    expect(result!.headers.find(h => h.key === 'Authorization')).toBeUndefined();
  });

  it('handles Basic auth with only username (no colon)', () => {
    // base64("admin") = "YWRtaW4="
    const cmd = `curl -H 'Authorization: Basic YWRtaW4=' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.auth.type).toBe('basic');
    expect(result!.auth.basic!.username).toBe('admin');
    expect(result!.auth.basic!.password).toBe('');
  });
});

describe('parseCurlCommand — API key detection', () => {
  it('detects X-API-Key header as api-key auth', () => {
    const cmd = `curl -H 'X-API-Key: my-key-123' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.auth.type).toBe('api-key');
    expect(result!.auth.apiKey!.key).toBe('X-API-Key');
    expect(result!.auth.apiKey!.value).toBe('my-key-123');
    expect(result!.auth.apiKey!.addTo).toBe('header');
  });

  it('detects api_key query param as api-key auth', () => {
    const cmd = `curl "https://api.example.com/data?api_key=abc123"`;
    const result = parseCurlCommand(cmd);
    expect(result!.auth.type).toBe('api-key');
    expect(result!.auth.apiKey!.key).toBe('api_key');
    expect(result!.auth.apiKey!.value).toBe('abc123');
    expect(result!.auth.apiKey!.addTo).toBe('query');
  });

  it('does not detect API key when -u auth is present', () => {
    const cmd = `curl -u admin:pass -H 'X-API-Key: extra' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    // -u sets basic auth, so API key header stays as regular header
    expect(result!.auth.type).toBe('basic');
  });
});

describe('parseCurlCommand — auto-detect body type', () => {
  it('auto-detects form data from key=value without content type', () => {
    const cmd = `curl -X POST -d 'username=admin&password=secret' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('x-www-form-urlencoded');
  });

  it('falls back to raw body for non-JSON non-form data', () => {
    const cmd = `curl -X POST -d 'just some plain text here' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('raw');
    expect(result!.body.raw).toBe('just some plain text here');
  });

  it('handles invalid JSON that looks like JSON but has errors → falls back', () => {
    const cmd = `curl -X POST -d '{invalid json here}' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    // Starts with { and ends with }, but fails JSON.parse, so tries form detection
    expect(result!.body).toBeDefined();
  });

  it('urlencoded body with item that has no = sign treats as key-only', () => {
    const cmd = `curl -X POST -H 'Content-Type: application/x-www-form-urlencoded' -d 'standalone' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('x-www-form-urlencoded');
    expect(result!.body.urlencoded!.some(p => p.key === 'standalone' && p.value === '')).toBe(true);
  });
});

describe('parseCurlCommand — --compressed duplicate check', () => {
  it('does not duplicate Accept-Encoding if already present before --compressed', () => {
    // Header is processed before --compressed in token order
    const cmd = `curl -H 'Accept-Encoding: gzip' --compressed https://api.example.com`;
    const result = parseCurlCommand(cmd);
    const aeHeaders = result!.headers.filter(h => h.key.toLowerCase() === 'accept-encoding');
    expect(aeHeaders).toHaveLength(1);
  });
});

describe('parseCurlCommand — --data-binary and --data-ascii', () => {
  it('handles --data-binary as body data', () => {
    const cmd = `curl -X POST --data-binary '{"test":true}' -H 'Content-Type: application/json' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('json');
  });

  it('handles --data-ascii as body data', () => {
    const cmd = `curl -X POST --data-ascii 'hello' -H 'Content-Type: text/plain' https://api.example.com`;
    const result = parseCurlCommand(cmd);
    expect(result!.body.type).toBe('raw');
  });
});
