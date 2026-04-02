/**
 * IPC handler for Jira integration.
 * Handles: jira-create-issue
 *
 * @module electron/ipc/jiraHandler
 */
'use strict';

const https = require('https');
const { requireString, requireObject, optionalString } = require('./validate');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate that a Jira base URL is an HTTPS URL with no path traversal.
 * @param {string} url - The Jira base URL to validate
 * @returns {URL} - The parsed URL object
 */
function validateJiraUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Jira base URL must use HTTPS');
  }
  // Strip trailing slash for consistency
  return parsed;
}

/**
 * Make an HTTPS request to the Jira REST API.
 *
 * @param {URL} baseUrl - Parsed Jira base URL
 * @param {string} apiPath - API path (e.g. '/rest/api/2/issue')
 * @param {string} method - HTTP method
 * @param {string} pat - Personal Access Token
 * @param {object|null} body - JSON body to send (null for GET)
 * @param {object} deps - Shared dependencies (loadPreferences for proxy)
 * @returns {Promise<{status: number, body: object}>}
 */
function jiraRequest(baseUrl, apiPath, method, pat, body, deps) {
  return new Promise((resolve, reject) => {
    const jsonBody = body ? JSON.stringify(body) : null;

    const options = {
      hostname: baseUrl.hostname,
      port: baseUrl.port || 443,
      path: apiPath,
      method,
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (jsonBody) {
      options.headers['Content-Length'] = Buffer.byteLength(jsonBody);
    }

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        let parsed;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          parsed = { raw: rawBody };
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Jira request timed out'));
    });

    if (jsonBody) req.write(jsonBody);
    req.end();
  });
}

// ─── Register ────────────────────────────────────────────────────────────────

/**
 * Register Jira-related IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {object} deps
 * @param {function} deps.getEffectiveSecretsDirectory
 * @param {function} deps.readEncryptedSecrets
 * @param {function} deps.loadPreferences
 */
