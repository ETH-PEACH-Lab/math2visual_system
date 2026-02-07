import React, { useRef, useEffect, useState } from 'react';
import { Textarea } from './textarea';
import { cn } from '@/lib/utils';

interface HighlightableTextareaProps extends React.ComponentProps<typeof Textarea> {
  highlightRanges?: Array<[number, number]>;
}

export const HighlightableTextarea = React.forwardRef<
  HTMLTextAreaElement,
  HighlightableTextareaProps
>(({ highlightRanges = [], className, value, ...props }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightLayerRef = useRef<HTMLDivElement | null>(null);
  const [textareaStyle, setTextareaStyle] = useState<React.CSSProperties>({});

  // Sync textarea styles with highlight layer
  useEffect(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;

    const updateStylesFromComputed = () => {
      const computedStyle = window.getComputedStyle(textarea);
      setTextareaStyle({
        fontFamily: computedStyle.fontFamily,
        fontSize: computedStyle.fontSize,
        lineHeight: computedStyle.lineHeight,
        padding: computedStyle.padding,
        border: computedStyle.border,
        borderRadius: computedStyle.borderRadius,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        overflow: 'hidden',
        boxSizing: computedStyle.boxSizing as React.CSSProperties['boxSizing'],
      });
    };

    updateStylesFromComputed();

    // Keep styles in sync on resize/layout changes
    const resizeObserver = new ResizeObserver(() => {
      updateStylesFromComputed();
    });
    resizeObserver.observe(textarea);

    // Also handle font-size/line-height changes due to class toggles
    const mutationObserver = new MutationObserver(() => {
      updateStylesFromComputed();
    });
    mutationObserver.observe(textarea, { attributes: true, attributeFilter: ['class', 'style'] });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // Sync scroll position between textarea and highlight layer
  useEffect(() => {
    if (!textareaRef.current || !highlightLayerRef.current) return;

    const textarea = textareaRef.current;
    const highlightLayer = highlightLayerRef.current;

    const syncScroll = () => {
      highlightLayer.scrollTop = textarea.scrollTop;
      highlightLayer.scrollLeft = textarea.scrollLeft;
    };

    // Initial sync
    syncScroll();

    // Add scroll event listener
    textarea.addEventListener('scroll', syncScroll);

    return () => {
      textarea.removeEventListener('scroll', syncScroll);
    };
  }, []);

  // Create highlighted content
  const createHighlightedContent = () => {
    if (!value || typeof value !== 'string' || highlightRanges.length === 0) {
      return value || '';
    }

    let content = value;
    const ranges = [...highlightRanges].sort((a, b) => a[0] - b[0]);
    let offset = 0;

    ranges.forEach(([start, end]) => {
      if (start >= 0 && end <= content.length && start < end) {
        const adjustedStart = start + offset;
        const adjustedEnd = end + offset;
        
        const before = content.slice(0, adjustedStart);
        const highlighted = content.slice(adjustedStart, adjustedEnd);
        const after = content.slice(adjustedEnd);
        
        // Important: do not add padding/border that would alter text layout compared to the textarea
        const highlightSpan = `<span style="background-color: rgba(59, 130, 246, 0.3);">${highlighted}</span>`;
        
        content = before + highlightSpan + after;
        offset += highlightSpan.length - highlighted.length;
      }
    });

    return content;
  };

  const combinedRef = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref && typeof ref !== 'function') {
      ref.current = node;
    }
  };

  return (
    <div className="relative">
      {/* Highlight layer - positioned behind textarea */}
      <div
        ref={highlightLayerRef}
        className={cn(
          "absolute top-0 left-0 pointer-events-none text-transparent",
          className
        )}
        style={{
          ...textareaStyle,
          zIndex: 1,
          background: 'transparent',
          // Important: mirror textarea's border/box model to keep wrapping identical
          color: 'transparent',
          resize: 'none',
          width: '100%',
          height: '100%',
          // Enable scrolling to match textarea behavior
          overflow: 'auto',
          overflowX: 'hidden',
          overflowY: 'auto'
        }}
        dangerouslySetInnerHTML={{
          __html: String(createHighlightedContent() || ''),
        }}
      />
      
      {/* Actual textarea - positioned on top */}
      <Textarea
        ref={combinedRef}
        value={value}
        className={cn("relative bg-transparent", className)}
        style={{ zIndex: 2 }}
        {...props}
      />
    </div>
  );
});

HighlightableTextarea.displayName = 'HighlightableTextarea';
