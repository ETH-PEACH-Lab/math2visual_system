/**
 * Downloads SVG content as a file
 */
export const downloadSvg = (svgContent: string, filename: string): void => {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  
  // Clean up the URL object to free memory
  URL.revokeObjectURL(url);
};

/**
 * Parses SVG content to extract dimensions from viewBox or width/height attributes
 */
const parseSvgDimensions = (svgContent: string): { width: number; height: number } => {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svgElement = svgDoc.querySelector('svg');
  
  if (!svgElement) {
    return { width: 1200, height: 900 }; // High-res defaults
  }
  
  // Try to get width and height attributes first
  const widthAttr = svgElement.getAttribute('width');
  const heightAttr = svgElement.getAttribute('height');
  
  if (widthAttr && heightAttr) {
    const width = parseFloat(widthAttr.replace(/[^0-9.]/g, ''));
    const height = parseFloat(heightAttr.replace(/[^0-9.]/g, ''));
    if (!isNaN(width) && !isNaN(height)) {
      return { width, height };
    }
  }
  
  // Try to parse viewBox if width/height not available
  const viewBox = svgElement.getAttribute('viewBox');
  if (viewBox) {
    const [, , width, height] = viewBox.split(/\s+/).map(parseFloat);
    if (!isNaN(width) && !isNaN(height)) {
      return { width, height };
    }
  }
  
  // Fallback to high-res defaults
  return { width: 1200, height: 900 };
};

/**
 * Converts SVG to PNG and downloads it
 */
export const downloadPng = (svgContent: string, filename: string, scaleFactor: number = 3): void => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  img.onload = () => {
    // Clean up the SVG URL
    URL.revokeObjectURL(svgUrl);
    
    // Get SVG dimensions or use parsed dimensions
    const svgDimensions = parseSvgDimensions(svgContent);
    const finalWidth = (img.naturalWidth || svgDimensions.width) * scaleFactor;
    const finalHeight = (img.naturalHeight || svgDimensions.height) * scaleFactor;
    
    // Set high-resolution canvas size
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    
    // Enable high-quality rendering
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw the image onto the canvas at high resolution
      ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
    }
    
    // Convert canvas to PNG blob and download
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png', 1.0); // Maximum quality
  };
  
  // Convert SVG to data URL and load into image
  const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  img.src = svgUrl;
};

/**
 * Converts SVG to PDF and downloads it
 */
export const downloadPdf = async (svgContent: string, filename: string, scaleFactor: number = 3): Promise<void> => {
  try {
    // Dynamic import of jsPDF to avoid bundling if not used
    const jsPDF = (await import('jspdf')).default;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          // Clean up the SVG URL
          URL.revokeObjectURL(svgUrl);
          
          // Get SVG dimensions or use parsed dimensions
          const svgDimensions = parseSvgDimensions(svgContent);
          const finalWidth = (img.naturalWidth || svgDimensions.width) * scaleFactor;
          const finalHeight = (img.naturalHeight || svgDimensions.height) * scaleFactor;
          
          // Set high-resolution canvas size
          canvas.width = finalWidth;
          canvas.height = finalHeight;
          
          // Enable high-quality rendering
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw the image onto the canvas at high resolution
            ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
          }
          
          // Convert canvas to data URL with maximum quality
          const imgData = canvas.toDataURL('image/png', 1.0);
          
          // Create PDF with proper dimensions (convert px to mm for better sizing)
          const mmWidth = finalWidth * 0.264583; // px to mm conversion
          const mmHeight = finalHeight * 0.264583;
          
          const pdf = new jsPDF({
            orientation: finalWidth > finalHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [mmWidth, mmHeight]
          });
          
          // Add image to PDF at full size
          pdf.addImage(imgData, 'PNG', 0, 0, mmWidth, mmHeight, undefined, 'FAST');
          
          // Download PDF
          pdf.save(filename);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load SVG'));
      
      // Convert SVG to data URL and load into image
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      img.src = svgUrl;
    });
  } catch (error) {
    console.error('Error loading jsPDF:', error);
    throw new Error('PDF functionality requires jsPDF library');
  }
};


/**
 * Generates a filename for visualization downloads
 */
export const generateVisualizationFilename = (
  type: 'formal' | 'intuitive', 
  format: 'svg' | 'png' | 'pdf' = 'svg'
): string => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  return `${type}-visualization-${timestamp}.${format}`;
}; 