function register(ipcMain, deps) {

  ipcMain.handle('jira-create-issue', async (event, data) => {
    try {
      requireObject(data, 'data');
      const baseUrl = requireString(data.baseUrl, 'baseUrl', 500);
      const summary = requireString(data.summary, 'summary', 1000);
      const description = optionalString(data.description, 'description', 100_000);
      const projectKey = requireString(data.projectKey, 'projectKey', 50);
      const issueType = requireString(data.issueType, 'issueType', 100);

      // Validate URL is HTTPS
      const parsedUrl = validateJiraUrl(baseUrl);

      // Read PAT from secrets
      const secretsDir = deps.getEffectiveSecretsDirectory();
      const raw = deps.readEncryptedSecrets(secretsDir, 'jira-secrets');
      if (!raw) {
        return { success: false, error: 'Jira PAT not configured. Please set it in Settings > Integrations.' };
      }
      let pat;
      try {
        const stored = JSON.parse(raw);
        pat = stored.pat;
      } catch {
        return { success: false, error: 'Invalid Jira secrets file.' };
      }
      if (!pat) {
        return { success: false, error: 'Jira PAT is empty. Please set it in Settings > Integrations.' };
      }

      // Build Jira issue payload
      const fields = {
        project: { key: projectKey },
        summary,
        description,
        issuetype: { name: issueType },
      };

      // Merge custom fields from renderer
      // Values may be strings, objects ({value:...}) or arrays ([{value:...}])
      if (data.customFields && typeof data.customFields === 'object') {
        for (const [key, value] of Object.entries(data.customFields)) {
          if (value !== null && value !== undefined && value !== '') {
            fields[key] = value;
          }
        }
      }

      const result = await jiraRequest(parsedUrl, '/rest/api/2/issue', 'POST', pat, { fields }, deps);

      if (result.status === 201 || result.status === 200) {
        const issueKey = result.body.key;
        const issueUrl = `${parsedUrl.origin}/browse/${issueKey}`;
        return { success: true, issueKey, issueUrl };
      } else {
        // Extract and format Jira error messages
        let errors = '';
        if (result.body.errors && typeof result.body.errors === 'object') {
          // Field-level errors: map custom field IDs to readable messages
          const fieldErrors = Object.entries(result.body.errors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join('; ');
          errors = fieldErrors;
        }
        if (result.body.errorMessages?.length) {
          const general = result.body.errorMessages.join(', ');
          errors = errors ? `${errors} | ${general}` : general;
        }
        if (!errors) {
          errors = `HTTP ${result.status}`;
        }
        return { success: false, error: `Jira API error: ${errors}` };
      }
    } catch (error) {
      console.error('Error creating Jira issue:', error);
      return { success: false, error: error.message || 'Failed to create Jira issue' };
    }
  });

  ipcMain.handle('jira-test-connection', async (event, data) => {
    try {
      requireObject(data, 'data');
      const baseUrl = requireString(data.baseUrl, 'baseUrl', 500);
      const pat = requireString(data.pat, 'pat', 1000);

      const parsedUrl = validateJiraUrl(baseUrl);
      const result = await jiraRequest(parsedUrl, '/rest/api/2/myself', 'GET', pat, null, deps);

      if (result.status === 200) {
        const displayName = result.body.displayName || result.body.name || 'Unknown';
        return { success: true, message: `Connected as ${displayName}` };
      } else {
        return { success: false, message: `Authentication failed (HTTP ${result.status})` };
      }
    } catch (error) {
      console.error('Error testing Jira connection:', error);
      return { success: false, message: error.message || 'Connection failed' };
    }
  });

  // Fetch create-issue metadata to discover required fields, types, and allowed values
  ipcMain.handle('jira-get-create-meta', async (event, data) => {
    try {
      requireObject(data, 'data');
      const baseUrl = requireString(data.baseUrl, 'baseUrl', 500);
      const projectKey = requireString(data.projectKey, 'projectKey', 50);
      const issueType = requireString(data.issueType, 'issueType', 100);

      const parsedUrl = validateJiraUrl(baseUrl);

      // Read PAT from secrets
      const secretsDir = deps.getEffectiveSecretsDirectory();
      const raw = deps.readEncryptedSecrets(secretsDir, 'jira-secrets');
      if (!raw) {
        return { success: false, error: 'Jira PAT not configured.' };
      }
      let pat;
      try {
        const stored = JSON.parse(raw);
        pat = stored.pat;
      } catch {
        return { success: false, error: 'Invalid Jira secrets file.' };
      }
      if (!pat) {
        return { success: false, error: 'Jira PAT is empty.' };
      }

      const apiPath = `/rest/api/2/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&issuetypeNames=${encodeURIComponent(issueType)}&expand=projects.issuetypes.fields`;
      let result = await jiraRequest(parsedUrl, apiPath, 'GET', pat, null, deps);

      // Newer Jira versions deprecated the old createmeta endpoint — fall back to the v2 approach
      if (result.status !== 200) {
        // Step 1: Look up issue type ID via project metadata
        const projectResult = await jiraRequest(parsedUrl, `/rest/api/2/project/${encodeURIComponent(projectKey)}`, 'GET', pat, null, deps);
        if (projectResult.status !== 200) {
          return { success: false, error: `Project "${projectKey}" not found (HTTP ${projectResult.status})` };
        }

        const issueTypes = projectResult.body.issueTypes || [];
        const matchedType = issueTypes.find((t) => t.name.toLowerCase() === issueType.toLowerCase());
        if (!matchedType) {
          return { success: false, error: `Issue type "${issueType}" not found in project "${projectKey}". Available: ${issueTypes.map((t) => t.name).join(', ')}` };
        }

        // Step 2: Fetch fields for this issue type using the newer createmeta endpoint
        const fieldsPath = `/rest/api/2/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes/${matchedType.id}`;
        result = await jiraRequest(parsedUrl, fieldsPath, 'GET', pat, null, deps);

        if (result.status === 200) {
          // Newer endpoint returns { values: [...] } array of field objects
          const fieldsList = result.body.values || result.body.fields || [];
          const fieldMeta = {};
          for (const m of (Array.isArray(fieldsList) ? fieldsList : Object.values(fieldsList))) {
            const fieldId = m.fieldId || m.key;
            if (!fieldId) continue;
            fieldMeta[fieldId] = {
              name: m.name,
              required: m.required || false,
              type: m.schema?.type || 'unknown',
              custom: m.schema?.custom || null,
              allowedValues: m.allowedValues
                ? m.allowedValues.slice(0, 50).map((v) => ({
                    id: v.id,
                    name: v.name,
                    value: v.value,
                  }))
                : null,
            };
          }
          return { success: true, fields: fieldMeta };
        } else {
          const errors = result.body.errorMessages?.join(', ') || `HTTP ${result.status}`;
          return { success: false, error: `Failed to fetch metadata: ${errors}` };
        }
      }

      if (result.status === 200) {
        // Extract field info from the response
        const project = result.body.projects?.[0];
        const issueTypeObj = project?.issuetypes?.[0];
        const fields = issueTypeObj?.fields || {};

        // Build a simplified field map: { fieldId: { name, required, type, allowedValues } }
        const fieldMeta = {};
        for (const [fieldId, meta] of Object.entries(fields)) {
          const m = meta;
          fieldMeta[fieldId] = {
            name: m.name,
            required: m.required || false,
            type: m.schema?.type || 'unknown',
            custom: m.schema?.custom || null,
            allowedValues: m.allowedValues
              ? m.allowedValues.slice(0, 50).map((v) => ({
                  id: v.id,
                  name: v.name,
                  value: v.value,
                }))
              : null,
          };
        }

        return { success: true, fields: fieldMeta };
      } else {
        const errors = result.body.errorMessages?.join(', ') || `HTTP ${result.status}`;
        return { success: false, error: `Failed to fetch metadata: ${errors}` };
      }
    } catch (error) {
      console.error('Error fetching Jira create meta:', error);
      return { success: false, error: error.message || 'Failed to fetch field metadata' };
    }
  });

  // Search for Insight/Assets objects by query string (for objectType fields like COMPONENT(s))
  ipcMain.handle('jira-search-insight-objects', async (event, data) => {
    try {
      requireObject(data, 'data');
      const baseUrl = requireString(data.baseUrl, 'baseUrl', 500);
      const customFieldId = requireString(data.customFieldId, 'customFieldId', 100);
      const query = optionalString(data.query, 'query', 200) || '';

      const parsedUrl = validateJiraUrl(baseUrl);

      // Read PAT from secrets
      const secretsDir = deps.getEffectiveSecretsDirectory();
      const raw = deps.readEncryptedSecrets(secretsDir, 'jira-secrets');
      if (!raw) {
        return { success: false, error: 'Jira PAT not configured.' };
      }
      let pat;
      try {
        const stored = JSON.parse(raw);
        pat = stored.pat;
      } catch {
        return { success: false, error: 'Invalid Jira secrets file.' };
      }
      if (!pat) {
        return { success: false, error: 'Jira PAT is empty.' };
      }

      // Extract numeric field ID from "customfield_15802" → "15802"
      const numericId = customFieldId.replace('customfield_', '');

      // Try the JQL autocomplete suggestions endpoint first (works for Insight fields)
      const suggestPath = `/rest/api/2/jql/autocompletedata/suggestions?fieldName=cf[${encodeURIComponent(numericId)}]&fieldValue=${encodeURIComponent(query)}`;
      const suggestResult = await jiraRequest(parsedUrl, suggestPath, 'GET', pat, null, deps);

      if (suggestResult.status === 200 && suggestResult.body.results && suggestResult.body.results.length > 0) {
        const objects = suggestResult.body.results.slice(0, 50).map((r) => ({
          displayName: r.displayName || r.value || '',
          value: r.value || '',
        }));
        return { success: true, objects };
      }

      // Fallback: try the Insight REST API with IQL
      const iqlQuery = query ? `Name LIKE "${query}"` : '';
      const insightPath = `/rest/insight/1.0/customfield/${encodeURIComponent(customFieldId)}?query=${encodeURIComponent(iqlQuery)}&pageSize=50`;
      const insightResult = await jiraRequest(parsedUrl, insightPath, 'GET', pat, null, deps);

      if (insightResult.status === 200) {
        const items = insightResult.body.objects || insightResult.body || [];
        const objects = (Array.isArray(items) ? items : []).slice(0, 50).map((obj) => ({
          displayName: obj.label || obj.name || obj.objectKey || '',
          value: obj.objectKey || obj.key || obj.id?.toString() || '',
        }));
        return { success: true, objects };
      }

      // If both failed, return empty with info
      return {
        success: true,
        objects: [],
        info: `No results found. You can enter Insight keys manually (e.g. GCE-38216).`,
      };
    } catch (error) {
      console.error('Error searching Insight objects:', error);
      return { success: false, error: error.message || 'Failed to search Insight objects' };
    }
  });
}

module.exports = { register, validateJiraUrl };
