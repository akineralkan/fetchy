import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  RefreshCw,
  Download,
  Upload,
  FolderGit2,
  AlertCircle,
  Check,
  Loader2,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Clock,
  Info,
  Link2,
  AlertTriangle,
  XCircle,
  GitMerge,
  Eye,
  CheckCircle,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Archive,
  ArchiveRestore,
  FilePlus,
  FileX,
  FileEdit,
  FileMinus2,
  HelpCircle,
} from 'lucide-react';
import type {
  GitStatusResult,
  GitCommitInfo,
  GitBranchInfo,
  Workspace,
} from '../types';
import { useAppStore } from '../store/appStore';
import { invalidateWriteCache } from '../store/persistence';

interface GitSettingsTabProps {
  workspace: Workspace | null;
  onWorkspaceUpdate?: (id: string, updates: Partial<Workspace>) => void;
  onOpenConflictResolver?: () => void;
}

type OpStatus = 'idle' | 'loading' | 'success' | 'error';

/** Separate staged / unstaged views of a single file */
interface StagedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
}

interface UnstagedFile {
  path: string;
  status: 'modified' | 'deleted' | 'untracked';
}

/**
 * Parse git status --porcelain output into staged and unstaged file lists.
 * X = index status, Y = worktree status. Format: "XY path"
 */
function parseStatusFiles(changes: string[]): { staged: StagedFile[]; unstaged: UnstagedFile[] } {
  const staged: StagedFile[] = [];
  const unstaged: UnstagedFile[] = [];

  for (const line of changes) {
    if (line.length < 3) continue;
    const x = line[0]; // index status
    const y = line[1]; // work-tree status
    const filePath = line.substring(3).trim();
    if (!filePath) continue;

    // Staged changes (index status is not space/?)
    if (x === 'M') staged.push({ path: filePath, status: 'modified' });
    else if (x === 'A') staged.push({ path: filePath, status: 'added' });
    else if (x === 'D') staged.push({ path: filePath, status: 'deleted' });
    else if (x === 'R') staged.push({ path: filePath, status: 'renamed' });
    else if (x === 'C') staged.push({ path: filePath, status: 'copied' });

    // Unstaged changes (work-tree status is not space)
    if (y === 'M') unstaged.push({ path: filePath, status: 'modified' });
    else if (y === 'D') unstaged.push({ path: filePath, status: 'deleted' });
    else if (x === '?' && y === '?') unstaged.push({ path: filePath, status: 'untracked' });
  }

  return { staged, unstaged };
}

function statusIcon(status: string) {
  switch (status) {
    case 'added':
    case 'untracked':
      return <FilePlus size={12} className='text-green-400' />;
    case 'modified':
      return <FileEdit size={12} className='text-yellow-400' />;
    case 'deleted':
      return <FileX size={12} className='text-red-400' />;
    case 'renamed':
    case 'copied':
      return <FileMinus2 size={12} className='text-blue-400' />;
    default:
      return <HelpCircle size={12} className='text-gray-400' />;
  }
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    added: 'text-green-400',
    untracked: 'text-green-400',
    modified: 'text-yellow-400',
    deleted: 'text-red-400',
    renamed: 'text-blue-400',
    copied: 'text-blue-400',
  };
  return <span className={`text-[10px] uppercase font-medium ${colors[status] || 'text-gray-400'}`}>{status}</span>;
}

