import { useState, useCallback } from 'react';
import { generationService } from '@/api_services/generation';
import { useDSLContext } from '@/contexts/DSLContext';
import { useHighlightingContext } from '@/contexts/HighlightingContext';
import { DSLFormatter } from '@/utils/dsl-formatter';
import { trackOpenPopup, isAnalyticsEnabled } from '@/services/analyticsTracker';
import { replaceQuantities } from '@/utils/mwpUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ParsedOperation, ParsedEntity } from '@/utils/dsl-parser';
import type { ComponentMapping } from '@/types/visualInteraction';

interface EntityQuantityPopupState {
  isOpen: boolean;
  dslPath: string;
  initialQuantity: number;
}

interface UseEntityQuantityPopupProps {
  mwp: string;
  formula: string | null;
  onVisualsUpdate: (data: {
    visual_language: string;
    svg_formal: string | null;
    svg_intuitive: string | null;
    formal_error: string | null;
    intuitive_error: string | null;
    missing_svg_entities: string[];
    componentMappings: ComponentMapping;
    parsedDSL: ParsedOperation | null;
    mwp?: string;
    formula?: string | null;
  }) => void;
}

export const useEntityQuantityPopup = ({
  mwp,
  formula,
  onVisualsUpdate
}: UseEntityQuantityPopupProps) => {
  const { parsedDSL } = useDSLContext();
  const { componentMappings } = useDSLContext();
  const { setSelectedElement, clearHighlightingState } = useHighlightingContext();
  const { language } = useLanguage();
  const [popupState, setPopupState] = useState<EntityQuantityPopupState>({
    isOpen: false,
    dslPath: '',
    initialQuantity: 1,
  });

  /**
   * Open the entity quantity popup
   */
  const openPopup = useCallback((event: MouseEvent) => {
    // Find the correct element using closest() method
    // This ensures we get the actual element with data-dsl-path, not a child element
    const el = event.target as Element;
    const targetElement = el.closest('[data-dsl-path]') as Element;
    const dslPath = el.getAttribute('data-dsl-path') || '';
    // Normalize and store a concrete path that points to the quantity field
    const normalizedPath = dslPath.endsWith('/entity_quantity')
    ? dslPath
    : `${dslPath}/entity_quantity`;

    // Track popup open
    if (isAnalyticsEnabled()) {
      trackOpenPopup('entity_quantity', dslPath);
    }

    // Trigger highlight via existing system
    setSelectedElement(targetElement);

    const currentQty = getEntityQuantityValue(componentMappings, normalizedPath) || 1;

    setPopupState({
      isOpen: true,
      dslPath: normalizedPath,
      initialQuantity: currentQty,
    });
  }, [setSelectedElement, componentMappings]);

  /**
   * Close the entity quantity popup
   */
  const closePopup = useCallback(() => {
    clearHighlightingState();
    setPopupState({
      isOpen: false,
      dslPath: '',
      initialQuantity: 1,
    });
  }, [clearHighlightingState]);

  /**
   * Update entity quantity in DSL and regenerate visuals
   */
  const updateEntityQuantity = useCallback(async (newQuantity: number) => {
    if (!parsedDSL || !popupState.dslPath) {
      throw new Error('Missing parsed DSL or DSL path');
    }

    try {
      // Update the parsed DSL object
      const updatedParsedDSL = updateQuantityInParsedDSL(parsedDSL, popupState.dslPath, newQuantity);

      // Format the updated parsed DSL back to string
      const formatter = new DSLFormatter();
      const updatedDSL = formatter.formatWithRanges(updatedParsedDSL);

      // Update MWP and formula with the quantity change
      const oldQuantity = popupState.initialQuantity.toString();
      const newQuantityStr = newQuantity.toString();
      const updatedMWP = replaceQuantities(mwp, oldQuantity, newQuantityStr, language);
      const updatedFormula = formula ? replaceQuantities(formula, oldQuantity, newQuantityStr, language) : formula;

      // Generate new visuals with updated DSL
      const abortController = new AbortController();
      const data = await generationService.generateFromDSL(updatedDSL, abortController.signal);

      // Update the application state with new results
      onVisualsUpdate({
        visual_language: data.visual_language,
        svg_formal: data.svg_formal,
        svg_intuitive: data.svg_intuitive,
        formal_error: data.formal_error ?? null,
        intuitive_error: data.intuitive_error ?? null,
        missing_svg_entities: data.missing_svg_entities || [],
        componentMappings: data.componentMappings || {},
        parsedDSL: data.parsedDSL,
        mwp: updatedMWP,
        formula: updatedFormula,
      });

    } catch (error) {
      console.error('Entity quantity update failed:', error);
      throw error;
    }
  }, [parsedDSL, popupState.dslPath, popupState.initialQuantity, mwp, formula, onVisualsUpdate, language]);

  return {
    popupState,
    openPopup,
    closePopup,
    updateEntityQuantity,
  };
};

