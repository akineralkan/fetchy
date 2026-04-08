import { ApiRequest, KeyValue } from '../types';
import { replaceVariables } from './variables';

/**
 * Build a fully URL-encoded request URL by stripping the raw (display) query
 * from request.url and re-appending params from request.params using
 * encodeURIComponent so values with quotes, JSON, spaces etc. are safe.
 * <<variable>> placeholders in both keys and values are resolved first.
 */
function buildEncodedRequestUrl(request: ApiRequest, variables: KeyValue[]): string {
  let url = replaceVariables(request.url, variables, []);
  const qIndex = url.indexOf('?');
  if (qIndex >= 0) {
    url = url.substring(0, qIndex);
  }
  const enabledParams = request.params.filter(p => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const qs = enabledParams
      .map(p => {
        const key = encodeURIComponent(replaceVariables(p.key, variables, []));
        const value = encodeURIComponent(replaceVariables(p.value, variables, []));
        return `${key}=${value}`;
      })
      .join('&');
    url = `${url}?${qs}`;
  }
  return url;
}

// Generate cURL command from request
export const generateCurl = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = buildEncodedRequestUrl(request, variables);
  let curl = `curl -X ${request.method} '${url}'`;

  // Add headers
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      curl += ` \\\n  -H '${header.key}: ${value}'`;
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    curl += ` \\\n  -H 'Authorization: Bearer ${token}'`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    curl += ` \\\n  -H 'Authorization: Basic ${credentials}'`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    curl += ` \\\n  -H '${request.auth.apiKey.key}: ${value}'`;
  }

  // Add body
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      curl += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`;
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const data = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `${encodeURIComponent(u.key)}=${encodeURIComponent(replaceVariables(u.value, variables, []))}`)
      .join('&');
    curl += ` \\\n  -d '${data}'`;
  }

  return curl;
};

// Generate JavaScript fetch code from request
export const generateJavaScript = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = buildEncodedRequestUrl(request, variables);
  let code = `fetch('${url}', {\n  method: '${request.method}'`;

  // Add headers
  const headers: Record<string, string> = {};
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      headers[header.key] = value;
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    headers['Authorization'] = `Bearer ${token}`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    headers['Authorization'] = `Basic ${credentials}`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    headers[request.auth.apiKey.key] = value;
  }

  if (Object.keys(headers).length > 0) {
    code += `,\n  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, '\n  ')}`;
  }

  // Add body
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      code += `,\n  body: ${body}`;
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const params = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `${encodeURIComponent(u.key)}=${encodeURIComponent(replaceVariables(u.value, variables, []))}`)
      .join('&');
    code += `,\n  body: '${params}'`;
  }

  code += `\n})\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error('Error:', error));`;
  return code;
};

// Generate Python requests code from request
export const generatePython = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = buildEncodedRequestUrl(request, variables);
  let code = `import requests\n\n`;

  code += `url = '${url}'\n`;

  // Add headers
  const headers: string[] = [];
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      headers.push(`    '${header.key}': '${value}'`);
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    headers.push(`    'Authorization': 'Bearer ${token}'`);
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    headers.push(`    'Authorization': 'Basic ${credentials}'`);
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    headers.push(`    '${request.auth.apiKey.key}': '${value}'`);
  }

  if (headers.length > 0) {
    code += `headers = {\n${headers.join(',\n')}\n}\n`;
  }

  // Add body
  let bodyParam = '';
  if (request.body.type === 'json' && request.body.raw) {
    const body = replaceVariables(request.body.raw, variables, []);
    bodyParam = `, json=${body}`;
  } else if (request.body.type === 'raw' && request.body.raw) {
    const body = replaceVariables(request.body.raw, variables, []);
    bodyParam = `, data='${body.replace(/'/g, "\\'")}'`;
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const data = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `    '${u.key}': '${replaceVariables(u.value, variables, [])}'`)
      .join(',\n');
    code += `data = {\n${data}\n}\n`;
    bodyParam = ', data=data';
  }

  const headersParam = headers.length > 0 ? ', headers=headers' : '';
  code += `\nresponse = requests.${request.method.toLowerCase()}(url${headersParam}${bodyParam})\n`;
  code += `print(response.json())`;

  return code;
};

