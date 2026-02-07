import { useState, useEffect } from 'react';

interface ResponsiveLogoProps {
  className?: string;
  alt?: string;
}

export const ResponsiveLogo = ({ 
  className = "w-8 h-8", 
  alt = "Math2Visual Logo" 
}: ResponsiveLogoProps) => {
  const [logoSrc, setLogoSrc] = useState('/logo192.png');

  useEffect(() => {
    const updateLogoSrc = () => {
      // Check for high DPI displays (retina, etc.)
      const isHighDPI = window.devicePixelRatio > 1;
      
      // Check screen size
      const isLargeScreen = window.innerWidth >= 1024; // lg breakpoint
      const isMediumScreen = window.innerWidth >= 768; // md breakpoint
      const isSmallScreen = window.innerWidth < 640; // sm breakpoint
      
      // Determine appropriate logo based on device characteristics
      if (isHighDPI && isLargeScreen) {
        setLogoSrc('/logo512.png'); // High-res for large screens with high DPI
      } else if (isHighDPI || isLargeScreen) {
        setLogoSrc('/logo192.png'); // Medium-res for high DPI or large screens
      } else if (isMediumScreen) {
        setLogoSrc('/logo192.png'); // Medium-res for medium screens
      } else if (isSmallScreen) {
        setLogoSrc('/favicon-32x32.png'); // Small for mobile/small screens
      } else {
        setLogoSrc('/logo192.png'); // Default fallback
      }
    };

    // Set initial logo
    updateLogoSrc();

    // Update on resize
    window.addEventListener('resize', updateLogoSrc);
    
    return () => window.removeEventListener('resize', updateLogoSrc);
  }, []);

  return (
    <img
      src={logoSrc}
      alt={alt}
      className={className}
    />
  );
};
