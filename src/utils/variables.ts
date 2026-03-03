import { ApiRequest, KeyValue } from '../types';

// Replace environment variables in string
export const replaceVariables = (
  text: string,
  variables: KeyValue[],
  envVariables: KeyValue[]
): string => {
  let result = text;

  // Combine all variables, collection variables take precedence over env variables
  // Build a map where later values (collection vars) override earlier ones (env vars)
  const variableMap = new Map<string, string>();

  // Helper to get effective value (currentValue > value > initialValue)
  const getEffectiveValue = (variable: KeyValue): string => {
    // Prefer currentValue if set and non-empty, otherwise use value, fallback to initialValue
    if (variable.currentValue !== undefined && variable.currentValue !== '') {
      return variable.currentValue;
    }
    if (variable.value !== undefined && variable.value !== '') {
      return variable.value;
    }
    return variable.initialValue || '';
  };

  // Add environment variables first
  for (const envVar of envVariables) {
    if (envVar.enabled) {
      variableMap.set(envVar.key, getEffectiveValue(envVar));
    }
  }

  // Add collection variables (will override env vars with same key)
  for (const variable of variables) {
    if (variable.enabled) {
      variableMap.set(variable.key, getEffectiveValue(variable));
    }
  }

  // Now replace all variables
  for (const [key, value] of variableMap) {
    const regex = new RegExp(`<<${key}>>`, 'g');
    result = result.replace(regex, value);
  }

  return result;
};

// Resolve all variables in a request object (for saving to history with actual values)
// Secret variables are NOT resolved - they remain as <<variableName>> placeholders
export const resolveRequestVariables = (
  request: ApiRequest,
  collectionVariables: KeyValue[],
  environmentVariables: KeyValue[]
): ApiRequest => {
  // Filter out secret variables - they should not be resolved for history
  const nonSecretVariables = [...collectionVariables, ...environmentVariables].filter(v => !v.isSecret);

  // Helper to replace in a string (only non-secret variables)
  const resolve = (text: string): string => replaceVariables(text, nonSecretVariables, []);

  // Deep clone the request to avoid mutating the original
  const resolved: ApiRequest = {
    ...request,
    url: resolve(request.url),
    headers: request.headers.map(h => ({
      ...h,
      value: resolve(h.value),
    })),
    params: request.params.map(p => ({
      ...p,
      value: resolve(p.value),
    })),
    body: {
      ...request.body,
      raw: request.body.raw ? resolve(request.body.raw) : request.body.raw,
      formData: request.body.formData?.map(f => ({
        ...f,
        value: resolve(f.value),
      })),
      urlencoded: request.body.urlencoded?.map(u => ({
        ...u,
        value: resolve(u.value),
      })),
    },
    auth: {
      ...request.auth,
      bearer: request.auth.bearer ? {
        token: resolve(request.auth.bearer.token),
      } : request.auth.bearer,
      basic: request.auth.basic ? {
        username: resolve(request.auth.basic.username),
        password: resolve(request.auth.basic.password),
      } : request.auth.basic,
      apiKey: request.auth.apiKey ? {
        ...request.auth.apiKey,
        key: resolve(request.auth.apiKey.key),
        value: resolve(request.auth.apiKey.value),
      } : request.auth.apiKey,
    },
  };

  return resolved;
};
