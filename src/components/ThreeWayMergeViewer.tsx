import { useState, useRef, useEffect, useCallback } from 'react';
import { computeLineDiff, type DiffLine } from '../utils/mergeConflict';

// ── Types ────────────────────────────────────────────────────────────────────

interface ThreeWayMergeViewerProps {
  /** Display name of the file being merged */
  filename: string;
  /** The common ancestor (base) content */
  baseContent: string;
  /** Our (local) version */
  oursContent: string;
  /** Their (remote) version */
  theirsContent: string;
  /** Current merged/resolved content for the editable center pane */
  mergedContent: string;
  /** Called whenever the user edits the merged content */
  onMergedContentChange: (content: string) => void;
  /** Whether the viewer is in read-only mode */
  readOnly?: boolean;
}

// Color constants for diff highlighting
const BG_ADDED = 'rgba(34, 197, 94, 0.12)';
const BG_REMOVED = 'rgba(239, 68, 68, 0.12)';
const BG_MODIFIED = 'rgba(234, 179, 8, 0.10)';
const GUTTER_ADDED = 'rgba(34, 197, 94, 0.25)';
const GUTTER_REMOVED = 'rgba(239, 68, 68, 0.25)';
const GUTTER_MODIFIED = 'rgba(234, 179, 8, 0.2)';

// ── Helper: Render a diff pane (read-only) ──────────────────────────────────

