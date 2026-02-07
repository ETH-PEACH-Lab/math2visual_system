/**
 * Shared validation constants and utilities for file names and string inputs
 * These should match the backend validation rules in validation_constants.py
 */

import { SVGDatasetService } from '@/api_services/svgDataset';

export const FILE_NAME_VALIDATION = {
  MAX_LENGTH: 100,
  ALLOWED_CHARS_PATTERN: /^[a-zA-Z\-\s]+$/,
  CONSECUTIVE_PATTERN: /\s{2,}|-{2,}/,
} as const;

// String size limits for API inputs (in characters)
// These should match the backend constants in validation_constants.py
export const STRING_SIZE_LIMITS = {
  MWP_MAX_LENGTH: 5000,        // Math word problems
  DSL_MAX_LENGTH: 10000,       // Visual Language DSL (can be lengthy)
  MESSAGE_MAX_LENGTH: 5000,    // Chat messages
  FORMULA_MAX_LENGTH: 1000,    // Mathematical formulas
  HINT_MAX_LENGTH: 5000,       // Hints (same as MWP)
} as const;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file name format on the frontend
 * This should match the backend validation in validation_constants
 */
const validateFormat = (name: string): ValidationResult => {
  if (!name) {
    return { valid: false, error: 'File name cannot be empty' };
  }
  
  if (name.length > FILE_NAME_VALIDATION.MAX_LENGTH) {
    return { 
      valid: false, 
      error: `File name is too long (max ${FILE_NAME_VALIDATION.MAX_LENGTH} characters)` 
    };
  }
  
  // Check if name contains only allowed characters: letters, dashes, spaces
  if (!FILE_NAME_VALIDATION.ALLOWED_CHARS_PATTERN.test(name)) {
    return { 
      valid: false, 
      error: 'File name can only contain letters, dashes, and spaces' 
    };
  }
  
  // Check for consecutive spaces or dashes
  if (FILE_NAME_VALIDATION.CONSECUTIVE_PATTERN.test(name)) {
    return { 
      valid: false, 
      error: 'File name cannot contain consecutive spaces or dashes' 
    };
  }
  
  // Check if it starts or ends with space or dash
  if (name.startsWith(' ') || name.startsWith('-') || name.endsWith(' ') || name.endsWith('-')) {
    return { 
      valid: false, 
      error: 'File name cannot start or end with space or dash' 
    };
  }
  
  return { valid: true };
};

/**
 * Validates file name format and uniqueness on the frontend
 * This includes both format validation and uniqueness check against the dataset
 */
export const validateFormatAsync = async (name: string): Promise<ValidationResult> => {
  // First do format validation
  const formatValidation = validateFormat(name);
  if (!formatValidation.valid) {
    return formatValidation;
  }

  // Then check uniqueness
  try {
    const exists = await SVGDatasetService.checkSVGNameExists(name);
    if (exists) {
      return { valid: false, error: 'This name already exists in the dataset' };
    }
  } catch (error) {
    console.error('Uniqueness check failed:', error);
    return { valid: false, error: 'Failed to check name uniqueness' };
  }

  return { valid: true };
};
