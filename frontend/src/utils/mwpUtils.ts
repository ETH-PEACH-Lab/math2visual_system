import { numberToWord } from './numberUtils';
import { pluralizeWord } from './pluralization';

/**
 * Utility functions for Math Word Problem (MWP) text processing and highlighting
 */

/**
 * Split text into sentences using common sentence separators
 * @param text - The text to split
 * @returns Array of trimmed sentences (empty sentences filtered out)
 */
export const splitIntoSentences = (text: string): string[] => {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
};

/**
 * Create regex patterns for finding sentences containing specific values
 * @param entityName - The entity name to search for
 * @param quantity - The quantity to search for (optional)
 * @param containerName - The container name to search for (optional)
 * @param language - Language code for pluralization (default: 'en')
 * @returns Array of regex patterns ordered by specificity (most specific first):
 *   1. Container + Quantity + Entity (if entity provided)
 *   2. Container + Quantity
 *   3. Quantity only
 *   4. Container only
 */
export const createSentencePatterns = (
  entityName: string,
  quantity?: string,
  containerName?: string,
  language: string = 'en',
): RegExp[] => {
  const patterns: RegExp[] = [];
  const entityNamePattern = createNamePattern(entityName, language);
  
  if (quantity) {
    // Convert quantity to both numeric and word forms for pattern matching
    const numericQuantity = quantity.toString();
    const wordQuantity = numberToWord(parseInt(quantity.toString()), language);
    const quantityPattern = `(${numericQuantity}|${wordQuantity})`;
    
    if (containerName) {
      patterns.push(
        new RegExp(`([^.!?]*${containerName}[^.!?]*${quantityPattern}[^.!?]*${entityNamePattern}[^.!?]*[.!?])`, 'i')
      );
    
      // Pattern with container + quantity (no entity requirement)
      patterns.push(
        new RegExp(`([^.!?]*${containerName}[^.!?]*${quantityPattern}[^.!?]*[.!?])`, 'i')
      );
    }

    // Pattern with just quantity (between container+quantity and container-only)
    patterns.push(
      new RegExp(`([^.!?]*${quantityPattern}[^.!?]*[.!?])`, 'i')
    );
  }

  if (containerName) {
    patterns.push(
      new RegExp(`([^.!?]*${containerName}[^.!?]*[.!?])`, 'i')
    );
  }

  // Fallback pattern with just container
  patterns.push(
    new RegExp(`([^.!?]*${entityNamePattern}[^.!?]*[.!?])`, 'i')
  );
  
  return patterns;
};

/**
 * Find the position of a sentence in the original text
 * @param originalText - The full text
 * @param sentences - Array of split sentences
 * @param sentenceIndex - Index of the sentence to find
 * @param sentence - The sentence text to match
 * @returns Tuple of [start, end] positions or null if not found
 */
export const findSentencePosition = (
  originalText: string,
  sentences: string[],
  sentenceIndex: number,
  sentence: string
): [number, number] | null => {
  // Calculate the approximate position based on previous sentences
  let sentenceStart = 0;
  for (let j = 0; j < sentenceIndex; j++) {
    sentenceStart += sentences[j].length + 1; // +1 for the separator
  }
  
  // Find the actual start position in the original text
  const escapedSentence = sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const actualSentenceMatch = originalText.substring(sentenceStart).match(
    new RegExp(`\\s*${escapedSentence}`)
  );
  
  if (actualSentenceMatch && actualSentenceMatch.index !== undefined) {
    const matchStart = sentenceStart + actualSentenceMatch.index;
    // Find where the actual sentence text starts (after any leading whitespace)
    const leadingWhitespaceLength = actualSentenceMatch[0].length - sentence.length;
    const actualStart = matchStart + leadingWhitespaceLength;
    const actualEnd = actualStart + sentence.length;
    return [actualStart, actualEnd];
  }
  
  return null;
};

/**
 * Find and highlight a quantity in text using both numeric and word forms
 * @param text - The text to search in
 * @param quantity - The quantity to search for
 * @returns Tuple of [start, end] positions or null if not found
 */
export const findQuantityInText = (
  text: string,
  quantity: string | number,
  language: string = 'en'
): [number, number][] | null => {
  const numericQuantity = quantity.toString();
  const wordQuantity = numberToWord(parseInt(quantity.toString()), language);
  
  // Collect matches for numeric form
  const ranges: [number, number][] = [];
  let regex = new RegExp(`\\b${numericQuantity}\\b`, 'g');
  for (const m of text.matchAll(regex)) {
    ranges.push([m.index!, m.index! + m[0].length]);
  }

  if (ranges.length > 0) {
    return ranges;
  }

  // Collect matches for word form (case-insensitive)
  regex = new RegExp(`\\b${wordQuantity}\\b`, 'gi');
  for (const m of text.matchAll(regex)) {
    ranges.push([m.index!, m.index! + m[0].length]);
  }

  return ranges.length > 0 ? ranges : null;
};

