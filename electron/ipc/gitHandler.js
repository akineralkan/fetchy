/**
 * IPC handlers for Git operations and merge conflict resolution.
 * Handles: git-check, git-status, git-init, git-clone, git-pull, git-push,
 *          git-add-commit, git-add-commit-push, git-log, git-remote-get,
 *          git-remote-set, git-fetch, git-check-pull-available,
 *          git-merge-conflicts, git-is-merging, git-show-conflict-version,
 *          git-resolve-conflict, git-resolve-all-conflicts,
 *          git-read-file-content, git-show-base-version,
 *          git-write-resolved-content, git-merge-abort, git-diff-file
 *
 * @module electron/ipc/gitHandler
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { requireString, requireDirectoryPath, requireSafeRelativePath, requireOneOf, optionalString, requirePositiveInt, requireArray } = require('./validate');

// Delimiter for git --format arguments: use git's %x00 specifier so the
// argument string itself contains no literal null bytes (Node rejects those),
// but git still outputs \x00 in the result for reliable parsing.
const GIT_LOG_FMT_SEP = '%x00';     // used inside --format= strings
const GIT_LOG_PARSE_SEP = '\x00';   // used to split the output

/**
 * Run a git command in the given cwd.
 * Returns { success, stdout, stderr }.
 * @param {string[]} args
 * @param {string} cwd
 * @param {number} [timeout=30000]
 * @param {object} [env] - Extra environment variables merged with process.env
 */
function runGit(args, cwd, timeout = 30000, env) {
  return new Promise((resolve) => {
    const gitBin = 'git';
    const opts = { cwd, timeout, maxBuffer: 10 * 1024 * 1024 };
    if (env) opts.env = { ...process.env, ...env };
    execFile(gitBin, args, opts, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, stdout: stdout || '', stderr: stderr || error.message });
      } else {
        resolve({ success: true, stdout: stdout || '', stderr: stderr || '' });
      }
    });
  });
}

/**
 * Check if a directory is a git repository.
 * @param {string} directory
 * @returns {boolean}
 */
function isGitRepo(directory) {
  if (!directory || !fs.existsSync(directory)) return false;
  return fs.existsSync(path.join(directory, '.git'));
}

/**
 * Ensures history.json and meta.json are listed in .gitignore for a git-native workspace.
 * Creates or appends to .gitignore without clobbering existing content.
 */
function ensureHistoryJsonIgnored(directory) {
  try {
    if (!directory || !fs.existsSync(path.join(directory, '.git'))) return;
    const gitignorePath = path.join(directory, '.gitignore');
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
    }
    const lines = content.split(/\r?\n/).map((l) => l.trim());
    const toAdd = ['history.json', 'meta.json'].filter((f) => !lines.includes(f));
    if (toAdd.length > 0) {
      const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      fs.writeFileSync(
        gitignorePath,
        content + separator + '\n# Fetchy request history - local only, never commit\n' + toAdd.join('\n') + '\n',
        'utf-8'
      );
    }
  } catch (e) {
    console.error('Failed to update .gitignore for history.json:', e);
  }
}

/**
 * Register all git-related IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {object} deps
 * @param {function} deps.safeWriteFileSync
 */
