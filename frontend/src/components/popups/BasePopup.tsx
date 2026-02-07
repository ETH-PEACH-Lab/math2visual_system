import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useHighlightingContext } from '@/contexts/HighlightingContext';

interface BasePopupProps {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
}

interface AdjustedPosition {
  x: number;
  y: number;
  transform: string;
}

export const BasePopup: React.FC<BasePopupProps> = ({
  onClose,
  children,
  className = "popup-responsive-width max-h-[90vh]",
  onKeyDown,
  
}) => {
  const { currentTargetElement } = useHighlightingContext();
  const popupRef = useRef<HTMLDivElement>(null);
  
  const [adjustedPosition, setAdjustedPosition] = useState<AdjustedPosition>(() => {
    // Initialize using currentTargetElement position if available
    if (currentTargetElement) {
      const targetRect = currentTargetElement.getBoundingClientRect();
      return {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
        transform: 'translate(-50%, -50%)'
      };
    }
    
    // Fallback to center if no target element
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      transform: 'translate(-50%, -50%)'
    };
  });

  // Calculate viewport-aware position to prevent popup cutoff
  useEffect(() => {
    const calculatePosition = () => {
      if (!popupRef.current) {
        return;
      }
      
      try {
        const popupRect = popupRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 16; // Minimum margin from viewport edges
        
        let x = viewportWidth / 2;
        let y = viewportHeight / 2;
        let transform = 'translate(-50%, -50%)';
        
        // Use target element's current position instead of click position
        if (currentTargetElement) {
          const targetRect = currentTargetElement.getBoundingClientRect();
          const targetCenterX = targetRect.left + targetRect.width / 2;
          const targetCenterY = targetRect.top + targetRect.height / 2;
          
          // Calculate popup dimensions (estimate if not yet rendered)
          const popupWidth = popupRect.width || 320; // fallback width based on typical popup sizes
          const popupHeight = popupRect.height || 150; // fallback height based on typical popup sizes
          
          // Calculate ideal position (centered on target)
          let idealX = targetCenterX;
          let idealY = targetCenterY;
          
          // Adjust X position to stay within viewport bounds
          if (idealX - popupWidth / 2 < margin) {
            // Too far left, align to left edge with margin
            x = margin + popupWidth / 2;
            transform = 'translate(-50%, -50%)';
          } else if (idealX + popupWidth / 2 > viewportWidth - margin) {
            // Too far right, align to right edge with margin
            x = viewportWidth - margin - popupWidth / 2;
            transform = 'translate(-50%, -50%)';
          } else {
            // Center on target
            x = idealX;
          }
          
          // Adjust Y position to stay within viewport bounds
          if (idealY - popupHeight / 2 < margin) {
            // Too far up, align to top edge with margin
            y = margin + popupHeight / 2;
          } else if (idealY + popupHeight / 2 > viewportHeight - margin) {
            // Too far down, align to bottom edge with margin
            y = viewportHeight - margin - popupHeight / 2;
          } else {
            // Center on target
            y = idealY;
          }
        } else {
          // This should never happen when a popup is open - log for debugging
          console.warn('BasePopup: No target element available for positioning, centering popup');
        }
        
        setAdjustedPosition({ x, y, transform });
      } catch (error) {
        console.error('Error calculating popup position:', error);
      }
    };

    // Calculate position after DOM is rendered
    const rafId = requestAnimationFrame(() => {
      calculatePosition();
    });
    
    // Recalculate on window resize and scroll events
    const handleResize = () => calculatePosition();
    
    // Throttle scroll events for better performance
    let scrollTimeout: NodeJS.Timeout | null = null;
    const handleScroll = () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(() => {
        calculatePosition();
        scrollTimeout = null;
      }, 16); // ~60fps throttling
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Also listen for scroll events on any scrollable parent containers
    // This includes the document and any elements that might contain the SVG
    document.addEventListener('scroll', handleScroll, { passive: true });
    
    // Find and listen to scroll events on the SVG container and its parents
    if (currentTargetElement) {
      let parent = currentTargetElement.parentElement;
      while (parent) {
        parent.addEventListener('scroll', handleScroll, { passive: true });
        parent = parent.parentElement;
      }
    }
    
    return () => {
      cancelAnimationFrame(rafId);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      
      // Clean up parent scroll listeners
      if (currentTargetElement) {
        let parent = currentTargetElement.parentElement;
        while (parent) {
          parent.removeEventListener('scroll', handleScroll);
          parent = parent.parentElement;
        }
      }
    };
  }, [currentTargetElement]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDownEvent = (event: KeyboardEvent) => {
      // First handle built-in keys
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      
      // Then call custom handler if provided
      if (onKeyDown) {
        onKeyDown(event);
      }
    };

    document.addEventListener('keydown', handleKeyDownEvent);
    return () => document.removeEventListener('keydown', handleKeyDownEvent);
  }, [onClose, onKeyDown]);

  return (
    <div
      ref={popupRef}
      className={`fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-auto p-1 transition-all duration-200 ease-out ${className}`}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        transform: adjustedPosition.transform,
      }}
    >
      {children}
    </div>
  );
};