// Generate Java HttpClient code from request
export const generateJava = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = buildEncodedRequestUrl(request, variables);
  let code = `import java.net.http.HttpClient;\nimport java.net.http.HttpRequest;\nimport java.net.http.HttpResponse;\nimport java.net.URI;\n\n`;

  code += `public class ApiRequest {\n`;
  code += `    public static void main(String[] args) throws Exception {\n`;
  code += `        HttpClient client = HttpClient.newHttpClient();\n\n`;
  code += `        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()\n`;
  code += `            .uri(URI.create("${url}"))\n`;
  code += `            .method("${request.method}", `;

  // Add body
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      code += `HttpRequest.BodyPublishers.ofString(${JSON.stringify(body)}))`;
    } else {
      code += `HttpRequest.BodyPublishers.noBody())`;
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const data = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `${encodeURIComponent(u.key)}=${encodeURIComponent(replaceVariables(u.value, variables, []))}`)
      .join('&');
    code += `HttpRequest.BodyPublishers.ofString("${data}"))`;
  } else {
    code += `HttpRequest.BodyPublishers.noBody())`;
  }

  // Add headers
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      code += `\n            .header("${header.key}", "${value}")`;
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    code += `\n            .header("Authorization", "Bearer ${token}")`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    code += `\n            .header("Authorization", "Basic ${credentials}")`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    code += `\n            .header("${request.auth.apiKey.key}", "${value}")`;
  }

  code += `;\n\n`;
  code += `        HttpRequest request = requestBuilder.build();\n`;
  code += `        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\n\n`;
  code += `        System.out.println(response.body());\n`;
  code += `    }\n`;
  code += `}\n`;

  return code;
};

// Generate .NET Core HttpClient code from request
export const generateDotNet = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = buildEncodedRequestUrl(request, variables);
  let code = `using System;\nusing System.Net.Http;\nusing System.Text;\nusing System.Threading.Tasks;\n\n`;

  code += `class Program\n{\n`;
  code += `    static async Task Main(string[] args)\n    {\n`;
  code += `        using var client = new HttpClient();\n\n`;

  // Add headers
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      code += `        client.DefaultRequestHeaders.Add("${header.key}", "${value}");\n`;
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    code += `        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "${token}");\n`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    code += `        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", "${credentials}");\n`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    code += `        client.DefaultRequestHeaders.Add("${request.auth.apiKey.key}", "${value}");\n`;
  }

  code += `\n`;

  // Add body and request
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      code += `        var content = new StringContent(${JSON.stringify(body)}, Encoding.UTF8, "application/json");\n`;
      code += `        var response = await client.${request.method.charAt(0) + request.method.slice(1).toLowerCase()}Async("${url}", content);\n`;
    } else {
      code += `        var response = await client.${request.method.charAt(0) + request.method.slice(1).toLowerCase()}Async("${url}");\n`;
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const data = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `            {"${u.key}", "${replaceVariables(u.value, variables, [])}"}`)
      .join(',\n');
    code += `        var content = new FormUrlEncodedContent(new[]\n        {\n${data}\n        });\n`;
    code += `        var response = await client.${request.method.charAt(0) + request.method.slice(1).toLowerCase()}Async("${url}", content);\n`;
  } else {
    code += `        var response = await client.${request.method.charAt(0) + request.method.slice(1).toLowerCase()}Async("${url}");\n`;
  }

  code += `        var responseBody = await response.Content.ReadAsStringAsync();\n`;
  code += `        Console.WriteLine(responseBody);\n`;
  code += `    }\n`;
  code += `}\n`;

  return code;
};