/**
 * Create a flexible regex pattern for names that handles singular/plural variations
 * Uses language-aware pluralization for accurate pluralization with support for irregular plurals
 * @param name - The name to create a pattern for (e.g., "colorful flower")
 * @param language - Language code for pluralization (default: 'en')
 * @returns A regex pattern string that matches both singular and plural forms
 * @example "colorful flower" → matches "colorful flower" and "colorful flowers"
 */
export const createNamePattern = (name: string, language: string = 'en'): string => {
  // Escape special regex characters
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Split into words
  const words = escapedName.split(/\s+/);
  
  // Handle pluralization for the last word only (typically the noun)
  if (words.length > 0) {
    const lastWord = words[words.length - 1];
    
    // Get the plural form using language-aware pluralization
    const pluralForm = pluralizeWord(lastWord, language);
    
    // Create pattern that matches both singular and plural forms
    if (pluralForm !== lastWord) {
      // Both forms are different, create an alternation pattern
      words[words.length - 1] = `(${lastWord}|${pluralForm})`;
    } else {
      // Forms are the same (already plural or irregular), just use the word
      words[words.length - 1] = lastWord;
    }
  }
  
  // Join words with flexible whitespace pattern (allows multiple spaces)
  const pattern = words.join('\\s+');
  
  // Add word boundaries to ensure we match complete phrases
  return `\\b${pattern}\\b`;
};

/**
 * Find all occurrences of name in the text (fallback function)
 * @param name - The name to search for
 * @param mwpText - The full MWP text to search within
 * @param language - Language code for pluralization (default: 'en')
 * @returns Array of [start, end] ranges for all occurrences
 */
export const findAllNameOccurrencesInText = (
  name: string,
  mwpText: string,
  language: string = 'en'
): [number, number][] => {
  const namePattern = createNamePattern(name, language);
  const nameRegex = new RegExp(namePattern, 'gi');
  const allMatches = Array.from(mwpText.matchAll(nameRegex));
  
  return allMatches.map(match => [match.index!, match.index! + match[0].length] as [number, number]);
};

/**
 * Replace entity names in MWP text
 * Handles proper pluralization using language-aware pluralization (e.g., "peach" → "peaches")
 * @param text - The text to replace names in
 * @param oldName - The old entity name
 * @param newName - The new entity name
 * @param language - Language code for pluralization (default: 'en')
 */
export function replaceEntityNames(text: string, oldName: string, newName: string, language: string = 'en'): string {
  // Get plural forms using language-aware pluralization
  const oldPlural = pluralizeWord(oldName, language);
  const newPlural = pluralizeWord(newName, language);
  
  // Create a regex that matches both singular and plural forms
  // Use alternation with the longer form first to prevent partial matches
  const pattern = oldPlural.length > oldName.length 
    ? `\\b(${oldPlural}|${oldName})\\b`
    : `\\b(${oldName}|${oldPlural})\\b`;
  
  const regex = new RegExp(pattern, 'gi');
  
  return text.replace(regex, (match) => {
    // Determine if the matched word is plural by comparing with the plural form
    const isPlural = match.toLowerCase() === oldPlural.toLowerCase();
    
    // Preserve the case of the original match
    const result = isPlural ? newPlural : newName;
    
    // Match the case pattern of the original text
    if (match[0] === match[0].toUpperCase()) {
      // First letter was uppercase
      return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
    }
    return result.toLowerCase();
  });
}

/**
 * Replace quantities in MWP text (handles both numeric and text forms)
 */
export function replaceQuantities(text: string, oldQuantity: string, newQuantity: string, language: string = 'en'): string {
  const oldNum = parseFloat(oldQuantity);
  const newNum = parseFloat(newQuantity);
  
  if (isNaN(oldNum) || isNaN(newNum)) {
    // If either value isn't a number, do simple text replacement
    const regex = new RegExp(`\\b${oldQuantity}\\b`, 'gi');
    return text.replace(regex, newQuantity);
  }
  
  // Convert numbers to text form for better MWP readability (language-aware)
  const oldText = numberToWord(oldNum, language);
  const newText = numberToWord(newNum, language);
  
  // Replace both numeric and text forms
  let updatedText = text;
  
  // Replace numeric form
  const numericRegex = new RegExp(`\\b${oldQuantity}\\b`, 'gi');
  updatedText = updatedText.replace(numericRegex, newQuantity);
  
  // Replace text form
  const textRegex = new RegExp(`\\b${oldText}\\b`, 'gi');
  updatedText = updatedText.replace(textRegex, newText);
  
  return updatedText;
}

/**
 * Replace container names in MWP text
 */
export function replaceContainerNames(text: string, oldName: string, newName: string): string {
  // Use word boundaries to avoid partial replacements
  const regex = new RegExp(`\\b${oldName}\\b`, 'gi');
  return text.replace(regex, newName);
}
