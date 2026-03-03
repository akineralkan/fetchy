import { useState, useCallback, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  GitMerge,
  Loader2,
  FileCode,
  ArrowLeft,
  ArrowRight,
  Copy,
  RotateCcw,
  Save,
  Check,
  AlertCircle,
  Info,
} from 'lucide-react';
import ThreeWayMergeViewer from './ThreeWayMergeViewer';
import { hasConflictMarkers } from '../utils/mergeConflict';

// ── Types ────────────────────────────────────────────────────────────────────

interface ResolveConflictsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Workspace home directory */
  homeDirectory: string;
  /** List of conflicted file paths (relative to homeDirectory) */
  conflictFiles: string[];
  /** Called when the user finishes resolving all conflicts and wants to complete merge */
  onCompleteMerge: () => void;
  /** Called when user aborts the merge */
  onAbortMerge: () => void;
  /** Called when individual file resolution changes (for external state tracking) */
  onFileResolved?: (filepath: string) => void;
}

type FileStatus = 'unresolved' | 'resolving' | 'resolved';

interface FileConflictData {
  filepath: string;
  status: FileStatus;
  baseContent: string;
  oursContent: string;
  theirsContent: string;
  mergedContent: string;
  /** Original working copy content (may have conflict markers) */
  originalContent: string;
  isLoading: boolean;
  error?: string;
}

type OpStatus = 'idle' | 'loading' | 'success' | 'error';

// ── Component ──────────────────────────────────────────────────────────────

