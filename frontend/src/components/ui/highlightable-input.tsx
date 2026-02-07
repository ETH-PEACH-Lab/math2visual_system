import React, { useEffect, useRef, useState } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface Props extends React.ComponentProps<typeof Input> {
  highlightRanges?: Array<[number, number]>;
}

export const HighlightableInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, highlightRanges = [], className, onKeyDown, style, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const mergedRef = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    };

    const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
    useEffect(() => {
      if (!inputRef.current) return;
      const cs = window.getComputedStyle(inputRef.current);
      setOverlayStyle({
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing as React.CSSProperties['letterSpacing'],
        fontWeight: cs.fontWeight as React.CSSProperties['fontWeight'],
        fontStyle: cs.fontStyle as React.CSSProperties['fontStyle'],
        wordSpacing: cs.wordSpacing as React.CSSProperties['wordSpacing'],
        textTransform: cs.textTransform as React.CSSProperties['textTransform'],
        // Ensure optional vendor-specific rendering props don't break typing
        textRendering: undefined,
        boxSizing: 'border-box',
        paddingLeft: cs.getPropertyValue('padding-left'),
        paddingRight: cs.getPropertyValue('padding-right'),
        paddingTop: cs.getPropertyValue('padding-top'),
        paddingBottom: cs.getPropertyValue('padding-bottom'),
        // No transform; rely purely on padding to align text baselines
        width: '100%',
        height: '100%',
      });
    }, [className]);
    const createHighlightedContent = () => {
      if (!value || typeof value !== 'string' || highlightRanges.length === 0) {
        return value || '';
      }
      let content = value as string;
      const ranges = [...highlightRanges].sort((a, b) => a[0] - b[0]);
      let offset = 0;
      ranges.forEach(([start, end]) => {
        if (start >= 0 && end <= content.length && start < end) {
          const adjustedStart = start + offset;
          const adjustedEnd = end + offset;
          const before = content.slice(0, adjustedStart);
          const highlighted = content.slice(adjustedStart, adjustedEnd);
          const after = content.slice(adjustedEnd);
          const span = `<span style="background-color: rgba(59, 130, 246, 0.3);">${highlighted}</span>`;
          content = before + span + after;
          offset += span.length - highlighted.length;
        }
      });
      return content;
    };

    return (
      <div className="relative">
        <div
          className={cn(
            'absolute inset-0 pointer-events-none text-transparent whitespace-pre overflow-hidden w-full',
            className,
          )}
          style={{ zIndex: 2, background: 'transparent', color: 'transparent', resize: 'none', ...overlayStyle }}
          dangerouslySetInnerHTML={{ __html: String(createHighlightedContent() || '') }}
        />

        <Input
          ref={mergedRef}
          value={value}
          className={cn('relative', className)}
          style={{ zIndex: 1, ...(style || {}) }}
          onKeyDown={onKeyDown}
          {...props}
        />
      </div>
    );
  }
);

HighlightableInput.displayName = 'HighlightableInput';


