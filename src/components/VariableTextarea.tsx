import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import VariableTooltip from './VariableTooltip';
import { useAppStore } from '../store/appStore';

interface VariableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function VariableTextarea({ value, onChange, placeholder, className }: VariableTextareaProps) {
  const [tooltip, setTooltip] = useState<{ variableName: string; position: { x: number; y: number } } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { getActiveEnvironment } = useAppStore();

  // Find variable at cursor position or clicked position
  const findVariableAtPosition = useCallback((text: string, cursorPos: number): string | null => {
    const regex = /<<([^>]+)>>/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (cursorPos >= start && cursorPos <= end) {
        return match[1].trim();
      }
    }

    return null;
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const cursorPos = textarea.selectionStart || 0;
    const variableName = findVariableAtPosition(value, cursorPos);

    if (variableName) {
      const rect = textarea.getBoundingClientRect();
      // Get position relative to textarea
      const textBeforeCursor = value.substring(0, cursorPos);
      const lines = textBeforeCursor.split('\n');
      const lineHeight = 20; // Approximate line height
      const charWidth = 8; // Approximate character width

      const currentLineIndex = lines.length - 1;
      const currentLineLength = lines[currentLineIndex].length;

      const offsetY = Math.min(currentLineIndex * lineHeight, rect.height - 50);
      const offsetX = Math.min(currentLineLength * charWidth, rect.width - 100);

      setTooltip({
        variableName,
        position: {
          x: rect.left + offsetX,
          y: rect.top + offsetY,
        },
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Close tooltip on Escape
    if (e.key === 'Escape' && tooltip) {
      setTooltip(null);
      e.stopPropagation();
    }

    // Handle Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      // Set cursor position after the tab
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleScroll = () => {
    // Sync scroll between textarea and overlay
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Highlight variables in the textarea
  const activeEnvironment = getActiveEnvironment();

  const getHighlightedContent = () => {
    if (!value) return null;

    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    const regex = /<<([^>]+)>>/g;
    let match;
    let keyIndex = 0;

    while ((match = regex.exec(value)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const textBefore = value.substring(lastIndex, match.index);
        parts.push(
          <span key={`text-${keyIndex++}`} className="text-fetchy-text whitespace-pre">
            {textBefore}
          </span>
        );
      }

      // Check if variable is defined and if it's secret
      const varName = match[1].trim();
      const variable = activeEnvironment?.variables.find(v => v.key === varName && v.enabled);
      const isDefined = !!variable;
      const isSecret = variable?.isSecret || false;

      parts.push(
        <span
          key={`var-${keyIndex++}`}
          className={`whitespace-pre ${isDefined ? (isSecret ? 'var-highlight-secret' : 'var-highlight-defined') : 'var-highlight-undefined'}`}
        >
          {match[0]}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(
        <span key={`text-${keyIndex++}`} className="text-fetchy-text whitespace-pre">
          {value.substring(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : null;
  };

  const hasVariables = /<<[^>]+>>/.test(value);

  return (
    <div className="relative h-full w-full">
      {/* Actual textarea - make text transparent when variables exist so overlay shows through */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        placeholder={placeholder}
        className={`${className} h-full w-full resize-none font-mono text-sm p-4 bg-[var(--input-bg)] border-none outline-none`}
        style={hasVariables ? { color: 'transparent', caretColor: 'var(--text-color)' } : undefined}
        spellCheck={false}
      />

      {/* Overlay for highlighted variables */}
      {hasVariables && (
        <div
          ref={overlayRef}
          className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none font-mono text-sm p-4 overflow-hidden whitespace-pre-wrap break-all"
          style={{
            wordBreak: 'break-all',
          }}
        >
          {getHighlightedContent()}
        </div>
      )}

      {/* Tooltip portal */}
      {tooltip && createPortal(
        <VariableTooltip
          variableName={tooltip.variableName}
          position={tooltip.position}
          onClose={() => setTooltip(null)}
        />,
        document.body
      )}
    </div>
  );
}
