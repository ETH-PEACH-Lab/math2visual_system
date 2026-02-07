/**
 * Utility functions for API requests
 */

/**
 * Get the current language from localStorage
 */
export function getCurrentLanguage(): string {
  const saved = localStorage.getItem('math2visual-language');
  if (saved) {
    return saved;
  }
  
  // Fallback to browser language
  const browserLang = navigator.language.split('-')[0];
  return ['en', 'de'].includes(browserLang) ? browserLang : 'en';
}

/**
 * Get headers with language information
 */
export function getHeadersWithLanguage(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const language = getCurrentLanguage();
  return {
    'Content-Type': 'application/json',
    'Accept-Language': language,
    ...additionalHeaders,
  };
}

