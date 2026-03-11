import { v4 as uuidv4 } from 'uuid';
import { ApiRequest, KeyValue, HttpMethod } from '../types';

// Parse cURL command and convert to ApiRequest
export const parseCurlCommand = (curlCommand: string): ApiRequest | null => {
  try {
    // Normalize the cURL command: handle line continuations and multiple spaces
    let normalizedCmd = curlCommand
      .replace(/\\\r?\n/g, ' ')  // Handle line continuations
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();

    // Validate that this is a curl command
    if (!normalizedCmd.toLowerCase().startsWith('curl ')) {
      throw new Error('Not a valid cURL command');
    }

    // Remove 'curl ' prefix
    normalizedCmd = normalizedCmd.substring(5).trim();

    // Initialize request parts
    let method: HttpMethod = 'GET';
    let methodExplicitlySet = false;
    let url = '';
    const headers: KeyValue[] = [];
    let body: ApiRequest['body'] = { type: 'none' };
    let auth: ApiRequest['auth'] = { type: 'none' };
    const rawBodyData: string[] = []; // Collect multiple -d options

    // Helper to extract quoted strings
    const extractQuotedString = (str: string, startIndex: number): { value: string; endIndex: number } => {
      const quote = str[startIndex];
      // %27 is URL-encoded ' and %22 is URL-encoded " — treat them as closing quotes
      // when they appear inside the matching quoted string (e.g. curl URLs ending in %27)
      const encodedQuote = quote === "'" ? '%27' : quote === '"' ? '%22' : null;
      let endIndex = startIndex + 1;
      let value = '';
      let escaped = false;

      while (endIndex < str.length) {
        const char = str[endIndex];
        if (escaped) {
          value += char;
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          return { value, endIndex: endIndex + 1 };
        } else if (encodedQuote && str.startsWith(encodedQuote, endIndex)) {
          // URL-encoded closing quote — treat as the closing delimiter, do not include in value
          return { value, endIndex: endIndex + encodedQuote.length };
        } else {
          value += char;
        }
        endIndex++;
      }
      return { value, endIndex };
    };

    // Parse command into tokens
    const tokens: string[] = [];
    let i = 0;
    while (i < normalizedCmd.length) {
      // Skip whitespace
      while (i < normalizedCmd.length && normalizedCmd[i] === ' ') i++;
      if (i >= normalizedCmd.length) break;

      if (normalizedCmd[i] === '"' || normalizedCmd[i] === "'") {
        const { value, endIndex } = extractQuotedString(normalizedCmd, i);
        tokens.push(value);
        i = endIndex;
      } else {
        // Unquoted token
        let token = '';
        while (i < normalizedCmd.length && normalizedCmd[i] !== ' ') {
          token += normalizedCmd[i];
          i++;
        }
        tokens.push(token);
      }
    }


    // Process tokens
    i = 0;
    while (i < tokens.length) {
      const token = tokens[i];

      // Handle combined flags like -XPOST or -X POST
      if (token === '-X' || token === '--request') {
        // HTTP method
        i++;
        if (i < tokens.length) {
          method = tokens[i].toUpperCase() as HttpMethod;
          methodExplicitlySet = true;
        }
      } else if (token.startsWith('-X') && token.length > 2) {
        // Combined format like -XPOST
        method = token.substring(2).toUpperCase() as HttpMethod;
        methodExplicitlySet = true;
      } else if (token === '-H' || token === '--header') {
        // Header
        i++;
        if (i < tokens.length) {
          const headerStr = tokens[i];
          const colonIndex = headerStr.indexOf(':');
          if (colonIndex > 0) {
            const key = headerStr.substring(0, colonIndex).trim();
            const value = headerStr.substring(colonIndex + 1).trim();
            headers.push({
              id: uuidv4(),
              key,
              value,
              enabled: true,
            });
          }
        }
      } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary' || token === '--data-ascii') {
        // Request body - collect all -d options
        i++;
        if (i < tokens.length) {
          rawBodyData.push(tokens[i]);
        }
      } else if (token === '--data-urlencode') {
        // URL encoded data
        i++;
        if (i < tokens.length) {
          const data = tokens[i];
          if (body.type !== 'x-www-form-urlencoded') {
            body = { type: 'x-www-form-urlencoded', urlencoded: [] };
          }
          const eqIndex = data.indexOf('=');
          if (eqIndex > 0) {
            body.urlencoded = body.urlencoded || [];
            body.urlencoded.push({
              id: uuidv4(),
              key: data.substring(0, eqIndex),
              value: decodeURIComponent(data.substring(eqIndex + 1)),
              enabled: true,
            });
          }
        }
      } else if (token === '-F' || token === '--form') {
        // Form data
        i++;
        if (i < tokens.length) {
          const data = tokens[i];
          if (body.type !== 'form-data') {
            body = { type: 'form-data', formData: [] };
          }
          const eqIndex = data.indexOf('=');
          if (eqIndex > 0) {
            body.formData = body.formData || [];
            const key = data.substring(0, eqIndex);
            let value = data.substring(eqIndex + 1);
            // Handle file references (@filename)
            if (value.startsWith('@')) {
              value = `[File: ${value.substring(1)}]`;
            }
            body.formData.push({
              id: uuidv4(),
              key,
              value,
              enabled: true,
            });
          }
        }
      } else if (token === '-u' || token === '--user') {
        // Basic auth
        i++;
        if (i < tokens.length) {
          const credentials = tokens[i];
          const colonIndex = credentials.indexOf(':');
          if (colonIndex > 0) {
            auth = {
              type: 'basic',
              basic: {
                username: credentials.substring(0, colonIndex),
                password: credentials.substring(colonIndex + 1),
              },
            };
          } else {
            auth = {
              type: 'basic',
              basic: {
                username: credentials,
                password: '',
              },
            };
          }
        }
      } else if (token === '-b' || token === '--cookie') {
        // Cookies - add as Cookie header
        i++;
        if (i < tokens.length) {
          const cookieValue = tokens[i];
          // Check if it's a file reference
          if (!cookieValue.startsWith('@')) {
            headers.push({
              id: uuidv4(),
              key: 'Cookie',
              value: cookieValue,
              enabled: true,
            });
          }
        }
      } else if (token === '-A' || token === '--user-agent') {
        // User-Agent header
        i++;
        if (i < tokens.length) {
          headers.push({
            id: uuidv4(),
            key: 'User-Agent',
            value: tokens[i],
            enabled: true,
          });
        }
      } else if (token === '-e' || token === '--referer') {
        // Referer header
        i++;
        if (i < tokens.length) {
          headers.push({
            id: uuidv4(),
            key: 'Referer',
            value: tokens[i],
            enabled: true,
          });
        }
      } else if (token === '--compressed') {
        // Add Accept-Encoding header for compressed responses
        const hasAcceptEncoding = headers.some(h => h.key.toLowerCase() === 'accept-encoding');
        if (!hasAcceptEncoding) {
          headers.push({
            id: uuidv4(),
            key: 'Accept-Encoding',
            value: 'gzip, deflate, br',
            enabled: true,
          });
        }
      } else if (token === '-L' || token === '--location') {
        // Follow redirects - skip flag (usually handled by client)
      } else if (token === '-k' || token === '--insecure') {
        // Skip SSL verification - skip flag
      } else if (token === '-v' || token === '--verbose') {
        // Verbose mode - skip flag
      } else if (token === '-s' || token === '--silent') {
        // Silent mode - skip flag
      } else if (token === '-i' || token === '--include') {
        // Include headers in output - skip flag
      } else if (token.startsWith('-')) {
        // Skip unknown flags
        // Check if next token might be a value for this flag (not starting with - and not a URL)
        if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-') && !tokens[i + 1].startsWith('http')) {
          i++;
        }
      } else {
        // URL - can be with or without quotes
        if (!url && (token.startsWith('http://') || token.startsWith('https://') || token.includes('://'))) {
          url = token;
        } else if (!url && !token.startsWith('-')) {
          // Might be a URL without protocol - assume https
          url = token.includes('.') ? `https://${token}` : token;
        }
      }
      i++;
    }

    if (!url) {
      throw new Error('No URL found in cURL command');
    }

    // Find Content-Type header to determine body type
    const contentTypeHeader = headers.find(h => h.key.toLowerCase() === 'content-type');
    const contentType = contentTypeHeader?.value.toLowerCase() || '';

    // Process collected raw body data
    if (rawBodyData.length > 0) {
      const combinedData = rawBodyData.join('&');

      // Determine body type based on Content-Type header or data format
      if (contentType.includes('application/json') || contentType.includes('text/json')) {
        // JSON body
        try {
          // Try to parse and format JSON
          const parsed = JSON.parse(combinedData);
          body = { type: 'json', raw: JSON.stringify(parsed, null, 2) };
        } catch {
          body = { type: 'json', raw: combinedData };
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        // URL encoded form data
        body = { type: 'x-www-form-urlencoded', urlencoded: [] };
        const pairs = combinedData.split('&');
        for (const pair of pairs) {
          const eqIndex = pair.indexOf('=');
          if (eqIndex > 0) {
            body.urlencoded = body.urlencoded || [];
            body.urlencoded.push({
              id: uuidv4(),
              key: decodeURIComponent(pair.substring(0, eqIndex)),
              value: decodeURIComponent(pair.substring(eqIndex + 1)),
              enabled: true,
            });
          } else if (pair.trim()) {
            body.urlencoded = body.urlencoded || [];
            body.urlencoded.push({
              id: uuidv4(),
              key: decodeURIComponent(pair),
              value: '',
              enabled: true,
            });
          }
        }
      } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
        // XML body
        body = { type: 'raw', raw: combinedData };
      } else if (contentType.includes('text/plain')) {
        // Plain text body
        body = { type: 'raw', raw: combinedData };
      } else {
        // Try to auto-detect body type
        const trimmedData = combinedData.trim();

        // Check if it looks like JSON
        if ((trimmedData.startsWith('{') && trimmedData.endsWith('}')) ||
            (trimmedData.startsWith('[') && trimmedData.endsWith(']'))) {
          try {
            const parsed = JSON.parse(trimmedData);
            body = { type: 'json', raw: JSON.stringify(parsed, null, 2) };
          } catch {
            // Not valid JSON, check if it's form data
            if (trimmedData.includes('=') && !trimmedData.includes('\n')) {
              // Looks like form data
              body = { type: 'x-www-form-urlencoded', urlencoded: [] };
              const pairs = trimmedData.split('&');
              for (const pair of pairs) {
                const eqIndex = pair.indexOf('=');
                if (eqIndex > 0) {
                  body.urlencoded = body.urlencoded || [];
                  body.urlencoded.push({
                    id: uuidv4(),
                    key: decodeURIComponent(pair.substring(0, eqIndex)),
                    value: decodeURIComponent(pair.substring(eqIndex + 1)),
                    enabled: true,
                  });
                }
              }
            } else {
              body = { type: 'raw', raw: combinedData };
            }
          }
        } else if (trimmedData.includes('=') && !trimmedData.includes('\n') && !trimmedData.includes('<')) {
          // Looks like form data (key=value&key2=value2)
          body = { type: 'x-www-form-urlencoded', urlencoded: [] };
          const pairs = trimmedData.split('&');
          for (const pair of pairs) {
            const eqIndex = pair.indexOf('=');
            if (eqIndex > 0) {
              body.urlencoded = body.urlencoded || [];
              body.urlencoded.push({
                id: uuidv4(),
                key: decodeURIComponent(pair.substring(0, eqIndex)),
                value: decodeURIComponent(pair.substring(eqIndex + 1)),
                enabled: true,
              });
            }
          }
        } else {
          body = { type: 'raw', raw: combinedData };
        }
      }

      // Set method to POST if not explicitly set and we have body data
      if (!methodExplicitlySet) {
        method = 'POST';
      }
    }

    // Set method to POST if we have form data and method wasn't explicitly set
    if (!methodExplicitlySet && (body.type === 'form-data' || body.type === 'x-www-form-urlencoded')) {
      method = 'POST';
    }

    // Check for Bearer token in headers
    const authHeader = headers.find(h => h.key.toLowerCase() === 'authorization');
    if (authHeader && auth.type === 'none') {
      const value = authHeader.value;
      if (value.toLowerCase().startsWith('bearer ')) {
        auth = {
          type: 'bearer',
          bearer: {
            token: value.substring(7).trim(),
          },
        };
        // Remove the authorization header since we're using auth
        const authIndex = headers.indexOf(authHeader);
        if (authIndex > -1) {
          headers.splice(authIndex, 1);
        }
      } else if (value.toLowerCase().startsWith('basic ')) {
        // Basic auth from header
        try {
          const decoded = atob(value.substring(6).trim());
          const colonIndex = decoded.indexOf(':');
          auth = {
            type: 'basic',
            basic: {
              username: colonIndex > 0 ? decoded.substring(0, colonIndex) : decoded,
              password: colonIndex > 0 ? decoded.substring(colonIndex + 1) : '',
            },
          };
          const authIndex = headers.indexOf(authHeader);
          if (authIndex > -1) {
            headers.splice(authIndex, 1);
          }
        } catch {
          // Keep auth header if base64 decode fails
        }
      }
    }

    // Check for common API key headers
    const apiKeyHeaders = ['x-api-key', 'api-key', 'apikey', 'x-auth-token', 'x-access-token'];
    if (auth.type === 'none') {
      const apiKeyHeader = headers.find(h => apiKeyHeaders.includes(h.key.toLowerCase()));
      if (apiKeyHeader) {
        auth = {
          type: 'api-key',
          apiKey: {
            key: apiKeyHeader.key,
            value: apiKeyHeader.value,
            addTo: 'header',
          },
        };
        // Remove the api key header since we're using auth
        const apiKeyIndex = headers.indexOf(apiKeyHeader);
        if (apiKeyIndex > -1) {
          headers.splice(apiKeyIndex, 1);
        }
      }
    }

    // Parse URL to extract query params
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      // If URL parsing fails, try adding https://
      urlObj = new URL(`https://${url}`);
    }

    const params: KeyValue[] = [];
    urlObj.searchParams.forEach((value, key) => {
      params.push({
        id: uuidv4(),
        key,
        value,
        enabled: true,
      });
    });

    // Check for API key in query params
    if (auth.type === 'none') {
      const apiKeyParams = ['api_key', 'apikey', 'api-key', 'key', 'access_token', 'token'];
      const apiKeyParam = params.find(p => apiKeyParams.includes(p.key.toLowerCase()));
      if (apiKeyParam) {
        auth = {
          type: 'api-key',
          apiKey: {
            key: apiKeyParam.key,
            value: apiKeyParam.value,
            addTo: 'query',
          },
        };
        // Remove from params since we're using auth
        const paramIndex = params.indexOf(apiKeyParam);
        if (paramIndex > -1) {
          params.splice(paramIndex, 1);
        }
      }
    }

    // Generate a name from the URL
    const urlPath = urlObj.pathname || '/';
    const name = `${method} ${urlPath}`;

    return {
      id: uuidv4(),
      name,
      method,
      url: urlObj.origin + urlObj.pathname,
      headers,
      params,
      body,
      auth,
    };
  } catch (error) {
    console.error('Error parsing cURL command:', error);
    return null;
  }
};

