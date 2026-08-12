import { v4 as uuidv4 } from 'uuid';
import * as yaml from 'js-yaml';
import {
  Collection,
  ApiRequest,
  RequestFolder,
  KeyValue,
  HttpMethod,
  OpenAPISpec,
  OpenAPIOperation,
  OpenAPIParameter,
} from '../types';

// Convert OpenAPI parameter to KeyValue
const convertOpenAPIParameter = (param: OpenAPIParameter): KeyValue => ({
  id: uuidv4(),
  key: param.name,
  value: '',
  enabled: param.required || false,
  description: param.description,
});

// Convert OpenAPI operation to request
const convertOpenAPIOperation = (
  path: string,
  method: string,
  operation: OpenAPIOperation,
  baseUrl: string
): ApiRequest => {
  const headers: KeyValue[] = [];
  const params: KeyValue[] = [];

  if (operation.parameters) {
    for (const param of operation.parameters) {
      const kv = convertOpenAPIParameter(param);
      if (param.in === 'header') {
        headers.push(kv);
      } else if (param.in === 'query') {
        params.push(kv);
      }
    }
  }

  let body: ApiRequest['body'] = { type: 'none' };

  if (operation.requestBody?.content) {
    const contentTypes = Object.keys(operation.requestBody.content);
    if (contentTypes.includes('application/json')) {
      body = { type: 'json', raw: '{}' };
      headers.push({
        id: uuidv4(),
        key: 'Content-Type',
        value: 'application/json',
        enabled: true,
      });
    } else if (contentTypes.includes('application/x-www-form-urlencoded')) {
      body = { type: 'x-www-form-urlencoded', urlencoded: [] };
    } else if (contentTypes.includes('multipart/form-data')) {
      body = { type: 'form-data', formData: [] };
    }
  }

  // Replace path parameters with placeholders
  const processedPath = path.replace(/{(\w+)}/g, '<<$1>>');

  return {
    id: uuidv4(),
    name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
    method: method.toUpperCase() as HttpMethod,
    url: `${baseUrl}${processedPath}`,
    headers,
    params,
    body,
    auth: { type: 'none' },
  };
};

// Import OpenAPI specification
export const importOpenAPISpec = (content: string): Collection | null => {
  try {
    // Trim whitespace from content
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      throw new Error('Empty content provided');
    }

    let spec: OpenAPISpec;
    let parseError: Error | null = null;

    // Try to parse as JSON first, then YAML
    try {
      spec = JSON.parse(trimmedContent);
    } catch (jsonError) {
      parseError = jsonError as Error;
      try {
        const parsed = yaml.load(trimmedContent);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('YAML parsing returned invalid data');
        }
        spec = parsed as OpenAPISpec;
      } catch (yamlError) {
        throw new Error(`Failed to parse as JSON or YAML. JSON error: ${parseError.message}`);
      }
    }

    // Validate required fields
    if (!spec || typeof spec !== 'object') {
      throw new Error('Invalid OpenAPI specification: parsed content is not an object');
    }

    if (!spec.info) {
      throw new Error('Invalid OpenAPI specification: missing "info" field');
    }

    if (!spec.paths) {
      throw new Error('Invalid OpenAPI specification: no paths found');
    }

    if (typeof spec.paths !== 'object' || Object.keys(spec.paths).length === 0) {
      throw new Error('Invalid OpenAPI specification: paths object is empty');
    }

    const baseUrl = spec.servers?.[0]?.url || '';
    const folders: RequestFolder[] = [];

    // Group by tags if available
    const taggedRequests: Record<string, ApiRequest[]> = {};
    const untaggedRequests: ApiRequest[] = [];

    for (const [path, methods] of Object.entries(spec.paths)) {
      if (!methods || typeof methods !== 'object') continue;

      for (const [method, operation] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'query'].includes(method.toLowerCase())) {
          const request = convertOpenAPIOperation(path, method, operation as OpenAPIOperation, baseUrl);

          const tags = (operation as OpenAPIOperation).tags;
          if (tags && tags.length > 0) {
            const tag = tags[0];
            if (!taggedRequests[tag]) {
              taggedRequests[tag] = [];
            }
            taggedRequests[tag].push(request);
          } else {
            untaggedRequests.push(request);
          }
        }
      }
    }

    // Create folders for each tag
    for (const [tag, reqs] of Object.entries(taggedRequests)) {
      folders.push({
        id: uuidv4(),
        name: tag,
        requests: reqs,
        folders: [],
        expanded: true,
      });
    }

    return {
      id: uuidv4(),
      name: spec.info.title || 'Imported API',
      description: spec.info.description,
      folders,
      requests: untaggedRequests,
      variables: [],
      expanded: true,
    };
  } catch (error) {
    console.error('Error importing OpenAPI spec:', error);
    throw error; // Re-throw to provide better error messages to the user
  }
};
