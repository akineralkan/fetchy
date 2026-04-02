/**
 * Barrel export for all IPC handler modules.
 *
 * @module electron/ipc/index
 */
'use strict';

const fileHandlers = require('./fileHandlers');
const secretsHandler = require('./secretsHandler');
const httpHandler = require('./httpHandler');
const aiHandler = require('./aiHandler');
const workspaceHandler = require('./workspaceHandler');
const jiraHandler = require('./jiraHandler');

module.exports = {
  fileHandlers,
  secretsHandler,
  httpHandler,
  aiHandler,
  workspaceHandler,
  jiraHandler,
};