function DiffPane({
  title,
  titleColor,
  diffLines,
  side,
  scrollTop,
  onScroll,
}: {
  title: string;
  titleColor: string;
  diffLines: DiffLine[];
  side: 'left' | 'right';
  scrollTop: number;
  onScroll: (top: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSettingScroll = useRef(false);

  // Sync scroll position from parent
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (Math.abs(el.scrollTop - scrollTop) > 2) {
      isSettingScroll.current = true;
      el.scrollTop = scrollTop;
      requestAnimationFrame(() => {
        isSettingScroll.current = false;
      });
    }
  }, [scrollTop]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || isSettingScroll.current) return;
    onScroll(el.scrollTop);
  }, [onScroll]);

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Pane header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-[#2d2d44] shrink-0"
        style={{ backgroundColor: `${titleColor}10` }}
      >
        <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: titleColor }}>
          {title}
        </span>
        <span className="text-[10px] text-gray-500 font-mono">read-only</span>
      </div>

      {/* Lines */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto font-mono text-[11px] leading-[18px]"
      >
        <table className="w-full border-collapse">
          <tbody>
            {diffLines.map((dl, idx) => {
              const lineNo = side === 'left' ? dl.leftLineNo : dl.rightLineNo;
              const text = side === 'left' ? (dl.leftText ?? '') : (dl.rightText ?? '');
              const show = side === 'left'
                ? dl.type !== 'added'
                : dl.type !== 'removed';

              if (!show) {
                // Empty row to keep rows aligned
                return (
                  <tr key={idx} style={{ height: 18 }}>
                    <td className="w-10 text-right pr-2 select-none text-gray-700 border-r border-[#2d2d44]" />
                    <td />
                  </tr>
                );
              }

              let bg = 'transparent';
              let gutterBg = 'transparent';
              if (dl.type === 'added') {
                bg = BG_ADDED;
                gutterBg = GUTTER_ADDED;
              } else if (dl.type === 'removed') {
                bg = BG_REMOVED;
                gutterBg = GUTTER_REMOVED;
              } else if (dl.type === 'modified') {
                bg = BG_MODIFIED;
                gutterBg = GUTTER_MODIFIED;
              }

              return (
                <tr key={idx}>
                  <td
                    className="w-10 text-right pr-2 select-none text-gray-600 border-r border-[#2d2d44]"
                    style={{ backgroundColor: gutterBg, minWidth: 40 }}
                  >
                    {lineNo ?? ''}
                  </td>
                  <td
                    className="pl-2 whitespace-pre text-gray-300"
                    style={{ backgroundColor: bg }}
                  >
                    {text || ' '}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ThreeWayMergeViewer({
  filename,
  baseContent,
  oursContent,
  theirsContent,
  mergedContent,
  onMergedContentChange,
  readOnly = false,
}: ThreeWayMergeViewerProps) {
  // Compute diffs: base→ours and base→theirs
  const leftDiff = computeLineDiff(baseContent, oursContent);
  const rightDiff = computeLineDiff(baseContent, theirsContent);

  // Synchronized scrolling across the three panes
  const [scrollTop, setScrollTop] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSettingTextareaScroll = useRef(false);

  const handlePaneScroll = useCallback((top: number) => {
    setScrollTop(top);
    // Also sync the center textarea
    if (textareaRef.current) {
      isSettingTextareaScroll.current = true;
      textareaRef.current.scrollTop = top;
      requestAnimationFrame(() => {
        isSettingTextareaScroll.current = false;
      });
    }
  }, []);

  const handleTextareaScroll = useCallback(() => {
    if (isSettingTextareaScroll.current) return;
    const el = textareaRef.current;
    if (el) {
      setScrollTop(el.scrollTop);
    }
  }, []);

  // Line count for the center editor
  const mergedLines = mergedContent.split('\n');
  const lineCount = mergedLines.length;

  return (
    <div className="flex flex-col h-full bg-[#0a0a15] rounded-lg overflow-hidden border border-[#2d2d44]">
      {/* File info bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#12121f] border-b border-[#2d2d44] shrink-0">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">3-Way Merge</span>
        <span className="text-xs font-mono text-gray-300 truncate">{filename}</span>
      </div>

      {/* Three column layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left pane: Ours (local) */}
        <div className="flex-1 border-r border-[#2d2d44] min-w-0">
          <DiffPane
            title="Yours (Local)"
            titleColor="#3b82f6"
            diffLines={leftDiff}
            side="right"
            scrollTop={scrollTop}
            onScroll={handlePaneScroll}
          />
        </div>

        {/* Center pane: Merged result (editable) */}
        <div className="flex-1 border-r border-[#2d2d44] flex flex-col min-w-0">
          {/* Center header */}
          <div
            className="flex items-center justify-between px-3 py-1.5 border-b border-[#2d2d44] shrink-0"
            style={{ backgroundColor: 'rgba(168, 85, 247, 0.08)' }}
          >
            <span className="text-[11px] font-semibold tracking-wide uppercase text-purple-400">
              Result (Editable)
            </span>
            <span className="text-[10px] text-gray-500 font-mono">
              {lineCount} line{lineCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Editable area with line numbers */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Line numbers gutter */}
            <div className="w-10 bg-[#0a0a15] border-r border-[#2d2d44] overflow-hidden select-none shrink-0">
              <div className="font-mono text-[11px] leading-[18px] text-gray-600 text-right pr-2 pt-[3px]">
                {mergedLines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            </div>

            {/* The text editor */}
            <textarea
              ref={textareaRef}
              value={mergedContent}
              onChange={(e) => onMergedContentChange(e.target.value)}
              onScroll={handleTextareaScroll}
              readOnly={readOnly}
              spellCheck={false}
              className="flex-1 resize-none bg-[#0a0a15] text-gray-200 font-mono text-[11px] leading-[18px] p-0 pl-2 pt-[3px] border-none outline-none focus:ring-0 overflow-auto"
              style={{
                tabSize: 2,
                caretColor: '#a855f7',
              }}
            />
          </div>
        </div>

        {/* Right pane: Theirs (remote) */}
        <div className="flex-1 min-w-0">
          <DiffPane
            title="Theirs (Remote)"
            titleColor="#f97316"
            diffLines={rightDiff}
            side="right"
            scrollTop={scrollTop}
            onScroll={handlePaneScroll}
          />
        </div>
      </div>
    </div>
  );
}
