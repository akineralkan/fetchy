import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import VariableTooltip from './VariableTooltip';
import { useAppStore } from '../store/appStore';

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}

export default function VariableInput({ value, onChange, placeholder, className, type = 'text' }: VariableInputProps) {
  const [tooltip, setTooltip] = useState<{ variableName: string; position: { x: number; y: number } } | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { getActiveEnvironment } = useAppStore();

  // Sync overlay padding/font from the input's computed styles so they align perfectly
  useEffect(() => {
    if (inputRef.current) {
      const computed = getComputedStyle(inputRef.current);
      setOverlayStyle({
        paddingLeft: computed.paddingLeft,
        paddingRight: computed.paddingRight,
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        letterSpacing: computed.letterSpacing,
      });
    }
  }, [className]);

  // Sync scroll position between input and overlay
  const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
    const scrollPos = e.currentTarget.scrollLeft;
    setScrollLeft(scrollPos);
  };

  // Find variable at cursor position or clicked position
  const findVariableAtPosition = useCallback((text: string, cursorPos: number): string | null => {
    // Find all <<variable>> patterns
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

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const cursorPos = input.selectionStart || 0;
    const variableName = findVariableAtPosition(value, cursorPos);

    if (variableName) {
      const rect = input.getBoundingClientRect();
      // Calculate approximate position of the clicked text
      const charWidth = 8; // Approximate character width
      const offsetX = Math.min(cursorPos * charWidth, rect.width - 100);

      setTooltip({
        variableName,
        position: {
          x: rect.left + offsetX,
          y: rect.bottom,
        },
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Close tooltip on Escape
    if (e.key === 'Escape' && tooltip) {
      setTooltip(null);
      e.stopPropagation();
    }
  };

  // Highlight variables in the input
  const activeEnvironment = getActiveEnvironment();

  const getHighlightedValue = () => {
    if (!value) return null;

    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    const regex = /<<([^>]+)>>/g;
    let match;

    while ((match = regex.exec(value)) !== null) {
      // Add text before the match (use same color as regular text)
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`} className="text-fetchy-text">
            {value.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Check if variable is defined
      const varName = match[1].trim();
      const variable = activeEnvironment?.variables.find(v => v.key === varName && v.enabled);
      const isDefined = !!variable;
      const isSecret = variable?.isSecret || false;

      parts.push(
        <span
          key={`var-${match.index}`}
          className={isDefined ? (isSecret ? 'var-highlight-secret' : 'var-highlight-defined') : 'var-highlight-undefined'}
        >
          {match[0]}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-fetchy-text">
          {value.substring(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : null;
  };

  const hasVariables = /<<[^>]+>>/.test(value);

  // Check if this is being used as a flex item
  const isFlexItem = className?.includes('flex-1');

  return (
    <div className={`relative ${isFlexItem ? 'flex-1 min-w-0' : 'w-full'}`}>
      {/* Actual input - make text transparent when variables exist so overlay shows through */}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        placeholder={placeholder}
        className={`${className} ${isFlexItem ? 'w-full' : ''}`}
        style={hasVariables ? { color: 'transparent', caretColor: 'white' } : undefined}
      />

      {/* Overlay for highlighted variables - must match input styling exactly */}
      {hasVariables && (
        <div
          className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none flex items-center"
          style={{
            paddingLeft: overlayStyle.paddingLeft,
            paddingRight: overlayStyle.paddingRight,
            overflow: 'hidden',
          }}
        >
          <div
            ref={overlayRef}
            style={{
              whiteSpace: 'nowrap',
              width: '100%',
              transform: `translateX(-${scrollLeft}px)`,
              fontSize: overlayStyle.fontSize,
              fontFamily: overlayStyle.fontFamily,
              letterSpacing: overlayStyle.letterSpacing,
            }}
          >
            {getHighlightedValue()}
          </div>
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
