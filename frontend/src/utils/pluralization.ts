import pluralize from 'pluralize';

/**
 * Language-aware pluralization utility
 * Uses pluralize library for English and custom rules for other languages
 */

/**
 * Basic German pluralization rules
 * German pluralization is complex, but this handles common cases
 * 
 * NOTE: This is a simplified implementation. If a dedicated German pluralization
 * library becomes available, it can be imported and used here instead.
 * For example: import { pluralizeGerman } from 'german-pluralize-library';
 */
function pluralizeGerman(word: string): string {
  if (!word || word.length === 0) {
    return word;
  }

  const lowerWord = word.toLowerCase();
  const isCapitalized = word[0] === word[0].toUpperCase();

  // Common German pluralization patterns
  // Note: This is a simplified implementation. German pluralization has many exceptions.
  
  // Words ending in -e (most common pattern, e.g. Orange -> Orangen, Katze -> Katzen)
  if (lowerWord.endsWith('e') && !lowerWord.endsWith('ie') && !lowerWord.endsWith('ee')) {
    return word + 'n';
  }

  // Words ending in -el, -er, -en (usually no change, but some add -n)
  if (lowerWord.endsWith('el') || lowerWord.endsWith('er') || lowerWord.endsWith('en')) {
    // Most don't change, but some common words do
    return word;
  }

  // Words ending in -ung, -heit, -keit, -schaft (add -en)
  if (lowerWord.endsWith('ung') || lowerWord.endsWith('heit') || 
      lowerWord.endsWith('keit') || lowerWord.endsWith('schaft')) {
    return word + 'en';
  }

  // Words ending in -in (Königin, add -nen)
  if (lowerWord.endsWith('in')) {
    return word + 'nen';
  }

  // Words ending in -us (often become -usse or -i)
  if (lowerWord.endsWith('us')) {
    return word + 'se';
  }

  // Words ending in -um (become -en or -a)
  if (lowerWord.endsWith('um')) {
    return word.slice(0, -2) + 'en';
  }

  // Words ending in -a (add -s or -en)
  if (lowerWord.endsWith('a')) {
    return word + 's';
  }

  // Words ending in -o (add -s)
  if (lowerWord.endsWith('o')) {
    return word + 's';
  }

  // Default: add -e (common pattern)
  const plural = word + 'e';

  // Handle umlauts in common cases (simplified)
  // Apfel -> Äpfel, but we'll keep it simple for now
  if (lowerWord.includes('a') && !lowerWord.includes('ä')) {
    // Don't automatically add umlauts as it's complex
  }

  return isCapitalized 
    ? plural.charAt(0).toUpperCase() + plural.slice(1).toLowerCase()
    : plural;
}

/**
 * Pluralize a word based on the specified language
 * @param word - The word to pluralize
 * @param language - Language code ('en' for English, 'de' for German, etc.)
 * @returns The pluralized form of the word
 */
export function pluralizeWord(word: string, language: string = 'en'): string {
  if (!word || word.length === 0) {
    return word;
  }

  switch (language.toLowerCase()) {
    case 'en':
      return pluralize(word);
    case 'de':
      return pluralizeGerman(word);
    default:
      // Default to English for unsupported languages
      return pluralize(word);
  }
}