// Generate Go net/http code from request
export const generateGo = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = buildEncodedRequestUrl(request, variables);
  let code = `package main\n\nimport (\n    "bytes"\n    "fmt"\n    "io"\n    "net/http"\n)\n\n`;

  code += `func main() {\n`;

  // Add body
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      code += `    jsonData := []byte(${JSON.stringify(body)})\n`;
      code += `    req, err := http.NewRequest("${request.method}", "${url}", bytes.NewBuffer(jsonData))\n`;
    } else {
      code += `    req, err := http.NewRequest("${request.method}", "${url}", nil)\n`;
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
    const data = request.body.urlencoded
      .filter(u => u.enabled)
      .map(u => `${encodeURIComponent(u.key)}=${encodeURIComponent(replaceVariables(u.value, variables, []))}`)
      .join('&');
    code += `    data := []byte("${data}")\n`;
    code += `    req, err := http.NewRequest("${request.method}", "${url}", bytes.NewBuffer(data))\n`;
  } else {
    code += `    req, err := http.NewRequest("${request.method}", "${url}", nil)\n`;
  }

  code += `    if err != nil {\n        panic(err)\n    }\n\n`;

  // Add headers
  for (const header of request.headers) {
    if (header.enabled) {
      const value = replaceVariables(header.value, variables, []);
      code += `    req.Header.Set("${header.key}", "${value}")\n`;
    }
  }

  // Add auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    const token = replaceVariables(request.auth.bearer.token, variables, []);
    code += `    req.Header.Set("Authorization", "Bearer ${token}")\n`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    code += `    req.SetBasicAuth("${request.auth.basic.username}", "${request.auth.basic.password}")\n`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
    const value = replaceVariables(request.auth.apiKey.value, variables, []);
    code += `    req.Header.Set("${request.auth.apiKey.key}", "${value}")\n`;
  }

  code += `\n    client := &http.Client{}\n`;
  code += `    resp, err := client.Do(req)\n`;
  code += `    if err != nil {\n        panic(err)\n    }\n`;
  code += `    defer resp.Body.Close()\n\n`;
  code += `    body, err := io.ReadAll(resp.Body)\n`;
  code += `    if err != nil {\n        panic(err)\n    }\n\n`;
  code += `    fmt.Println(string(body))\n`;
  code += `}\n`;

  return code;
};

// Generate Rust reqwest code from request
export const generateRust = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = buildEncodedRequestUrl(request, variables);
  let code = `use reqwest::header::{HeaderMap, HeaderValue};\nuse std::error::Error;\n\n`;

  code += `#[tokio::main]\nasync fn main() -> Result<(), Box<dyn Error>> {\n`;
  code += `    let client = reqwest::Client::new();\n\n`;

  // Add headers
  const hasHeaders = request.headers.some(h => h.enabled) || request.auth.type !== 'none';
  if (hasHeaders) {
    code += `    let mut headers = HeaderMap::new();\n`;

    for (const header of request.headers) {
      if (header.enabled) {
        const value = replaceVariables(header.value, variables, []);
        code += `    headers.insert("${header.key}", HeaderValue::from_static("${value}"));\n`;
      }
    }

    // Add auth headers
    if (request.auth.type === 'bearer' && request.auth.bearer) {
      const token = replaceVariables(request.auth.bearer.token, variables, []);
      code += `    headers.insert("Authorization", HeaderValue::from_static("Bearer ${token}"));\n`;
    } else if (request.auth.type === 'basic' && request.auth.basic) {
      const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
      code += `    headers.insert("Authorization", HeaderValue::from_static("Basic ${credentials}"));\n`;
    } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
      const value = replaceVariables(request.auth.apiKey.value, variables, []);
      code += `    headers.insert("${request.auth.apiKey.key}", HeaderValue::from_static("${value}"));\n`;
    }

    code += `\n`;
  }

  code += `    let response = client.${request.method.toLowerCase()}("${url}")\n`;
  if (hasHeaders) {
    code += `        .headers(headers)\n`;
  }

  // Add body
  if (request.body.type === 'json' && request.body.raw) {
    const body = replaceVariables(request.body.raw, variables, []);
    code += `        .body(${JSON.stringify(body)})\n`;
  } else if (request.body.type === 'raw' && request.body.raw) {
    const body = replaceVariables(request.body.raw, variables, []);
    code += `        .body("${body.replace(/"/g, '\\"')}")\n`;
  }

  code += `        .send()\n        .await?;\n\n`;
  code += `    let body = response.text().await?;\n`;
  code += `    println!("{}", body);\n\n`;
  code += `    Ok(())\n`;
  code += `}\n`;

  return code;
};

