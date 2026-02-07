import type { ComponentMapping } from "@/types/visualInteraction";
import type { ParsedOperation } from "@/utils/dsl-parser";

// Form data types
export interface FormData {
  mwp: string;
  formula?: string;
  hint?: string;
}

export interface VLFormData {
  dsl: string;
}

// API request and response types
export interface ApiRequest {
  mwp?: string;
  formula?: string;
  hint?: string;
  dsl?: string;
  language?: string; // Language code (e.g., 'en', 'de')
}

export interface ApiResponse {
  parsedDSL: ParsedOperation | null;
  visual_language: string;
  svg_formal: string | null;
  svg_intuitive: string | null;
  formal_error?: string;
  intuitive_error?: string;
  error?: string;
  is_parse_error?: boolean;
  missing_svg_entities?: string[];
  componentMappings?: ComponentMapping;
}

// Application state types
// Upload functionality types
export interface ValidationDetails {
  filename_valid: boolean;
  size_valid: boolean;
  type_valid: boolean;
  content_valid: boolean;
  antivirus_scan?: string | null;
}

export interface SVGUploadResponse {
  success: boolean;
  error?: string;
  message?: string;
  validation_details?: ValidationDetails;
}

// Custom error class for validation failures
export class ValidationError extends Error {
  public readonly title: string;
  public readonly validationDetails: ValidationDetails;

  constructor(message: string, title: string, validationDetails: ValidationDetails) {
    super(message);
    this.name = 'ValidationError';
    this.title = title;
    this.validationDetails = validationDetails;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  // Helper method to check if an error is a ValidationError
  static isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError;
  }
}

export interface AppState {
  mpFormLoading: boolean;
  vlFormLoading: boolean;
  svgFormal: string | null;
  svgIntuitive: string | null;
  formalError: string | null;
  intuitiveError: string | null;
  hasParseError: boolean;
  currentAbortFunction: (() => void) | undefined;
  missingSVGEntities: string[];
  uploadGenerating: boolean;
  uploadedEntities: string[];
  hasCompletedGeneration: boolean;
  mwp: string;
  formula: string;
  hint: string;
}

// Download types
export type DownloadFormat = 'svg' | 'png' | 'pdf';
export type VisualizationType = 'formal' | 'intuitive';

export interface DownloadOption {
  format: DownloadFormat;
  label: string;
  icon: string;
}

// Component props types
export interface ErrorDisplayProps {
  error: string;
}

 