export default function ResolveConflictsDialog({
  isOpen,
  onClose,
  homeDirectory,
  conflictFiles,
  onCompleteMerge,
  onAbortMerge,
  onFileResolved,
}: ResolveConflictsDialogProps) {
  const api = window.electronAPI;

  // ── State ──────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<FileConflictData[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [fileListExpanded, setFileListExpanded] = useState(true);
  const [opStatus, setOpStatus] = useState<OpStatus>('idle');
  const [opMessage, setOpMessage] = useState('');
  const [confirmAbort, setConfirmAbort] = useState(false);

  // Derived
  const activeFile = files[activeFileIndex] ?? null;
  const resolvedCount = files.filter((f) => f.status === 'resolved').length;
  const totalCount = files.length;
  const allResolved = resolvedCount === totalCount && totalCount > 0;

  // ── Initialize file data on open ───────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !api || !homeDirectory || conflictFiles.length === 0) return;

    const initialFiles: FileConflictData[] = conflictFiles.map((fp) => ({
      filepath: fp,
      status: 'unresolved',
      baseContent: '',
      oursContent: '',
      theirsContent: '',
      mergedContent: '',
      originalContent: '',
      isLoading: false,
    }));
    setFiles(initialFiles);
    setActiveFileIndex(0);
    setConfirmAbort(false);
    setOpStatus('idle');
    setOpMessage('');
  }, [isOpen, api, homeDirectory, conflictFiles]);

  // ── Load conflict data for the active file ────────────────────────────
  useEffect(() => {
    if (!isOpen || !api || !homeDirectory || !activeFile) return;
    // Only load if we haven't loaded yet
    if (activeFile.isLoading || activeFile.oursContent || activeFile.error) return;

    const loadFileData = async () => {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === activeFileIndex ? { ...f, isLoading: true } : f
        )
      );

      try {
        const [oursRes, theirsRes, baseRes, workingRes] = await Promise.all([
          api.gitShowConflictVersion({ directory: homeDirectory, filepath: activeFile.filepath, version: 'ours' }),
          api.gitShowConflictVersion({ directory: homeDirectory, filepath: activeFile.filepath, version: 'theirs' }),
          api.gitShowBaseVersion({ directory: homeDirectory, filepath: activeFile.filepath }),
          api.gitReadFileContent({ directory: homeDirectory, filepath: activeFile.filepath }),
        ]);

        const oursContent = oursRes.success ? oursRes.content : '';
        const theirsContent = theirsRes.success ? theirsRes.content : '';
        const baseContent = baseRes.success ? baseRes.content : '';
        const workingContent = workingRes.success ? workingRes.content : '';

        // Start with ours as the initial merged content (user can edit from there)
        setFiles((prev) =>
          prev.map((f, i) =>
            i === activeFileIndex
              ? {
                  ...f,
                  isLoading: false,
                  oursContent,
                  theirsContent,
                  baseContent,
                  originalContent: workingContent,
                  mergedContent: oursContent, // default to ours
                }
              : f
          )
        );
      } catch (e) {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === activeFileIndex
              ? {
                  ...f,
                  isLoading: false,
                  error: 'Failed to load conflict data',
                }
              : f
          )
        );
      }
    };

    loadFileData();
  }, [isOpen, api, homeDirectory, activeFile, activeFileIndex]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const showOp = useCallback((status: OpStatus, msg: string) => {
    setOpStatus(status);
    setOpMessage(msg);
    if (status !== 'loading') {
      setTimeout(() => {
        setOpStatus('idle');
        setOpMessage('');
      }, 4000);
    }
  }, []);

  const handleMergedContentChange = useCallback(
    (content: string) => {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === activeFileIndex ? { ...f, mergedContent: content, status: 'resolving' } : f
        )
      );
    },
    [activeFileIndex]
  );

  /** Accept ours for active file */
  const handleAcceptOurs = useCallback(() => {
    if (!activeFile) return;
    setFiles((prev) =>
      prev.map((f, i) =>
        i === activeFileIndex ? { ...f, mergedContent: f.oursContent, status: 'resolving' } : f
      )
    );
  }, [activeFile, activeFileIndex]);

  /** Accept theirs for active file */
  const handleAcceptTheirs = useCallback(() => {
    if (!activeFile) return;
    setFiles((prev) =>
      prev.map((f, i) =>
        i === activeFileIndex ? { ...f, mergedContent: f.theirsContent, status: 'resolving' } : f
      )
    );
  }, [activeFile, activeFileIndex]);

  /** Reset to original working copy */
  const handleResetFile = useCallback(() => {
    if (!activeFile) return;
    setFiles((prev) =>
      prev.map((f, i) =>
        i === activeFileIndex ? { ...f, mergedContent: f.oursContent, status: 'unresolved' } : f
      )
    );
  }, [activeFile, activeFileIndex]);

  /** Mark current file as resolved — writes content and stages it */
  const handleMarkResolved = useCallback(async () => {
    if (!api || !homeDirectory || !activeFile) return;

    // Check if the resolved content still has conflict markers
    if (hasConflictMarkers(activeFile.mergedContent)) {
      showOp('error', 'Content still contains conflict markers. Please resolve all conflicts before marking as resolved.');
      return;
    }

    showOp('loading', `Saving resolved version of ${activeFile.filepath}...`);

    try {
      // Write the resolved content and stage it
      const result = await api.gitResolveConflict({
        directory: homeDirectory,
        filepath: activeFile.filepath,
        content: activeFile.mergedContent,
      });

      if (result.success) {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === activeFileIndex ? { ...f, status: 'resolved' } : f
          )
        );
        showOp('success', `${activeFile.filepath} resolved`);
        onFileResolved?.(activeFile.filepath);

        // Auto-advance to next unresolved file
        const nextUnresolved = files.findIndex(
          (f, i) => i !== activeFileIndex && f.status !== 'resolved'
        );
        if (nextUnresolved >= 0) {
          setActiveFileIndex(nextUnresolved);
        }
      } else {
        showOp('error', result.error || 'Failed to save resolved file');
      }
    } catch (e) {
      showOp('error', 'Failed to save resolved file');
    }
  }, [api, homeDirectory, activeFile, activeFileIndex, files, showOp, onFileResolved]);

  /** Navigate between files */
  const handlePrevFile = useCallback(() => {
    if (activeFileIndex > 0) setActiveFileIndex(activeFileIndex - 1);
  }, [activeFileIndex]);

  const handleNextFile = useCallback(() => {
    if (activeFileIndex < files.length - 1) setActiveFileIndex(activeFileIndex + 1);
  }, [activeFileIndex, files.length]);

  /** Complete merge (user-triggered) */
  const handleCompleteMerge = useCallback(() => {
    if (!allResolved) {
      showOp('error', `${totalCount - resolvedCount} file(s) still unresolved`);
      return;
    }
    onCompleteMerge();
  }, [allResolved, totalCount, resolvedCount, showOp, onCompleteMerge]);

  /** Abort merge with confirmation */
  const handleAbortMerge = useCallback(() => {
    if (!confirmAbort) {
      setConfirmAbort(true);
      return;
    }
    onAbortMerge();
  }, [confirmAbort, onAbortMerge]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      // Escape closes (or cancels abort confirm)
      if (e.key === 'Escape') {
        if (confirmAbort) {
          setConfirmAbort(false);
        } else {
          onClose();
        }
      }
      // Ctrl+S saves the current file as resolved
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleMarkResolved();
      }
      // Alt+Left/Right to navigate files
      if (e.altKey && e.key === 'ArrowLeft') {
        handlePrevFile();
      }
      if (e.altKey && e.key === 'ArrowRight') {
        handleNextFile();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, confirmAbort, onClose, handleMarkResolved, handlePrevFile, handleNextFile]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a15]">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#12121f] border-b border-[#2d2d44] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <GitMerge size={16} className="text-red-400" />
            <h1 className="text-sm font-semibold text-white">Resolve Merge Conflicts</h1>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#1a1a2e] border border-[#2d2d44]">
            <span className="text-[10px] text-gray-400">
              {resolvedCount} / {totalCount} resolved
            </span>
            {allResolved && <CheckCircle size={10} className="text-green-400" />}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Complete merge button */}
          <button
            onClick={handleCompleteMerge}
            disabled={!allResolved || opStatus === 'loading'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={allResolved ? 'Complete the merge' : 'Resolve all files to complete the merge'}
          >
            <GitMerge size={12} />
            Complete Merge
          </button>

          {/* Abort merge */}
          {confirmAbort ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-300">Are you sure?</span>
              <button
                onClick={handleAbortMerge}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Yes, Abort
              </button>
              <button
                onClick={() => setConfirmAbort(false)}
                className="px-2 py-1 text-xs bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleAbortMerge}
              disabled={opStatus === 'loading'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/70 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-40"
            >
              <XCircle size={12} />
              Abort Merge
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded transition-colors"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Op Status Bar ── */}
      {opStatus !== 'idle' && (
        <div
          className={`flex items-center gap-2 px-4 py-1.5 text-xs border-b shrink-0 ${
            opStatus === 'loading'
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              : opStatus === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {opStatus === 'loading' && <Loader2 size={12} className="animate-spin" />}
          {opStatus === 'success' && <Check size={12} />}
          {opStatus === 'error' && <AlertCircle size={12} />}
          <span>{opMessage}</span>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex min-h-0">
        {/* ── Left sidebar: File list ── */}
        <div className="w-64 shrink-0 bg-[#0f0f1a] border-r border-[#2d2d44] flex flex-col">
          {/* File list header */}
          <button
            onClick={() => setFileListExpanded(!fileListExpanded)}
            className="flex items-center gap-2 px-3 py-2 border-b border-[#2d2d44] hover:bg-[#1a1a2e] transition-colors w-full text-left"
          >
            {fileListExpanded ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-xs font-medium text-gray-300">Conflicted Files</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded-full ml-auto">
              {totalCount - resolvedCount}
            </span>
          </button>

          {/* File list */}
          {fileListExpanded && (
            <div className="flex-1 overflow-y-auto">
              {files.map((file, idx) => {
                const isActive = idx === activeFileIndex;
                const isResolved = file.status === 'resolved';

                return (
                  <button
                    key={file.filepath}
                    onClick={() => setActiveFileIndex(idx)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-l-2 ${
                      isActive
                        ? 'bg-[#1a1a2e] border-purple-500 text-white'
                        : 'border-transparent hover:bg-[#1a1a2e]/50 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {isResolved ? (
                      <CheckCircle size={12} className="text-green-400 shrink-0" />
                    ) : file.isLoading ? (
                      <Loader2 size={12} className="animate-spin text-purple-400 shrink-0" />
                    ) : (
                      <FileCode size={12} className="text-red-400 shrink-0" />
                    )}
                    <span className="text-xs font-mono truncate">{file.filepath}</span>
                    {isResolved && (
                      <span className="text-[9px] px-1 py-0.5 bg-green-500/20 text-green-400 rounded ml-auto shrink-0">
                        Done
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Navigation & Info */}
          <div className="border-t border-[#2d2d44] p-3 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevFile}
                disabled={activeFileIndex === 0}
                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-[#1a1a2e] text-gray-300 hover:bg-[#2d2d44] transition-colors disabled:opacity-30"
              >
                <ArrowLeft size={10} />
                Prev
              </button>
              <span className="text-[10px] text-gray-500">
                {activeFileIndex + 1} / {totalCount}
              </span>
              <button
                onClick={handleNextFile}
                disabled={activeFileIndex >= files.length - 1}
                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-[#1a1a2e] text-gray-300 hover:bg-[#2d2d44] transition-colors disabled:opacity-30"
              >
                Next
                <ArrowRight size={10} />
              </button>
            </div>

            {/* Shortcuts hint */}
            <div className="text-[9px] text-gray-600 space-y-0.5">
              <p><kbd className="px-1 bg-[#1a1a2e] rounded text-gray-500">Ctrl+S</kbd> Save & mark resolved</p>
              <p><kbd className="px-1 bg-[#1a1a2e] rounded text-gray-500">Alt+←/→</kbd> Navigate files</p>
              <p><kbd className="px-1 bg-[#1a1a2e] rounded text-gray-500">Esc</kbd> Close dialog</p>
            </div>
          </div>
        </div>

        {/* ── Main editor area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeFile ? (
            <>
              {/* File toolbar */}
              <div className="flex items-center justify-between px-4 py-2 bg-[#12121f] border-b border-[#2d2d44] shrink-0">
                <div className="flex items-center gap-2">
                  <FileCode size={14} className="text-purple-400" />
                  <span className="text-xs font-mono text-white">{activeFile.filepath}</span>
                  {activeFile.status === 'resolved' && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                      <CheckCircle size={10} />
                      Resolved
                    </span>
                  )}
                  {activeFile.status === 'resolving' && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                      Editing...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Quick accept buttons */}
                  <button
                    onClick={handleAcceptOurs}
                    disabled={activeFile.isLoading || activeFile.status === 'resolved'}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-blue-600/60 text-blue-200 rounded hover:bg-blue-600 transition-colors disabled:opacity-30"
                    title="Accept your local version entirely"
                  >
                    <Copy size={10} />
                    Accept Yours
                  </button>
                  <button
                    onClick={handleAcceptTheirs}
                    disabled={activeFile.isLoading || activeFile.status === 'resolved'}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-orange-600/60 text-orange-200 rounded hover:bg-orange-600 transition-colors disabled:opacity-30"
                    title="Accept remote version entirely"
                  >
                    <Copy size={10} />
                    Accept Theirs
                  </button>

                  <div className="w-px h-4 bg-[#2d2d44] mx-1" />

                  {/* Reset */}
                  <button
                    onClick={handleResetFile}
                    disabled={activeFile.isLoading || activeFile.status === 'resolved'}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-[#1a1a2e] text-gray-300 rounded hover:bg-[#2d2d44] transition-colors disabled:opacity-30"
                    title="Reset to local version"
                  >
                    <RotateCcw size={10} />
                    Reset
                  </button>

                  {/* Save / Mark resolved */}
                  <button
                    onClick={handleMarkResolved}
                    disabled={activeFile.isLoading || activeFile.status === 'resolved' || opStatus === 'loading'}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-30"
                    title="Save resolved content and mark as resolved (Ctrl+S)"
                  >
                    <Save size={10} />
                    Mark Resolved
                  </button>
                </div>
              </div>

              {/* Three-way merge viewer */}
              <div className="flex-1 min-h-0">
                {activeFile.isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={24} className="animate-spin text-purple-400" />
                    <span className="ml-3 text-sm text-gray-400">Loading conflict data...</span>
                  </div>
                ) : activeFile.error ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <AlertTriangle size={24} className="text-red-400 mb-2" />
                    <p className="text-sm">{activeFile.error}</p>
                  </div>
                ) : (
                  <ThreeWayMergeViewer
                    filename={activeFile.filepath}
                    baseContent={activeFile.baseContent}
                    oursContent={activeFile.oursContent}
                    theirsContent={activeFile.theirsContent}
                    mergedContent={activeFile.mergedContent}
                    onMergedContentChange={handleMergedContentChange}
                    readOnly={activeFile.status === 'resolved'}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Info size={24} className="mb-2 opacity-50" />
              <p className="text-sm">No conflicted files to display.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Bar: Summary ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#12121f] border-t border-[#2d2d44] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] text-gray-400">Yours (Local)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-[10px] text-gray-400">Result (Editable)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-[10px] text-gray-400">Theirs (Remote)</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: totalCount > 0 ? `${(resolvedCount / totalCount) * 100}%` : '0%' }}
              />
            </div>
            <span>
              {resolvedCount}/{totalCount}
            </span>
          </div>

          {allResolved ? (
            <span className="text-green-400 flex items-center gap-1">
              <CheckCircle size={10} />
              All conflicts resolved — ready to complete merge
            </span>
          ) : (
            <span className="text-yellow-400 flex items-center gap-1">
              <AlertTriangle size={10} />
              {totalCount - resolvedCount} file(s) remaining
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