// Generate C++ libcurl code from request
export const generateCpp = (request: ApiRequest, variables: KeyValue[] = []): string => {
  const url = buildEncodedRequestUrl(request, variables);
  let code = `#include <iostream>\n#include <string>\n#include <curl/curl.h>\n\n`;

  code += `static size_t WriteCallback(void *contents, size_t size, size_t nmemb, void *userp) {\n`;
  code += `    ((std::string*)userp)->append((char*)contents, size * nmemb);\n`;
  code += `    return size * nmemb;\n`;
  code += `}\n\n`;

  code += `int main() {\n`;
  code += `    CURL *curl;\n`;
  code += `    CURLcode res;\n`;
  code += `    std::string readBuffer;\n\n`;
  code += `    curl = curl_easy_init();\n`;
  code += `    if(curl) {\n`;
  code += `        curl_easy_setopt(curl, CURLOPT_URL, "${url}");\n`;
  code += `        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "${request.method}");\n`;
  code += `        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);\n`;
  code += `        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);\n\n`;

  // Add headers
  const hasHeaders = request.headers.some(h => h.enabled) || request.auth.type !== 'none';
  if (hasHeaders) {
    code += `        struct curl_slist *headers = NULL;\n`;

    for (const header of request.headers) {
      if (header.enabled) {
        const value = replaceVariables(header.value, variables, []);
        code += `        headers = curl_slist_append(headers, "${header.key}: ${value}");\n`;
      }
    }

    // Add auth headers
    if (request.auth.type === 'bearer' && request.auth.bearer) {
      const token = replaceVariables(request.auth.bearer.token, variables, []);
      code += `        headers = curl_slist_append(headers, "Authorization: Bearer ${token}");\n`;
    } else if (request.auth.type === 'basic' && request.auth.basic) {
      const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
      code += `        headers = curl_slist_append(headers, "Authorization: Basic ${credentials}");\n`;
    } else if (request.auth.type === 'api-key' && request.auth.apiKey && request.auth.apiKey.addTo === 'header') {
      const value = replaceVariables(request.auth.apiKey.value, variables, []);
      code += `        headers = curl_slist_append(headers, "${request.auth.apiKey.key}: ${value}");\n`;
    }

    code += `        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);\n\n`;
  }

  // Add body
  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      const body = replaceVariables(request.body.raw, variables, []);
      code += `        const char* postData = ${JSON.stringify(body)};\n`;
      code += `        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postData);\n\n`;
    }
  }

  code += `        res = curl_easy_perform(curl);\n`;
  code += `        if(res != CURLE_OK) {\n`;
  code += `            std::cerr << "curl_easy_perform() failed: " << curl_easy_strerror(res) << std::endl;\n`;
  code += `        } else {\n`;
  code += `            std::cout << readBuffer << std::endl;\n`;
  code += `        }\n\n`;

  if (hasHeaders) {
    code += `        curl_slist_free_all(headers);\n`;
  }

  code += `        curl_easy_cleanup(curl);\n`;
  code += `    }\n`;
  code += `    return 0;\n`;
  code += `}\n`;

  return code;
};