/**
 * Helper to read current entity quantity from component mappings
 */
export function getEntityQuantityValue(
  componentMappings: ComponentMapping | null,
  dslPath: string
): number | null {
  if (!componentMappings) return null;

  // Normalize path: ensure it ends with '/entity_quantity'
  const normalizedPath = dslPath.endsWith('/entity_quantity')
    ? dslPath
    : `${dslPath}/entity_quantity`;

  const mapping = componentMappings[normalizedPath];
  if (!mapping?.property_value) return null;

  const quantity = parseInt(mapping.property_value, 10);
  return isNaN(quantity) ? null : quantity;
}

/**
 * Helper function to update quantity value in parsed DSL object using DSL path
 */
function updateQuantityInParsedDSL(
  parsedDSL: ParsedOperation,
  dslPath: string,
  newQuantity: number
): ParsedOperation {
  // Create a deep clone to avoid mutating the original
  const clonedDSL = JSON.parse(JSON.stringify(parsedDSL));

  // Navigate through the DSL path to find and update the target value
  const success = updateQuantityAtPath(clonedDSL, dslPath, newQuantity);

  if (!success) {
    throw new Error(`Could not find or update quantity at DSL path: ${dslPath}`);
  }

  return clonedDSL;
}

/**
 * Recursively navigate through the DSL structure using the path and update the quantity
 */
function updateQuantityAtPath(
  obj: ParsedOperation | ParsedEntity,
  dslPath: string,
  newQuantity: number
): boolean {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;
  // Remove leading slash and split path into segments
  const pathSegments = dslPath.replace(/^\//, '').split('/');

  let current: unknown = obj;

  // Navigate through all segments except the last one
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];

    // Handle array access like "entities[0]"
    const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayName, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);

      if (!isRecord(current)) {
        return false;
      }

      const arrayValue = current[arrayName];
      if (!Array.isArray(arrayValue)) {
        return false;
      }

      if (index >= arrayValue.length) {
        return false;
      }

      current = arrayValue[index];
    } else {
      // Handle regular property access
      // Skip the first "operation" segment since the obj is already the operation
      if (segment === 'operation') {
        continue;
      }

      if (!isRecord(current)) {
        return false;
      }
      if (!(segment in current)) {
        return false;
      }
      current = (current as Record<string, unknown>)[segment];
    }
  }

  // Handle the final segment (the property to update)
  const finalSegment = pathSegments[pathSegments.length - 1];

  if (finalSegment === 'entity_quantity') {
    // Update entity_quantity in the item object or directly
    if (!isRecord(current)) {
      return false;
    }

    const currentRecord = current as Record<string, unknown>;
    if (isRecord(currentRecord.item)) {
      (currentRecord.item as Record<string, unknown>).entity_quantity = newQuantity as unknown as number;
      return true;
    } else if ('entity_quantity' in currentRecord) {
      (currentRecord as unknown as { entity_quantity: number }).entity_quantity = newQuantity;
      return true;
    }
  }

  return false;
}
