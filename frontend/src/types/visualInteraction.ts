/**
 * Individual mapping entry for a DSL path
 * Contains range information for highlighting and property values for processing
 */
export interface ComponentMappingEntry {
  /** Character range in the DSL text for highlighting */
  dsl_range?: [number, number];
  /** Property value (quantity, name, etc.) if this path represents a property */
  property_value?: string;
}

/**
 * Mapping between DSL paths and their corresponding metadata
 * Contains range information for highlighting and property values for processing
 */
export interface ComponentMapping {
  [dslPath: string]: ComponentMappingEntry;
}

/**
 * Props for the main useVisualInteraction hook
 * Provides all necessary dependencies and callback handlers
 */

/**
 * Configuration for highlight behavior
 * Used internally by highlighting hooks
 */
export interface HighlightConfig {
  /** Function to apply visual highlighting to SVG elements */
  applyVisualHighlight: () => void;
  /** Function to apply highlighting to MWP text */
  applyMWPHighlight: () => void;
}

/**
 * Configuration for element event listeners
 * Used internally by interaction hooks
 */
export interface ElementListenerConfig {
  /** Mouse enter event handler */
  onMouseEnter: () => void;
  /** Additional setup logic for the element */
  extraSetup?: () => void;
}