export default function GitSettingsTab({ workspace, onWorkspaceUpdate, onOpenConflictResolver }: GitSettingsTabProps) {
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null);
  const [gitVersion, setGitVersion] = useState('');
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [commits, setCommits] = useState<GitCommitInfo[]>([]);
  const [cloneUrl, setCloneUrl] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [opStatus, setOpStatus] = useState<OpStatus>('idle');
  const [opMessage, setOpMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [showRemoteForm, setShowRemoteForm] = useState(false);
  const [autoSync, setAutoSync] = useState(workspace?.gitAutoSync ?? false);
  // Merge conflict state
  const [isMerging, setIsMerging] = useState(false);
  const [conflictFiles, setConflictFiles] = useState<string[]>([]);
  const [resolvedFiles, setResolvedFiles] = useState<Set<string>>(new Set());
  // Branch state
  const [branches, setBranches] = useState<{ local: GitBranchInfo[]; remote: GitBranchInfo[] }>({ local: [], remote: [] });
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showNewBranchForm, setShowNewBranchForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  // Staging panel state
  const [expandedStaged, setExpandedStaged] = useState(true);
  const [expandedUnstaged, setExpandedUnstaged] = useState(true);
  const [expandedCommits, setExpandedCommits] = useState(false);
  const opTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const branchDropdownRef = useRef<HTMLDivElement | null>(null);

  const api = window.electronAPI;
  const homeDir = workspace?.homeDirectory ?? '';

  // Parse status into staged/unstaged file lists
  const { staged, unstaged } = useMemo(
    () => parseStatusFiles(status?.changes ?? []),
    [status?.changes]
  );

  const clearOpStatus = useCallback(() => {
    if (opTimerRef.current) clearTimeout(opTimerRef.current);
    opTimerRef.current = setTimeout(() => {
      setOpStatus('idle');
      setOpMessage('');
    }, 5000);
  }, []);

  const showOp = useCallback(
    (status: OpStatus, msg: string) => {
      setOpStatus(status);
      setOpMessage(msg);
      if (status !== 'loading') clearOpStatus();
    },
    [clearOpStatus]
  );

  // Check git availability
  useEffect(() => {
    if (!api) return;
    api.gitCheck().then((r) => {
      setGitAvailable(r.available);
      setGitVersion(r.version);
    });
  }, [api]);

  // Close branch dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setShowBranchDropdown(false);
      }
    }
    if (showBranchDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showBranchDropdown]);

  // Fetch status whenever workspace changes
  const refreshStatus = useCallback(async () => {
    if (!api || !homeDir) return;
    setIsRefreshing(true);
    try {
      const [statusRes, logRes, mergingRes, branchRes] = await Promise.all([
        api.gitStatus({ directory: homeDir }),
        api.gitLog({ directory: homeDir, count: 15 }),
        api.gitIsMerging({ directory: homeDir }),
        api.gitListBranches({ directory: homeDir }),
      ]);
      setStatus(statusRes);
      if (logRes.success && logRes.commits) setCommits(logRes.commits);
      else setCommits([]);
      if (statusRes.success && statusRes.remoteUrl) {
        setRemoteUrl(statusRes.remoteUrl);
      }
      if (branchRes.success) {
        setBranches({ local: branchRes.local, remote: branchRes.remote });
      }

      // Check for merge conflicts
      setIsMerging(mergingRes.merging);
      if (mergingRes.merging) {
        const conflictsRes = await api.gitMergeConflicts({ directory: homeDir });
        if (conflictsRes.success) {
          setConflictFiles(conflictsRes.files);
        }
      } else {
        setConflictFiles([]);
        setResolvedFiles(new Set());
      }
    } catch (e) {
      console.error('Git status refresh failed:', e);
    }
    setIsRefreshing(false);
  }, [api, homeDir]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Auto-sync toggle
  const handleAutoSyncToggle = useCallback(
    (checked: boolean) => {
      setAutoSync(checked);
      if (workspace && onWorkspaceUpdate) {
        onWorkspaceUpdate(workspace.id, { gitAutoSync: checked });
      }
    },
    [workspace, onWorkspaceUpdate]
  );

  // Init repo
  const handleInit = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Initializing repository...');
    const result = await api.gitInit({ directory: homeDir });
    if (result.success) {
      showOp('success', 'Repository initialized');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Failed to initialize');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Clone repo
  const handleClone = useCallback(async () => {
    if (!api || !homeDir || !cloneUrl.trim()) return;
    showOp('loading', 'Cloning repository... this may take a while.');
    const result = await api.gitClone({ url: cloneUrl.trim(), directory: homeDir });
    if (result.success) {
      showOp('success', 'Repository cloned successfully');
      setCloneUrl('');
      setShowCloneForm(false);
      refreshStatus();
    } else {
      showOp('error', result.error || 'Clone failed');
    }
  }, [api, homeDir, cloneUrl, showOp, refreshStatus]);

  // Pull
  const handlePull = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Pulling from remote...');
    const result = await api.gitPull({ directory: homeDir }) as any;
    if (result.success) {
      showOp('success', result.output || 'Pull completed');
      invalidateWriteCache();
      refreshStatus();
      await useAppStore.persist.rehydrate();
    } else {
      const hasMergeConflict = result.mergeConflict === true;
      if (!hasMergeConflict) {
        const mergingRes = await api.gitIsMerging({ directory: homeDir });
        if (mergingRes.merging) {
          result.mergeConflict = true;
        }
      }

      if (result.mergeConflict) {
        showOp('error', 'Pull resulted in merge conflicts. Resolve them below.');
        await refreshStatus();
        if (onOpenConflictResolver) {
          setTimeout(() => onOpenConflictResolver(), 300);
        }
      } else {
        showOp('error', result.error || 'Pull failed');
      }
    }
  }, [api, homeDir, showOp, refreshStatus, onOpenConflictResolver]);

  // Push
  const handlePush = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Pushing to remote...');
    const result = await api.gitPush({ directory: homeDir });
    if (result.success) {
      showOp('success', result.output || 'Push completed');
      refreshStatus();
    } else {
      const errorMsg = result.error || '';
      if (errorMsg.includes('rejected') || errorMsg.includes('non-fast-forward') || errorMsg.includes('fetch first')) {
        showOp('error', 'Push rejected — remote has new commits. Pull first, then push.');
      } else {
        showOp('error', errorMsg || 'Push failed');
      }
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Fetch
  const handleFetch = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Fetching from remote...');
    const result = await api.gitFetch({ directory: homeDir });
    if (result.success) {
      showOp('success', 'Fetch completed');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Fetch failed');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Stage individual files
  const handleStageFiles = useCallback(async (files: string[]) => {
    if (!api || !homeDir || files.length === 0) return;
    const result = await api.gitStageFiles({ directory: homeDir, files });
    if (result.success) {
      refreshStatus();
    } else {
      showOp('error', result.error || 'Failed to stage files');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Unstage individual files
  const handleUnstageFiles = useCallback(async (files: string[]) => {
    if (!api || !homeDir || files.length === 0) return;
    const result = await api.gitUnstageFiles({ directory: homeDir, files });
    if (result.success) {
      refreshStatus();
    } else {
      showOp('error', result.error || 'Failed to unstage files');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Discard unstaged changes
  const handleDiscardFiles = useCallback(async (files: string[]) => {
    if (!api || !homeDir || files.length === 0) return;
    const result = await api.gitDiscardFiles({ directory: homeDir, files });
    if (result.success) {
      refreshStatus();
    } else {
      showOp('error', result.error || 'Failed to discard changes');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Stage all unstaged files
  const handleStageAll = useCallback(async () => {
    if (!api || !homeDir) return;
    const result = await api.gitStageFiles({ directory: homeDir, files: unstaged.map(f => f.path) });
    if (result.success) refreshStatus();
    else showOp('error', result.error || 'Failed to stage all');
  }, [api, homeDir, unstaged, showOp, refreshStatus]);

  // Unstage all staged files
  const handleUnstageAll = useCallback(async () => {
    if (!api || !homeDir) return;
    const result = await api.gitUnstageFiles({ directory: homeDir, files: staged.map(f => f.path) });
    if (result.success) refreshStatus();
    else showOp('error', result.error || 'Failed to unstage all');
  }, [api, homeDir, staged, showOp, refreshStatus]);

  // Commit staged files only
  const handleCommitStaged = useCallback(async () => {
    if (!api || !homeDir || staged.length === 0) return;
    const msg = commitMessage.trim() || `Fetchy commit ${new Date().toISOString()}`;
    showOp('loading', 'Committing staged changes...');
    const result = await api.gitCommitStaged({ directory: homeDir, message: msg });
    if (result.success) {
      showOp('success', result.output || 'Changes committed');
      setCommitMessage('');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Commit failed');
    }
  }, [api, homeDir, staged.length, commitMessage, showOp, refreshStatus]);

  // Commit all (stage all + commit) — legacy behavior
  const handleCommit = useCallback(async () => {
    if (!api || !homeDir) return;
    const msg = commitMessage.trim() || `Fetchy commit ${new Date().toISOString()}`;
    showOp('loading', 'Committing changes...');
    const result = await api.gitAddCommit({ directory: homeDir, message: msg });
    if (result.success) {
      showOp('success', result.output || 'Changes committed');
      setCommitMessage('');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Commit failed');
    }
  }, [api, homeDir, commitMessage, showOp, refreshStatus]);

  // Commit + Push
  const handleCommitAndPush = useCallback(async () => {
    if (!api || !homeDir) return;
    const msg = commitMessage.trim() || `Fetchy sync ${new Date().toISOString()}`;
    showOp('loading', 'Committing and pushing...');
    const result = await api.gitAddCommitPush({ directory: homeDir, message: msg });
    if (result.success) {
      showOp('success', result.output || 'Changes synced');
      setCommitMessage('');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Sync failed');
    }
  }, [api, homeDir, commitMessage, showOp, refreshStatus]);

  // Set remote
  const handleSetRemote = useCallback(async () => {
    if (!api || !homeDir || !remoteUrl.trim()) return;
    showOp('loading', 'Setting remote...');
    const result = await api.gitRemoteSet({ directory: homeDir, url: remoteUrl.trim() });
    if (result.success) {
      showOp('success', 'Remote URL updated');
      setShowRemoteForm(false);
      refreshStatus();
    } else {
      showOp('error', result.error || 'Failed to set remote');
    }
  }, [api, homeDir, remoteUrl, showOp, refreshStatus]);

  // Checkout branch
  const handleCheckoutBranch = useCallback(async (branchName: string) => {
    if (!api || !homeDir) return;
    showOp('loading', `Switching to ${branchName}...`);
    setShowBranchDropdown(false);
    const result = await api.gitCheckoutBranch({ directory: homeDir, branch: branchName });
    if (result.success) {
      showOp('success', `Switched to ${branchName}`);
      refreshStatus();
    } else {
      showOp('error', result.error || 'Failed to switch branch');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Create new branch
  const handleCreateBranch = useCallback(async () => {
    if (!api || !homeDir || !newBranchName.trim()) return;
    showOp('loading', `Creating branch ${newBranchName.trim()}...`);
    const result = await api.gitCreateBranch({ directory: homeDir, branch: newBranchName.trim(), checkout: true });
    if (result.success) {
      showOp('success', `Created and switched to ${newBranchName.trim()}`);
      setNewBranchName('');
      setShowNewBranchForm(false);
      setShowBranchDropdown(false);
      refreshStatus();
    } else {
      showOp('error', result.error || 'Failed to create branch');
    }
  }, [api, homeDir, newBranchName, showOp, refreshStatus]);

  // Stash
  const handleStash = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Stashing changes...');
    const result = await api.gitStash({ directory: homeDir });
    if (result.success) {
      showOp('success', result.output || 'Changes stashed');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Stash failed');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Stash pop
  const handleStashPop = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Popping stash...');
    const result = await api.gitStashPop({ directory: homeDir });
    if (result.success) {
      showOp('success', result.output || 'Stash applied');
      refreshStatus();
    } else {
      showOp('error', result.error || 'Stash pop failed');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Resolve a single conflict by choosing a version
  const handleResolveFile = useCallback(async (filepath: string, strategy: 'ours' | 'theirs') => {
    if (!api || !homeDir) return;
    showOp('loading', `Resolving ${filepath} with ${strategy === 'ours' ? 'your' : 'their'} version...`);
    try {
      const versionRes = await api.gitShowConflictVersion({ directory: homeDir, filepath, version: strategy });
      if (!versionRes.success) {
        showOp('error', versionRes.error || 'Failed to get version content');
        return;
      }
      const resolveRes = await api.gitResolveConflict({ directory: homeDir, filepath, content: versionRes.content });
      if (resolveRes.success) {
        setResolvedFiles(prev => new Set([...prev, filepath]));
        showOp('success', `Resolved ${filepath}`);
      } else {
        showOp('error', resolveRes.error || 'Failed to resolve conflict');
      }
    } catch (e) {
      showOp('error', 'Error resolving conflict');
    }
  }, [api, homeDir, showOp]);

  // Resolve all conflicts with a single strategy
  const handleResolveAll = useCallback(async (strategy: 'ours' | 'theirs') => {
    if (!api || !homeDir) return;
    showOp('loading', `Resolving all conflicts with ${strategy === 'ours' ? 'your' : 'their'} version...`);
    const result = await api.gitResolveAllConflicts({ directory: homeDir, strategy });
    if (result.success) {
      showOp('success', 'All conflicts resolved');
      setConflictFiles([]);
      setResolvedFiles(new Set());
      refreshStatus();
    } else {
      showOp('error', result.error || 'Failed to resolve conflicts');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // Complete the merge after resolving all conflicts
  const handleCompleteMerge = useCallback(async () => {
    if (!api || !homeDir) return;
    const unresolvedCount = conflictFiles.filter(f => !resolvedFiles.has(f)).length;
    if (unresolvedCount > 0) {
      showOp('error', `${unresolvedCount} conflict(s) still unresolved`);
      return;
    }
    showOp('loading', 'Completing merge...');
    const result = await api.gitAddCommit({ directory: homeDir, message: 'Merge conflict resolution' });
    if (result.success) {
      showOp('success', 'Merge completed successfully');
      setIsMerging(false);
      setConflictFiles([]);
      setResolvedFiles(new Set());
      invalidateWriteCache();
      refreshStatus();
      await useAppStore.persist.rehydrate();
    } else {
      showOp('error', result.error || 'Failed to complete merge');
    }
  }, [api, homeDir, conflictFiles, resolvedFiles, showOp, refreshStatus]);

  // Abort the merge
  const handleAbortMerge = useCallback(async () => {
    if (!api || !homeDir) return;
    showOp('loading', 'Aborting merge...');
    const result = await api.gitMergeAbort({ directory: homeDir });
    if (result.success) {
      showOp('success', 'Merge aborted');
      setIsMerging(false);
      setConflictFiles([]);
      setResolvedFiles(new Set());
      invalidateWriteCache();
      refreshStatus();
      await useAppStore.persist.rehydrate();
    } else {
      showOp('error', result.error || 'Failed to abort merge');
    }
  }, [api, homeDir, showOp, refreshStatus]);

  // No workspace selected
  if (!workspace) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-gray-500'>
        <FolderGit2 size={32} className='mb-3 opacity-50' />
        <p className='text-sm'>No workspace selected.</p>
        <p className='text-xs mt-1'>Create or switch to a workspace to use Git integration.</p>
      </div>
    );
  }

  // Not running in Electron
  if (!api) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-gray-500'>
        <AlertCircle size={32} className='mb-3 opacity-50' />
        <p className='text-sm'>Git integration requires the desktop app.</p>
      </div>
    );
  }

  // Git not installed
  if (gitAvailable === false) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-gray-500'>
        <AlertCircle size={32} className='mb-3 text-red-400' />
        <p className='text-sm text-white'>Git is not installed on your system.</p>
        <p className='text-xs mt-2 text-gray-400 text-center max-w-sm'>
          Install Git from{' '}
          <a
            href='https://git-scm.com/downloads'
            target='_blank'
            rel='noopener noreferrer'
            className='text-purple-400 hover:underline inline-flex items-center gap-1'
          >
            git-scm.com <ExternalLink size={10} />
          </a>{' '}
          and restart Fetchy to enable Git integration.
        </p>
      </div>
    );
  }

  // Still loading
  if (gitAvailable === null) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 size={20} className='animate-spin text-purple-400' />
        <span className='ml-2 text-sm text-gray-400'>Checking git...</span>
      </div>
    );
  }

  const isRepo = status?.isRepo === true;
  const hasRemote = !!status?.remoteUrl;
  const totalChanges = (staged.length + unstaged.length);

  return (
    <div className='space-y-0 flex flex-col h-full'>
      {/* ══ Top Toolbar ══ */}
      <div className='flex items-center justify-between border-b border-[#2d2d44] pb-2.5 mb-3'>
        <div className='flex items-center gap-1.5'>
          <FolderGit2 size={15} className='text-purple-400' />
          <span className='text-sm text-white font-medium'>Git</span>
          <span className='text-[10px] text-gray-600 ml-1'>{gitVersion.replace('git version ', 'v')}</span>
        </div>
        <button
          onClick={refreshStatus}
          disabled={isRefreshing}
          className='p-1.5 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded transition-colors disabled:opacity-50'
          title='Refresh status'
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Operation status bar */}
      {opStatus !== 'idle' && (
        <div
          className={`flex items-center gap-2 p-2 rounded text-xs border mb-3 ${
            opStatus === 'loading'
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              : opStatus === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {opStatus === 'loading' && <Loader2 size={12} className='animate-spin shrink-0' />}
          {opStatus === 'success' && <Check size={12} className='shrink-0' />}
          {opStatus === 'error' && <AlertCircle size={12} className='shrink-0' />}
          <span className='truncate'>{opMessage}</span>
        </div>
      )}

      {/* Not a repo — show init/clone options */}
      {!isRepo && (
        <div className='space-y-3'>
          <div className='p-3 bg-[#0f0f1a] rounded border border-[#2d2d44] text-xs text-gray-400 font-mono truncate'>
            {homeDir}
          </div>
          <div className='p-4 bg-[#0f0f1a] rounded border border-[#2d2d44] space-y-3'>
            <div className='flex items-start gap-2'>
              <Info size={14} className='text-purple-400 mt-0.5 shrink-0' />
              <p className='text-xs text-gray-400'>
                Not a Git repository. Initialize or clone to enable version control.
              </p>
            </div>
            <div className='flex gap-2'>
              <button
                onClick={handleInit}
                disabled={opStatus === 'loading'}
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50'
              >
                <GitBranch size={12} />
                Initialize
              </button>
              <button
                onClick={() => setShowCloneForm(!showCloneForm)}
                disabled={opStatus === 'loading'}
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a1a2e] text-gray-300 rounded border border-[#2d2d44] hover:bg-[#2d2d44] transition-colors disabled:opacity-50'
              >
                <Download size={12} />
                Clone
              </button>
            </div>
            {showCloneForm && (
              <div className='space-y-2 pt-2 border-t border-[#2d2d44]'>
                <label className='text-xs text-gray-400'>Repository URL</label>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    placeholder='https://github.com/user/repo.git'
                    className='flex-1 px-3 py-1.5 bg-[#1a1a2e] border border-[#2d2d44] rounded text-white text-xs font-mono focus:outline-none focus:border-purple-500'
                  />
                  <button
                    onClick={handleClone}
                    disabled={opStatus === 'loading' || !cloneUrl.trim()}
                    className='px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-1'
                  >
                    {opStatus === 'loading' ? <Loader2 size={12} className='animate-spin' /> : <Download size={12} />}
                    Clone
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Repo is initialized — SourceTree-like layout ══ */}
      {isRepo && (
        <div className='flex flex-col gap-3 flex-1 min-h-0'>

          {/* ── Action Toolbar (SourceTree-style) ── */}
          <div className='flex items-center gap-1 p-1.5 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
            <button
              onClick={handleFetch}
              disabled={opStatus === 'loading' || !hasRemote}
              className='flex flex-col items-center gap-0.5 px-2.5 py-1.5 text-[10px] text-gray-300 rounded hover:bg-[#2d2d44] transition-colors disabled:opacity-40 min-w-[48px]'
              title={!hasRemote ? 'Set a remote first' : 'Fetch latest from remote'}
            >
              <RefreshCw size={14} />
              <span>Fetch</span>
            </button>
            <button
              onClick={handlePull}
              disabled={opStatus === 'loading' || !hasRemote}
              className='flex flex-col items-center gap-0.5 px-2.5 py-1.5 text-[10px] text-gray-300 rounded hover:bg-[#2d2d44] transition-colors disabled:opacity-40 min-w-[48px]'
              title={!hasRemote ? 'Set a remote first' : 'Pull changes from remote'}
            >
              <Download size={14} />
              <span>Pull</span>
            </button>
            <button
              onClick={handlePush}
              disabled={opStatus === 'loading' || !hasRemote}
              className='flex flex-col items-center gap-0.5 px-2.5 py-1.5 text-[10px] text-gray-300 rounded hover:bg-[#2d2d44] transition-colors disabled:opacity-40 min-w-[48px]'
              title={!hasRemote ? 'Set a remote first' : 'Push commits to remote'}
            >
              <Upload size={14} />
              <span>Push</span>
            </button>

            <div className='w-px h-6 bg-[#2d2d44] mx-0.5' />

            {/* Branch button with dropdown */}
            <div className='relative' ref={branchDropdownRef}>
              <button
                onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                className='flex flex-col items-center gap-0.5 px-2.5 py-1.5 text-[10px] text-gray-300 rounded hover:bg-[#2d2d44] transition-colors min-w-[48px]'
                title='Switch branch'
              >
                <GitBranch size={14} />
                <span>Branch</span>
              </button>

              {showBranchDropdown && (
                <div className='absolute top-full left-0 mt-1 w-64 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto'>
                  {/* Create new branch */}
                  <div className='p-2 border-b border-[#2d2d44]'>
                    {!showNewBranchForm ? (
                      <button
                        onClick={() => setShowNewBranchForm(true)}
                        className='flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-purple-400 hover:bg-[#2d2d44] rounded transition-colors'
                      >
                        <Plus size={12} />
                        New Branch
                      </button>
                    ) : (
                      <div className='space-y-1.5'>
                        <input
                          type='text'
                          value={newBranchName}
                          onChange={(e) => setNewBranchName(e.target.value)}
                          placeholder='branch-name'
                          className='w-full px-2 py-1 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-xs font-mono focus:outline-none focus:border-purple-500'
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBranch(); if (e.key === 'Escape') setShowNewBranchForm(false); }}
                          autoFocus
                        />
                        <div className='flex gap-1'>
                          <button
                            onClick={handleCreateBranch}
                            disabled={!newBranchName.trim()}
                            className='flex-1 px-2 py-1 text-[10px] bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50'
                          >
                            Create & Switch
                          </button>
                          <button
                            onClick={() => { setShowNewBranchForm(false); setNewBranchName(''); }}
                            className='px-2 py-1 text-[10px] text-gray-400 hover:text-white'
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Local branches */}
                  <div className='p-1'>
                    <p className='px-2 py-1 text-[10px] text-gray-500 uppercase font-medium tracking-wider'>Local</p>
                    {branches.local.map((b) => (
                      <button
                        key={b.name}
                        onClick={() => !b.current && handleCheckoutBranch(b.name)}
                        className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded transition-colors ${
                          b.current
                            ? 'bg-purple-500/15 text-purple-300'
                            : 'text-gray-300 hover:bg-[#2d2d44]'
                        }`}
                        disabled={b.current}
                      >
                        <GitBranch size={11} className={b.current ? 'text-purple-400' : 'text-gray-500'} />
                        <span className='truncate flex-1 text-left'>{b.name}</span>
                        {b.current && <Check size={11} className='text-purple-400 shrink-0' />}
                        <span className='text-[9px] font-mono text-gray-600 shrink-0'>{b.hash}</span>
                      </button>
                    ))}
                  </div>

                  {/* Remote branches */}
                  {branches.remote.length > 0 && (
                    <div className='p-1 border-t border-[#2d2d44]'>
                      <p className='px-2 py-1 text-[10px] text-gray-500 uppercase font-medium tracking-wider'>Remote</p>
                      {branches.remote.map((b) => (
                        <button
                          key={b.name}
                          onClick={() => handleCheckoutBranch(b.name.replace(/^origin\//, ''))}
                          className='flex items-center gap-2 w-full px-2 py-1.5 text-xs text-gray-400 hover:bg-[#2d2d44] rounded transition-colors'
                        >
                          <GitBranch size={11} className='text-gray-600' />
                          <span className='truncate flex-1 text-left'>{b.name}</span>
                          <span className='text-[9px] font-mono text-gray-600 shrink-0'>{b.hash}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className='w-px h-6 bg-[#2d2d44] mx-0.5' />

            <button
              onClick={handleStash}
              disabled={opStatus === 'loading' || !status?.hasChanges}
              className='flex flex-col items-center gap-0.5 px-2.5 py-1.5 text-[10px] text-gray-300 rounded hover:bg-[#2d2d44] transition-colors disabled:opacity-40 min-w-[48px]'
              title='Stash changes'
            >
              <Archive size={14} />
              <span>Stash</span>
            </button>
            <button
              onClick={handleStashPop}
              disabled={opStatus === 'loading'}
              className='flex flex-col items-center gap-0.5 px-2.5 py-1.5 text-[10px] text-gray-300 rounded hover:bg-[#2d2d44] transition-colors disabled:opacity-40 min-w-[48px]'
              title='Pop stash'
            >
              <ArchiveRestore size={14} />
              <span>Pop</span>
            </button>
          </div>

          {/* ── Branch & Status Bar ── */}
          <div className='flex items-center gap-3 px-3 py-2 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
            <div className='flex items-center gap-1.5 flex-1 min-w-0'>
              <GitBranch size={13} className='text-purple-400 shrink-0' />
              <span className='text-xs text-white font-mono truncate'>{status?.branch || 'unknown'}</span>
            </div>

            {/* Ahead/behind badges */}
            {hasRemote && (
              <div className='flex items-center gap-2 shrink-0'>
                {(status?.ahead ?? 0) > 0 && (
                  <span className='flex items-center gap-0.5 text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded'>
                    <ArrowUp size={10} /> {status?.ahead}
                  </span>
                )}
                {(status?.behind ?? 0) > 0 && (
                  <span className='flex items-center gap-0.5 text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded'>
                    <ArrowDown size={10} /> {status?.behind}
                  </span>
                )}
                {(status?.ahead ?? 0) === 0 && (status?.behind ?? 0) === 0 && (
                  <span className='text-[10px] text-gray-500'>up to date</span>
                )}
              </div>
            )}

            {/* Total changes badge */}
            {totalChanges > 0 && (
              <span className='text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded shrink-0'>
                {totalChanges} change{totalChanges !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── Remote URL ── */}
          <div className='flex items-center gap-2 px-3 py-1.5 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
            <Link2 size={11} className='text-gray-500 shrink-0' />
            {hasRemote ? (
              <span className='text-[10px] text-gray-400 font-mono truncate flex-1'>{status?.remoteUrl}</span>
            ) : (
              <span className='text-[10px] text-gray-500 flex-1'>No remote configured</span>
            )}
            <button
              onClick={() => setShowRemoteForm(!showRemoteForm)}
              className='text-[10px] text-purple-400 hover:text-purple-300 transition-colors shrink-0'
            >
              {hasRemote ? 'Edit' : 'Set'}
            </button>
          </div>
          {showRemoteForm && (
            <div className='flex gap-2'>
              <input
                type='text'
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder='https://github.com/user/repo.git'
                className='flex-1 px-2 py-1 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-xs font-mono focus:outline-none focus:border-purple-500'
              />
              <button
                onClick={handleSetRemote}
                disabled={opStatus === 'loading' || !remoteUrl.trim()}
                className='px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50'
              >
                Save
              </button>
            </div>
          )}

          {/* ── Merge Conflict Resolution Panel ── */}
          {isMerging && conflictFiles.length > 0 && (
            <div className='space-y-3 p-3 bg-red-500/5 border border-red-500/30 rounded-lg'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <AlertTriangle size={14} className='text-red-400' />
                  <span className='text-xs font-medium text-red-300'>Merge Conflicts</span>
                  <span className='text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded-full'>
                    {conflictFiles.filter(f => !resolvedFiles.has(f)).length} unresolved
                  </span>
                </div>
                <div className='flex gap-1'>
                  <button
                    onClick={() => handleResolveAll('ours')}
                    disabled={opStatus === 'loading'}
                    className='px-2 py-0.5 text-[10px] bg-blue-600/80 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50'
                  >
                    All Mine
                  </button>
                  <button
                    onClick={() => handleResolveAll('theirs')}
                    disabled={opStatus === 'loading'}
                    className='px-2 py-0.5 text-[10px] bg-orange-600/80 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50'
                  >
                    All Theirs
                  </button>
                </div>
              </div>

              <div className='max-h-32 overflow-y-auto space-y-1'>
                {conflictFiles.map((file) => {
                  const isResolved = resolvedFiles.has(file);
                  return (
                    <div
                      key={file}
                      className={`flex items-center justify-between p-1.5 rounded border transition-colors ${
                        isResolved
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-[#0f0f1a] border-[#2d2d44]'
                      }`}
                    >
                      <div className='flex items-center gap-1.5 min-w-0'>
                        {isResolved ? (
                          <CheckCircle size={11} className='text-green-400 shrink-0' />
                        ) : (
                          <XCircle size={11} className='text-red-400 shrink-0' />
                        )}
                        <span className='text-[10px] font-mono text-gray-300 truncate'>{file}</span>
                      </div>
                      {!isResolved && (
                        <div className='flex gap-1 shrink-0 ml-2'>
                          <button
                            onClick={() => handleResolveFile(file, 'ours')}
                            disabled={opStatus === 'loading'}
                            className='px-1.5 py-0.5 text-[9px] bg-blue-600/60 text-blue-200 rounded hover:bg-blue-600 disabled:opacity-50'
                          >
                            Mine
                          </button>
                          <button
                            onClick={() => handleResolveFile(file, 'theirs')}
                            disabled={opStatus === 'loading'}
                            className='px-1.5 py-0.5 text-[9px] bg-orange-600/60 text-orange-200 rounded hover:bg-orange-600 disabled:opacity-50'
                          >
                            Theirs
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {onOpenConflictResolver && (
                <button
                  onClick={onOpenConflictResolver}
                  disabled={opStatus === 'loading'}
                  className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 w-full justify-center'
                >
                  <Eye size={13} />
                  Open 3-Way Merge Editor
                </button>
              )}

              <div className='flex gap-2 pt-2 border-t border-red-500/20'>
                <button
                  onClick={handleCompleteMerge}
                  disabled={opStatus === 'loading' || conflictFiles.some(f => !resolvedFiles.has(f))}
                  className='flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50'
                >
                  <GitMerge size={11} />
                  Complete Merge
                </button>
                <button
                  onClick={handleAbortMerge}
                  disabled={opStatus === 'loading'}
                  className='flex items-center gap-1 px-2.5 py-1 text-xs bg-red-600/80 text-white rounded hover:bg-red-700 disabled:opacity-50'
                >
                  <XCircle size={11} />
                  Abort Merge
                </button>
              </div>
            </div>
          )}

          {/* ── Unstaged Files Panel ── */}
          <div className='bg-[#0f0f1a] rounded border border-[#2d2d44] overflow-hidden'>
            <button
              onClick={() => setExpandedUnstaged(!expandedUnstaged)}
              className='flex items-center justify-between w-full px-3 py-2 hover:bg-[#1a1a2e] transition-colors'
            >
              <div className='flex items-center gap-2'>
                {expandedUnstaged ? <ChevronDown size={12} className='text-gray-500' /> : <ChevronRight size={12} className='text-gray-500' />}
                <span className='text-xs font-medium text-gray-300'>Unstaged files</span>
                {unstaged.length > 0 && (
                  <span className='text-[10px] px-1.5 py-0.5 bg-yellow-500/15 text-yellow-400 rounded-full'>{unstaged.length}</span>
                )}
              </div>
              {unstaged.length > 0 && expandedUnstaged && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStageAll(); }}
                  className='text-[10px] px-2 py-0.5 bg-purple-600/80 text-white rounded hover:bg-purple-600 transition-colors'
                  title='Stage all files'
                >
                  Stage All
                </button>
              )}
            </button>

            {expandedUnstaged && (
              <div className='max-h-44 overflow-y-auto border-t border-[#2d2d44]'>
                {unstaged.length === 0 ? (
                  <p className='text-[10px] text-gray-600 text-center py-3'>No unstaged changes</p>
                ) : (
                  unstaged.map((file) => (
                    <div
                      key={file.path}
                      className='flex items-center gap-2 px-3 py-1 hover:bg-[#1a1a2e] transition-colors group'
                    >
                      {statusIcon(file.status)}
                      <span className='text-[11px] font-mono text-gray-300 truncate flex-1'>{file.path}</span>
                      {statusBadge(file.status)}
                      <div className='flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0'>
                        <button
                          onClick={() => handleStageFiles([file.path])}
                          className='p-0.5 text-green-400 hover:bg-green-500/20 rounded transition-colors'
                          title='Stage this file'
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => handleDiscardFiles([file.path])}
                          className='p-0.5 text-red-400 hover:bg-red-500/20 rounded transition-colors'
                          title='Discard changes'
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Staged Files Panel ── */}
          <div className='bg-[#0f0f1a] rounded border border-[#2d2d44] overflow-hidden'>
            <button
              onClick={() => setExpandedStaged(!expandedStaged)}
              className='flex items-center justify-between w-full px-3 py-2 hover:bg-[#1a1a2e] transition-colors'
            >
              <div className='flex items-center gap-2'>
                {expandedStaged ? <ChevronDown size={12} className='text-gray-500' /> : <ChevronRight size={12} className='text-gray-500' />}
                <span className='text-xs font-medium text-gray-300'>Staged files</span>
                {staged.length > 0 && (
                  <span className='text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded-full'>{staged.length}</span>
                )}
              </div>
              {staged.length > 0 && expandedStaged && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnstageAll(); }}
                  className='text-[10px] px-2 py-0.5 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors'
                  title='Unstage all files'
                >
                  Unstage All
                </button>
              )}
            </button>

            {expandedStaged && (
              <div className='max-h-44 overflow-y-auto border-t border-[#2d2d44]'>
                {staged.length === 0 ? (
                  <p className='text-[10px] text-gray-600 text-center py-3'>No staged changes</p>
                ) : (
                  staged.map((file) => (
                    <div
                      key={file.path}
                      className='flex items-center gap-2 px-3 py-1 hover:bg-[#1a1a2e] transition-colors group'
                    >
                      {statusIcon(file.status)}
                      <span className='text-[11px] font-mono text-gray-300 truncate flex-1'>{file.path}</span>
                      {statusBadge(file.status)}
                      <div className='flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0'>
                        <button
                          onClick={() => handleUnstageFiles([file.path])}
                          className='p-0.5 text-yellow-400 hover:bg-yellow-500/20 rounded transition-colors'
                          title='Unstage this file'
                        >
                          <Minus size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Commit Area ── */}
          <div className='bg-[#0f0f1a] rounded border border-[#2d2d44] p-3 space-y-2'>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder='Commit message...'
              rows={2}
              className='w-full px-2.5 py-1.5 bg-[#1a1a2e] border border-[#2d2d44] rounded text-white text-xs resize-none focus:outline-none focus:border-purple-500'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  if (staged.length > 0) handleCommitStaged();
                  else if (status?.hasChanges) handleCommit();
                }
              }}
            />
            <div className='flex gap-2'>
              {/* Commit staged only */}
              <button
                onClick={handleCommitStaged}
                disabled={opStatus === 'loading' || staged.length === 0}
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 flex-1 justify-center'
                title='Commit staged files only'
              >
                <GitCommitHorizontal size={12} />
                Commit ({staged.length})
              </button>
              {/* Commit all (stage all + commit) */}
              <button
                onClick={handleCommit}
                disabled={opStatus === 'loading' || !status?.hasChanges}
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a1a2e] text-gray-300 border border-[#2d2d44] rounded hover:bg-[#2d2d44] transition-colors disabled:opacity-50'
                title='Stage all and commit'
              >
                Commit All
              </button>
              {hasRemote && (
                <button
                  onClick={handleCommitAndPush}
                  disabled={opStatus === 'loading' || !status?.hasChanges}
                  className='flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50'
                  title='Stage all, commit and push to remote'
                >
                  <GitPullRequest size={12} />
                  Sync
                </button>
              )}
            </div>
            <p className='text-[10px] text-gray-600'>Ctrl+Enter to commit staged</p>
          </div>

          {/* ── Auto-sync toggle ── */}
          <div className='flex items-center justify-between px-3 py-2 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
            <div className='min-w-0'>
              <label className='text-xs text-gray-300'>Auto-sync</label>
              <p className='text-[10px] text-gray-600 truncate'>Commit & push on save</p>
            </div>
            <input
              type='checkbox'
              checked={autoSync}
              onChange={(e) => handleAutoSyncToggle(e.target.checked)}
              disabled={!hasRemote}
              className='w-3.5 h-3.5 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-500 focus:ring-purple-500 shrink-0'
            />
          </div>
          {autoSync && (
            <div className='p-2 bg-purple-500/10 border border-purple-500/30 rounded text-[10px] text-purple-300 flex items-start gap-1.5'>
              <Info size={11} className='shrink-0 mt-0.5' />
              <span>Changes auto-committed and pushed after each save. Ensure Git credentials are configured.</span>
            </div>
          )}

          {/* ── Recent Commits ── */}
          {commits.length > 0 && (
            <div className='bg-[#0f0f1a] rounded border border-[#2d2d44] overflow-hidden'>
              <button
                onClick={() => setExpandedCommits(!expandedCommits)}
                className='flex items-center gap-2 w-full px-3 py-2 hover:bg-[#1a1a2e] transition-colors'
              >
                {expandedCommits ? <ChevronDown size={12} className='text-gray-500' /> : <ChevronRight size={12} className='text-gray-500' />}
                <Clock size={12} className='text-gray-500' />
                <span className='text-xs font-medium text-gray-300'>History</span>
                <span className='text-[10px] text-gray-600'>{commits.length}</span>
              </button>

              {expandedCommits && (
                <div className='max-h-56 overflow-y-auto border-t border-[#2d2d44]'>
                  {commits.map((c, idx) => (
                    <div
                      key={idx}
                      className='px-3 py-1.5 border-b border-[#2d2d44]/50 last:border-b-0 hover:bg-[#1a1a2e] transition-colors'
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <p className='text-[11px] text-white truncate flex-1'>{c.message}</p>
                        <span className='text-[9px] font-mono text-gray-600 shrink-0'>{c.hash.slice(0, 7)}</span>
                      </div>
                      <div className='flex items-center gap-2 mt-0.5'>
                        <span className='text-[10px] text-gray-500'>{c.author}</span>
                        <span className='text-[10px] text-gray-600'>
                          {c.date ? new Date(c.date).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
