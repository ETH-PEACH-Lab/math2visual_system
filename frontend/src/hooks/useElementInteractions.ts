import { useCallback, useMemo, useRef, useEffect } from 'react';
import { isTextElement, isBoxElement, isEmbeddedSvgElement, isContainerNameElement, isAttrNameElement } from '../utils/elementUtils';
import { useHighlightingContext } from '@/contexts/HighlightingContext';
import { trackSVGElementHover, trackSVGElementClick, isAnalyticsEnabled } from '@/services/analyticsTracker';

interface UseElementInteractionsProps {
  svgRef: React.RefObject<HTMLDivElement | null>;
  sectionType: 'formal' | 'intuitive';
  onEmbeddedSVGClick: (event: MouseEvent) => void;
  onEntityQuantityClick: (event: MouseEvent) => void;
  onNameClick: (event: MouseEvent) => void;
  isPopupOpen?: boolean;
  isDisabled?: boolean;
}

/**
 * Hook for managing SVG element interactions and event listeners
 * Handles setup of mouse events, click handlers, and element-specific behaviors
 */
export const useElementInteractions = ({
  svgRef,
  sectionType,
  onEmbeddedSVGClick,
  onEntityQuantityClick,
  onNameClick,
  isPopupOpen = false,
  isDisabled = false,
}: UseElementInteractionsProps) => {
  const { currentDSLPath, setSelectedElement, clearHighlightingState } = useHighlightingContext();
  const currentDSLPathRef = useRef(currentDSLPath);
  
  // Keep the ref in sync with the current value
  useEffect(() => {
    currentDSLPathRef.current = currentDSLPath;
  }, [currentDSLPath]);
  /**
   * Setup interactions for all SVG elements with DSL paths
   */
  const setupSVGInteractions = useCallback(() => {
    if (!svgRef.current) {
      return;
    }

    // Find all elements with DSL paths
    const allInteractiveElements = svgRef.current.querySelectorAll('[data-dsl-path]');

    allInteractiveElements.forEach((element) => {
      const svgElem = element as SVGElement;
      const dslPath = svgElem.getAttribute('data-dsl-path');

      if (!dslPath) return;

      svgElem.onmouseenter = null;
      svgElem.onmouseleave = null;
      svgElem.onclick = null;
      svgElem.style.cursor = 'default';

      // If popup is open or disabled, don't set up hover listeners
      if (isPopupOpen || isDisabled) {
        return;
      }
  
      // Add event listeners
      // Track hover analytics if enabled
      if (isAnalyticsEnabled()) {
         svgElem.onmouseenter = () => {
           const currentPath = currentDSLPathRef.current;
           if (currentPath !== dslPath) {
            const actionType = `svg_element_hover_enter`;
             trackSVGElementHover(actionType, dslPath);
             setSelectedElement(svgElem, sectionType);
           }
         };
         svgElem.onmouseleave = () => {
          const actionType = `svg_element_hover_leave`;
           trackSVGElementHover(actionType, dslPath);
           clearHighlightingState();
         };
      } else {
        svgElem.onmouseenter = () => {
          const currentPath = currentDSLPathRef.current;
          if (currentPath !== dslPath) {
            setSelectedElement(svgElem, sectionType);
          }
        };
        svgElem.onmouseleave = () => clearHighlightingState();
      }

      svgElem.style.cursor = 'pointer';

      // Determine element type and setup appropriate interactions
      // Check smaller/internal elements first, then containers, to avoid event blocking
      if (isContainerNameElement(svgElem) || isAttrNameElement(svgElem)) {
        svgElem.onclick = (event: MouseEvent) => {
          event.stopPropagation();
          onNameClick(event);
        };
      } else if (isTextElement(svgElem)) {
        svgElem.style.pointerEvents = 'auto';
        // Add click handler for entity quantity editing if path ends with entity_quantity
        if (dslPath.endsWith('/entity_quantity')) {
          svgElem.onclick = (event: MouseEvent) => {
            event.stopPropagation();
            onEntityQuantityClick(event);
          };
        }
      } else if (isEmbeddedSvgElement(svgElem)) {
        svgElem.onclick = (event: MouseEvent) => {
          event.stopPropagation();
          onEmbeddedSVGClick(event);
        };
      } else if (isBoxElement(svgElem)) {
        svgElem.onclick = (event: MouseEvent) => {
          event.stopPropagation();
          onEntityQuantityClick(event);
        };
      }

      if (svgElem.onclick && isAnalyticsEnabled()) {
        const originalClickHandler = svgElem.onclick;
        svgElem.onclick = (event: MouseEvent) => {
          const action_type = `svg_element_click`;
          trackSVGElementClick(action_type, dslPath);
          originalClickHandler.call(svgElem, event as PointerEvent);
        };
      }
    });
  }, [
    svgRef,
    sectionType,
    isDisabled,
    setSelectedElement,
    clearHighlightingState,
    onEmbeddedSVGClick,
    onEntityQuantityClick,
    onNameClick,
    isPopupOpen,
  ]);

  const returnValue = useMemo(() => ({
    setupSVGInteractions,
  }), [setupSVGInteractions]);

  return returnValue;
};
