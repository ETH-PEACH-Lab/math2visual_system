// Centralized backend URL configuration
// Uses environment variables with fallbacks for different environments
const getBackendUrl = () => {
  // In development, use Vite's proxy (no port needed)
  if (import.meta.env.DEV) {
    return window.location.origin; // Uses Vite dev server port (5173)
  }
  
  // In production, use environment variable or default
  return import.meta.env.VITE_BACKEND_URL || window.location.origin;
};

export const BACKEND_BASE_URL = getBackendUrl();

export const BACKEND_API_URL = `${BACKEND_BASE_URL}/api`;

// Visualization threshold: single SVG with number vs multiple SVGs
export const MAX_ITEM_DISPLAY = 10;

export default {
  BACKEND_BASE_URL,
  BACKEND_API_URL,
  MAX_ITEM_DISPLAY,
};


