import n2words from 'n2words';

/**
 * Convert a number to its word representation in the given language.
 * Currently supports at least English ('en') and German ('de').
 *
 * Falls back to the numeric string form on error.
 */
export const numberToWord = (num: number, language: string = 'en'): string => {
  try {
    const result = n2words(num, { lang: language.toLowerCase() });
    return typeof result === 'string' ? result : num.toString();
    } catch (error) {
      console.warn('Failed to convert number to word:', num, error);
    return num.toString();
  }
};
