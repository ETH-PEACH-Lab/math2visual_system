// Custom hook for handling SVG responsiveness
import { useCallback, useMemo } from "react";

type ResponsiveOptions = {
  align?: "left" | "center";
  maxHeight?: number | "container"; // Max height in pixels, or "container" to use container height
};

export const useSVGResponsive = () => {
  const toNumber = (value: string | null) => {
    if (!value) return null;
    const match = value.match(/([0-9]+(?:\.[0-9]+)?)/);
    return match ? Number(match[1]) : null;
  };

  const makeResponsive = useCallback((root: HTMLDivElement | null, options: ResponsiveOptions = {}) => {
    const { align = "center", maxHeight } = options;
    if (!root) return;
    const svg = root.querySelector('svg');
    if (!svg) return;

    const hasViewBox = svg.hasAttribute('viewBox');
    const widthAttr = svg.getAttribute('width');
    const heightAttr = svg.getAttribute('height');

    // If no viewBox but width/height exist, create a viewBox so scaling works
    if (!hasViewBox) {
      const w = toNumber(widthAttr);
      const h = toNumber(heightAttr);
      if (w && h) {
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      }
    }

    // Base responsive settings
    svg.removeAttribute('height');
    svg.style.height = 'auto';
    svg.style.maxWidth = '100%';
    svg.style.display = 'block';
    svg.style.margin = align === "left" ? '0' : '0 auto';
    if (!svg.getAttribute('preserveAspectRatio')) {
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    // Compute aspect ratio from viewBox (preferred) or width/height
    const vb = svg.getAttribute('viewBox');
    let vbW: number | null = null;
    let vbH: number | null = null;
    if (vb) {
      const parts = vb.split(/\s+/).map((v) => Number(v));
      if (parts.length === 4) {
        vbW = parts[2];
        vbH = parts[3];
      }
    }
    if (!vbW || !vbH) {
      vbW = toNumber(widthAttr);
      vbH = toNumber(heightAttr);
    }

    // Use requestAnimationFrame to ensure container has its final width after layout
    requestAnimationFrame(() => {
      const containerWidth = root.clientWidth || root.getBoundingClientRect().width || 0;
      const containerHeight = root.clientHeight || root.getBoundingClientRect().height || 0;
      
      // Determine max height constraint
      const clampPx = typeof maxHeight === "number" ? maxHeight : containerHeight;

      if (containerWidth > 0 && vbW && vbH && vbW > 0) {
        // Calculate size based on width constraint
        const predictedHeightFromWidth = containerWidth * (vbH / vbW);
        
        // Calculate size based on height constraint
        const predictedWidthFromHeight = containerHeight * (vbW / vbH);
        
        // Use the constraint that results in smaller size (more restrictive)
        let finalWidth: number;
        let finalHeight: number;
        
        if (predictedHeightFromWidth > clampPx) {
          // Height constraint is limiting
          finalHeight = clampPx;
          finalWidth = finalHeight * (vbW / vbH);
          
          // If width exceeds container, scale down
          if (finalWidth > containerWidth) {
            const scale = containerWidth / finalWidth;
            finalWidth = containerWidth;
            finalHeight = finalHeight * scale;
          }
        } else if (predictedWidthFromHeight > containerWidth) {
          // Width constraint is limiting
          finalWidth = containerWidth;
          finalHeight = finalWidth * (vbH / vbW);
        } else {
          // Can use full width
          finalWidth = containerWidth;
          finalHeight = predictedHeightFromWidth;
        }
        
        // Ensure we don't exceed height constraint
        if (finalHeight > clampPx) {
          const scale = clampPx / finalHeight;
          finalHeight = clampPx;
          finalWidth = finalWidth * scale;
        }
        
        const widthPercent = Math.max(10, Math.min(100, Math.round((finalWidth / containerWidth) * 100)));
        svg.removeAttribute('width');
        svg.style.width = `${widthPercent}%`;
      } else {
        // Fallback
        svg.removeAttribute('width');
        svg.style.width = '100%';
      }
    });
  }, []);

  // Setup resize listeners (both window and container) that trigger makeResponsive on provided refs
  const setupResizeListener = useCallback((refs: Array<React.RefObject<HTMLDivElement | null>>, options: ResponsiveOptions = {}) => {
    const onResize = () => {
      refs.forEach(ref => {
        if (ref.current) {
          makeResponsive(ref.current, options);
        }
      });
    };
    
    // Listen to window resize
    window.addEventListener('resize', onResize);
    
    // Listen to container resize using ResizeObserver
    const resizeObservers: ResizeObserver[] = [];
    refs.forEach(ref => {
      if (ref.current) {
        const observer = new ResizeObserver(() => {
          if (ref.current) {
            makeResponsive(ref.current, options);
          }
        });
        observer.observe(ref.current);
        resizeObservers.push(observer);
      }
    });
    
    return () => {
      window.removeEventListener('resize', onResize);
      resizeObservers.forEach(observer => observer.disconnect());
    };
  }, [makeResponsive]);

  const returnValue = useMemo(() => ({
    makeResponsive,
    setupResizeListener
  }), [makeResponsive, setupResizeListener]);

  return returnValue;
};