function register(ipcMain, deps) {
  const { safeWriteFileSync } = deps;

  // ─── Core git helpers ───────────────────────────────────────────────────────

  ipcMain.handle('git-check', async () => {
    try {
      const result = await runGit(['--version'], process.cwd(), 5000);
      return { available: result.success, version: result.stdout.trim() };
    } catch {
      return { available: false, version: '' };
    }
  });

  ipcMain.handle('git-status', async (event, { directory }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      if (!directory || !fs.existsSync(directory)) {
        return { success: false, error: 'Directory does not exist' };
      }

      const gitDir = path.join(directory, '.git');
      const isRepo = fs.existsSync(gitDir);
      if (!isRepo) return { success: true, isRepo: false };

      // Get branch name
      const branchResult = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], directory);
      const branch = branchResult.success ? branchResult.stdout.trim() : 'unknown';

      // Get status (porcelain for machine-readable)
      const statusResult = await runGit(['status', '--porcelain'], directory);
      const changes = statusResult.success
        ? statusResult.stdout.trim().split('\n').filter((l) => l.trim() !== '')
        : [];

      // Get remote URL
      const remoteResult = await runGit(['remote', 'get-url', 'origin'], directory);
      const remoteUrl = remoteResult.success ? remoteResult.stdout.trim() : '';

      // Get last commit info
      const logResult = await runGit(
        ['log', '-1', `--format=%H${GIT_LOG_FMT_SEP}%s${GIT_LOG_FMT_SEP}%an${GIT_LOG_FMT_SEP}%ai`],
        directory
      );
      let lastCommit = null;
      if (logResult.success && logResult.stdout.trim()) {
        const parts = logResult.stdout.trim().split(GIT_LOG_PARSE_SEP);
        lastCommit = {
          hash: parts[0] || '',
          message: parts[1] || '',
          author: parts[2] || '',
          date: parts[3] || '',
        };
      }

      // Check if ahead/behind remote
      let ahead = 0;
      let behind = 0;
      if (remoteUrl) {
        const aheadResult = await runGit(['rev-list', '--count', `origin/${branch}..HEAD`], directory);
        if (aheadResult.success) ahead = parseInt(aheadResult.stdout.trim()) || 0;
        const behindResult = await runGit(['rev-list', '--count', `HEAD..origin/${branch}`], directory);
        if (behindResult.success) behind = parseInt(behindResult.stdout.trim()) || 0;
      }

      return {
        success: true,
        isRepo: true,
        branch,
        changes,
        remoteUrl,
        lastCommit,
        ahead,
        behind,
        hasChanges: changes.length > 0,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── Init / Clone ──────────────────────────────────────────────────────────

  ipcMain.handle('git-init', async (event, { directory }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      if (!directory) return { success: false, error: 'No directory specified' };
      if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });

      const result = await runGit(['init'], directory);
      if (!result.success) return { success: false, error: result.stderr };

      // Create a default .gitignore if it doesn't exist
      const gitignorePath = path.join(directory, '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(
          gitignorePath,
          '# Fetchy secrets - never commit\n.secrets/\nai-secrets.json\nai-secrets.enc\nfetchy-secrets.json\nfetchy-secrets.enc\n\n# Fetchy request history - local only, never commit\nhistory.json\nmeta.json\n\n# OS files\n.DS_Store\nThumbs.db\n',
          'utf-8'
        );
      } else {
        ensureHistoryJsonIgnored(directory);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-clone', async (event, { url, directory }) => {
    try {
      requireString(url, 'url', 2000);
      requireDirectoryPath(directory, 'directory');
      if (!url) return { success: false, error: 'No repository URL specified' };
      if (!directory) return { success: false, error: 'No directory specified' };

      const parentDir = path.dirname(directory);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

      // Disable interactive credential prompts — they hang in a headless execFile
      // context.  Git Credential Manager (Windows) will still use stored/cached
      // credentials; this only prevents a blocking tty/GUI prompt that can never
      // be answered from within Electron's child_process.
      const cloneEnv = { GIT_TERMINAL_PROMPT: '0' };

      /**
       * Translate raw git stderr into a more user-friendly message when the
       * clone fails due to authentication or unreachable host.
       */
      const friendlyCloneError = (stderr) => {
        const lower = (stderr || '').toLowerCase();
        if (lower.includes('authentication failed') || lower.includes('could not read username') || lower.includes('401') || lower.includes('403')) {
          return (
            (stderr.trim()) +
            '\n\nTip: For corporate / private repositories, embed a Personal Access Token in the URL:\n' +
            '  https://<token-name>:<token>@host/path/to/repo.git\n' +
            'or make sure your git credential manager has valid credentials stored.'
          );
        }
        return stderr;
      };

      if (fs.existsSync(directory)) {
        const files = fs.readdirSync(directory);
        if (files.length > 0) {
          // Directory is not empty — clone to temp then move
          const tmpDir = directory + '_git_clone_tmp_' + Date.now();
          const cloneResult = await runGit(['clone', url, tmpDir], parentDir, 120000, cloneEnv);
          if (!cloneResult.success) return { success: false, error: friendlyCloneError(cloneResult.stderr) };

          const clonedEntries = fs.readdirSync(tmpDir, { withFileTypes: true });
          for (const entry of clonedEntries) {
            const src = path.join(tmpDir, entry.name);
            const dest = path.join(directory, entry.name);
            if (fs.existsSync(dest)) {
              if (entry.name === '.git') {
                fs.rmSync(dest, { recursive: true, force: true });
                fs.renameSync(src, dest);
              }
              // Otherwise keep existing file to preserve user data
            } else {
              fs.renameSync(src, dest);
            }
          }
          fs.rmSync(tmpDir, { recursive: true, force: true });
          ensureHistoryJsonIgnored(directory);
          return { success: true };
        }
      }

      // Directory is empty or doesn't exist – clone directly
      const result = await runGit(['clone', url, directory], parentDir, 120000, cloneEnv);
      if (!result.success) return { success: false, error: friendlyCloneError(result.stderr) };
      ensureHistoryJsonIgnored(directory);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── Pull / Push / Commit ──────────────────────────────────────────────────

  ipcMain.handle('git-pull', async (event, { directory }) => {
    try {
      if (!directory) return { success: false, error: 'No directory specified' };
      if (!isGitRepo(directory)) return { success: false, error: 'Not a git repository. Initialize or clone first.' };

      const statusCheck = await runGit(['status', '--porcelain'], directory);
      const hasUncommitted = statusCheck.success && statusCheck.stdout.trim().length > 0;
      if (hasUncommitted) {
        const stashResult = await runGit(['stash', 'push', '-m', 'Fetchy auto-stash before pull'], directory);
        if (!stashResult.success) {
          return { success: false, error: 'Failed to stash local changes before pull: ' + stashResult.stderr };
        }
      }

      const result = await runGit(['pull', '--no-rebase'], directory, 120000);

      if (!result.success) {
        const mergePath = path.join(directory, '.git', 'MERGE_HEAD');
        const isMerging = fs.existsSync(mergePath);
        const fullOutput = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
        return { success: false, error: fullOutput || 'Pull failed', mergeConflict: isMerging };
      }

      if (hasUncommitted) {
        const popResult = await runGit(['stash', 'pop'], directory);
        if (!popResult.success) {
          return {
            success: true,
            output: (result.stdout.trim() || 'Pull completed') +
              '\n⚠ Could not restore local changes from stash. Use `git stash pop` manually.',
          };
        }
      }

      return { success: true, output: result.stdout.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-push', async (event, { directory }) => {
    try {
      if (!directory) return { success: false, error: 'No directory specified' };
      if (!isGitRepo(directory)) return { success: false, error: 'Not a git repository. Initialize or clone first.' };
      const result = await runGit(['push'], directory, 120000);
      if (!result.success) {
        const fullOutput = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
        return { success: false, error: fullOutput || 'Push failed' };
      }
      return { success: true, output: result.stdout.trim() || result.stderr.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-add-commit', async (event, { directory, message }) => {
    try {
      if (!directory) return { success: false, error: 'No directory specified' };
      if (!isGitRepo(directory)) return { success: false, error: 'Not a git repository' };
      if (!message) message = `Fetchy auto-commit ${new Date().toISOString()}`;

      const addResult = await runGit(['add', '-A'], directory);
      if (!addResult.success) return { success: false, error: addResult.stderr };

      const commitResult = await runGit(['commit', '-m', message], directory);
      if (!commitResult.success) {
        if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
          return { success: true, output: 'Nothing to commit' };
        }
        return { success: false, error: commitResult.stderr || commitResult.stdout };
      }
      return { success: true, output: commitResult.stdout.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-add-commit-push', async (event, { directory, message }) => {
    try {
      if (!directory) return { success: false, error: 'No directory specified' };
      if (!isGitRepo(directory)) return { success: false, error: 'Not a git repository' };
      if (!message) message = `Fetchy auto-sync ${new Date().toISOString()}`;

      const addResult = await runGit(['add', '-A'], directory);
      if (!addResult.success) return { success: false, error: addResult.stderr };

      const commitResult = await runGit(['commit', '-m', message], directory);
      if (!commitResult.success) {
        if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
          return { success: true, output: 'Nothing to commit' };
        }
        return { success: false, error: commitResult.stderr || commitResult.stdout };
      }

      const pushResult = await runGit(['push'], directory, 120000);
      if (!pushResult.success) return { success: false, error: pushResult.stderr };
      return { success: true, output: 'Changes committed and pushed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── Log / Remote / Fetch ──────────────────────────────────────────────────

  ipcMain.handle('git-log', async (event, { directory, count }) => {
    try {
      if (!directory) return { success: false, error: 'No directory specified' };
      if (!isGitRepo(directory)) return { success: true, commits: [] };
      const n = count || 20;
      const result = await runGit(
        ['log', `--max-count=${n}`, `--format=%H${GIT_LOG_FMT_SEP}%s${GIT_LOG_FMT_SEP}%an${GIT_LOG_FMT_SEP}%ai`],
        directory
      );
      if (!result.success) return { success: false, error: result.stderr };

      const commits = result.stdout
        .trim()
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((line) => {
          const parts = line.split(GIT_LOG_PARSE_SEP);
          return {
            hash: parts[0] || '',
            message: parts[1] || '',
            author: parts[2] || '',
            date: parts[3] || '',
          };
        });
      return { success: true, commits };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-remote-get', async (event, { directory }) => {
    try {
      if (!directory) return { success: false, error: 'No directory specified' };
      if (!isGitRepo(directory)) return { success: false, url: '' };
      const result = await runGit(['remote', 'get-url', 'origin'], directory);
      if (!result.success) return { success: false, url: '' };
      return { success: true, url: result.stdout.trim() };
    } catch (error) {
      return { success: false, url: '' };
    }
  });

  ipcMain.handle('git-remote-set', async (event, { directory, url }) => {
    try {
      if (!directory) return { success: false, error: 'No directory specified' };
      if (!url) return { success: false, error: 'No URL specified' };
      if (!isGitRepo(directory)) return { success: false, error: 'Not a git repository' };

      const checkResult = await runGit(['remote'], directory);
      const remotes = checkResult.success ? checkResult.stdout.trim().split('\n') : [];

      let result;
      if (remotes.includes('origin')) {
        result = await runGit(['remote', 'set-url', 'origin', url], directory);
      } else {
        result = await runGit(['remote', 'add', 'origin', url], directory);
      }
      if (!result.success) return { success: false, error: result.stderr };
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-fetch', async (event, { directory }) => {
    try {
      if (!directory) return { success: false, error: 'No directory specified' };
      if (!isGitRepo(directory)) return { success: false, error: 'Not a git repository' };
      const result = await runGit(['fetch', '--all'], directory, 60000);
      if (!result.success) return { success: false, error: result.stderr };
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-check-pull-available', async (event, { directory }) => {
    try {
      if (!directory || !fs.existsSync(directory)) {
        return { isRepo: false, hasPull: false, count: 0 };
      }

      const gitDir = path.join(directory, '.git');
      if (!fs.existsSync(gitDir)) {
        return { isRepo: false, hasPull: false, count: 0 };
      }

      const remoteResult = await runGit(['remote', 'get-url', 'origin'], directory);
      if (!remoteResult.success || !remoteResult.stdout.trim()) {
        return { isRepo: true, hasPull: false, count: 0, noRemote: true };
      }

      await runGit(['fetch', 'origin'], directory, 60000);

      const branchResult = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], directory);
      const branch = branchResult.success ? branchResult.stdout.trim() : 'main';

      const countResult = await runGit(
        ['rev-list', '--count', `HEAD..origin/${branch}`],
        directory
      );

      const count = countResult.success ? (parseInt(countResult.stdout.trim()) || 0) : 0;
      return { isRepo: true, hasPull: count > 0, count };
    } catch (error) {
      return { isRepo: false, hasPull: false, count: 0, error: error.message };
    }
  });

  // ─── Merge conflict resolution ─────────────────────────────────────────────

  ipcMain.handle('git-merge-conflicts', async (event, { directory }) => {
    try {
      if (!directory) return { success: false, files: [], error: 'No directory specified' };
      if (!isGitRepo(directory)) return { success: true, files: [] };
      const result = await runGit(['diff', '--name-only', '--diff-filter=U'], directory);
      if (!result.success) return { success: false, files: [], error: result.stderr };
      const files = result.stdout.trim().split('\n').filter(l => l.trim());
      return { success: true, files };
    } catch (error) {
      return { success: false, files: [], error: error.message };
    }
  });

  ipcMain.handle('git-is-merging', async (event, { directory }) => {
    try {
      if (!directory) return { merging: false };
      const mergePath = path.join(directory, '.git', 'MERGE_HEAD');
      return { merging: fs.existsSync(mergePath) };
    } catch {
      return { merging: false };
    }
  });

  ipcMain.handle('git-show-conflict-version', async (event, { directory, filepath, version }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireSafeRelativePath(filepath, 'filepath');
      requireOneOf(version, 'version', ['ours', 'theirs']);
      if (!directory) return { success: false, error: 'No directory specified', content: '' };
      // stage 2 = ours (local), stage 3 = theirs (remote)
      const stage = version === 'theirs' ? ':3:' : ':2:';
      const result = await runGit(['show', `${stage}${filepath}`], directory);
      if (!result.success) return { success: false, error: result.stderr, content: '' };
      return { success: true, content: result.stdout };
    } catch (error) {
      return { success: false, error: error.message, content: '' };
    }
  });

  ipcMain.handle('git-resolve-conflict', async (event, { directory, filepath, content }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireSafeRelativePath(filepath, 'filepath');
      requireString(content, 'content', 50_000_000);
      if (!directory) return { success: false, error: 'No directory specified' };
      const fullPath = path.join(directory, filepath);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      safeWriteFileSync(fullPath, content, 'utf-8');
      const result = await runGit(['add', filepath], directory);
      if (!result.success) return { success: false, error: result.stderr };
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-resolve-all-conflicts', async (event, { directory, strategy }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireOneOf(strategy, 'strategy', ['ours', 'theirs']);
      if (!directory) return { success: false, error: 'No directory specified' };
      const diffResult = await runGit(['diff', '--name-only', '--diff-filter=U'], directory);
      if (!diffResult.success) return { success: false, error: diffResult.stderr };
      const files = diffResult.stdout.trim().split('\n').filter(l => l.trim());
      if (files.length === 0) return { success: true };

      for (const filepath of files) {
        const stage = strategy === 'theirs' ? ':3:' : ':2:';
        const showResult = await runGit(['show', `${stage}${filepath}`], directory);
        if (showResult.success) {
          const fullPath = path.join(directory, filepath);
          const parentDir = path.dirname(fullPath);
          if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
          safeWriteFileSync(fullPath, showResult.stdout, 'utf-8');
        }
        await runGit(['add', filepath], directory);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-read-file-content', async (event, { directory, filepath }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireSafeRelativePath(filepath, 'filepath');
      if (!directory) return { success: false, error: 'No directory specified', content: '' };
      const fullPath = path.join(directory, filepath);
      if (!fs.existsSync(fullPath)) return { success: false, error: 'File does not exist', content: '' };
      const content = fs.readFileSync(fullPath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message, content: '' };
    }
  });

  ipcMain.handle('git-show-base-version', async (event, { directory, filepath }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireSafeRelativePath(filepath, 'filepath');
      if (!directory) return { success: false, error: 'No directory specified', content: '' };
      const result = await runGit(['show', `:1:${filepath}`], directory);
      if (!result.success) return { success: false, error: result.stderr, content: '' };
      return { success: true, content: result.stdout };
    } catch (error) {
      return { success: false, error: error.message, content: '' };
    }
  });

  ipcMain.handle('git-write-resolved-content', async (event, { directory, filepath, content }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireSafeRelativePath(filepath, 'filepath');
      requireString(content, 'content', 50_000_000);
      if (!directory) return { success: false, error: 'No directory specified' };
      const fullPath = path.join(directory, filepath);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      safeWriteFileSync(fullPath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-merge-abort', async (event, { directory }) => {
    try {
      if (!directory) return { success: false, error: 'No directory specified' };
      const result = await runGit(['merge', '--abort'], directory);
      if (!result.success) return { success: false, error: result.stderr };
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── Branch operations ───────────────────────────────────────────────────

  ipcMain.handle('git-list-branches', async (event, { directory }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      if (!isGitRepo(directory)) return { success: true, local: [], remote: [] };
      const localResult = await runGit(
        ['branch', '--format=%(refname:short)' + GIT_LOG_FMT_SEP + '%(objectname:short)' + GIT_LOG_FMT_SEP + '%(HEAD)'],
        directory
      );
      const local = [];
      if (localResult.success) {
        localResult.stdout.trim().split('\n').filter(l => l.trim()).forEach(line => {
          const parts = line.split(GIT_LOG_PARSE_SEP);
          local.push({
            name: parts[0] || '',
            hash: parts[1] || '',
            current: (parts[2] || '').trim() === '*',
            remote: false,
          });
        });
      }
      const remoteResult = await runGit(
        ['branch', '-r', '--format=%(refname:short)' + GIT_LOG_FMT_SEP + '%(objectname:short)'],
        directory
      );
      const remote = [];
      if (remoteResult.success) {
        remoteResult.stdout.trim().split('\n').filter(l => l.trim()).forEach(line => {
          const parts = line.split(GIT_LOG_PARSE_SEP);
          const name = parts[0] || '';
          if (name.includes('HEAD')) return;
          remote.push({
            name,
            hash: parts[1] || '',
            current: false,
            remote: true,
          });
        });
      }
      return { success: true, local, remote };
    } catch (error) {
      return { success: false, local: [], remote: [], error: error.message };
    }
  });

  ipcMain.handle('git-checkout-branch', async (event, { directory, branch }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireString(branch, 'branch', 200);
      if (branch.includes('\0') || branch.includes('..')) {
        return { success: false, error: 'Invalid branch name' };
      }
      const result = await runGit(['checkout', branch], directory);
      if (!result.success) return { success: false, error: result.stderr };
      return { success: true, output: result.stdout.trim() || result.stderr.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-create-branch', async (event, { directory, branch, checkout }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireString(branch, 'branch', 200);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._\/-]*$/.test(branch) || branch.includes('..')) {
        return { success: false, error: 'Invalid branch name. Use alphanumeric characters, dots, dashes, underscores, and slashes.' };
      }
      const args = checkout !== false ? ['checkout', '-b', branch] : ['branch', branch];
      const result = await runGit(args, directory);
      if (!result.success) return { success: false, error: result.stderr };
      return { success: true, output: result.stdout.trim() || result.stderr.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── Staging operations ─────────────────────────────────────────────────

  ipcMain.handle('git-stage-files', async (event, { directory, files }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireArray(files, 'files', 1000);
      for (const f of files) requireSafeRelativePath(f, 'file');
      const result = await runGit(['add', '--', ...files], directory);
      if (!result.success) return { success: false, error: result.stderr };
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-unstage-files', async (event, { directory, files }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireArray(files, 'files', 1000);
      for (const f of files) requireSafeRelativePath(f, 'file');
      const result = await runGit(['reset', 'HEAD', '--', ...files], directory);
      if (!result.success) {
        // Fallback for repos with no commits yet
        const rmResult = await runGit(['rm', '--cached', '--', ...files], directory);
        if (!rmResult.success) return { success: false, error: rmResult.stderr };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-discard-files', async (event, { directory, files }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireArray(files, 'files', 1000);
      for (const f of files) requireSafeRelativePath(f, 'file');
      const statusResult = await runGit(['status', '--porcelain', '--', ...files], directory);
      const untracked = [];
      const tracked = [];
      if (statusResult.success) {
        statusResult.stdout.trim().split('\n').filter(l => l.trim()).forEach(line => {
          const code = line.substring(0, 2);
          const filePath = line.substring(3).trim();
          if (code === '??') {
            untracked.push(filePath);
          } else {
            tracked.push(filePath);
          }
        });
      }
      if (tracked.length > 0) {
        const checkoutResult = await runGit(['checkout', '--', ...tracked], directory);
        if (!checkoutResult.success) return { success: false, error: checkoutResult.stderr };
      }
      if (untracked.length > 0) {
        for (const f of untracked) {
          const fullPath = path.join(directory, f);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-commit-staged', async (event, { directory, message }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      if (!message) message = 'Fetchy commit ' + new Date().toISOString();
      const commitResult = await runGit(['commit', '-m', message], directory);
      if (!commitResult.success) {
        if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
          return { success: true, output: 'Nothing to commit' };
        }
        return { success: false, error: commitResult.stderr || commitResult.stdout };
      }
      return { success: true, output: commitResult.stdout.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── Stash operations ───────────────────────────────────────────────────

  ipcMain.handle('git-stash', async (event, { directory }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      const result = await runGit(['stash', 'push', '-u'], directory);
      if (!result.success) return { success: false, error: result.stderr };
      return { success: true, output: result.stdout.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git-stash-pop', async (event, { directory }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      const result = await runGit(['stash', 'pop'], directory);
      if (!result.success) return { success: false, error: result.stderr };
      return { success: true, output: result.stdout.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── Diff operations ────────────────────────────────────────────────────

  ipcMain.handle('git-diff-file', async (event, { directory, filepath, staged }) => {
    try {
      requireDirectoryPath(directory, 'directory');
      requireSafeRelativePath(filepath, 'filepath');
      if (!isGitRepo(directory)) return { success: false, diff: '', error: 'Not a git repository' };

      const args = staged
        ? ['diff', '--cached', '--', filepath]
        : ['diff', '--', filepath];
      const result = await runGit(args, directory);
      if (!result.success) return { success: false, diff: '', error: result.stderr };
      return { success: true, diff: result.stdout };
    } catch (error) {
      return { success: false, diff: '', error: error.message };
    }
  });
}

module.exports = { register, runGit, ensureHistoryJsonIgnored };
