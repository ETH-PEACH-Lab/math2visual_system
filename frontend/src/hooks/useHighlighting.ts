import { useCallback, useMemo } from 'react';
import type { ComponentMapping, ComponentMappingEntry } from '../types/visualInteraction';
import { numberToWord } from '../utils/numberUtils';
import { createSentencePatterns, findSentencePosition, findQuantityInText, splitIntoSentences, findAllNameOccurrencesInText } from '../utils/mwpUtils';
import { MAX_ITEM_DISPLAY } from '../config/api';
import { useDSLContext } from '@/contexts/DSLContext';
import { useHighlightingContext } from '@/contexts/HighlightingContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface UseHighlightingProps {
  svgRef: React.RefObject<HTMLDivElement | null>;
  mwpValue: string;
  formulaValue?: string;
}

interface HighlightConfig {
  applyVisualHighlight: (mapping: ComponentMappingEntry | undefined) => void;
  applyMWPHighlight: (mapping: ComponentMappingEntry | undefined) => void;
}

/**
 * Hook for managing visual highlighting functionality
 * Handles clearing highlights and triggering different types of highlights (box, text, operation)
 */
export const useHighlighting = ({
  svgRef,
  mwpValue,
  formulaValue,
}: UseHighlightingProps) => {
  const { componentMappings } = useDSLContext();
  const { setDslHighlightRanges: onDSLRangeHighlight, setMwpHighlightRanges: onMWPRangeHighlight, setFormulaHighlightRanges, currentDSLPath, currentTargetElement } = useHighlightingContext();
  const { language } = useLanguage();
  const mappings: ComponentMapping = useMemo(() => (componentMappings || {}) as ComponentMapping, [componentMappings]);


  /**
   * Set transform origin for embedded SVG elements using position attributes
   */
  const setSvgTransformOrigin = useCallback((svgElem: SVGElement) => {
    const x = parseFloat(svgElem.getAttribute('x') || '0');
    const y = parseFloat(svgElem.getAttribute('y') || '0');
    const width = parseFloat(svgElem.getAttribute('width') || '0');
    const height = parseFloat(svgElem.getAttribute('height') || '0');
    
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    svgElem.style.transformOrigin = `${centerX}px ${centerY}px`;
  }, []);

  const setupTransformOrigins = useCallback(() => {
    // Handle SVG elements using position attributes
    const allSvgElements = svgRef.current?.querySelectorAll('svg[data-dsl-path]');
    allSvgElements?.forEach(elem => {
      setSvgTransformOrigin(elem as SVGElement);
    });
  }, [svgRef, setSvgTransformOrigin]);

  /**
   * Base function for triggering highlighting with common logic
   */
  const triggerHighlight = useCallback((
    mapping: ComponentMappingEntry | undefined,
    config: HighlightConfig
  ) => {

    // Apply specific visual highlighting
    config.applyVisualHighlight(mapping);

    // Highlight in DSL editor using mapping (if provided)
    onDSLRangeHighlight(mapping?.dsl_range ? [mapping.dsl_range] : []);

    // Apply MWP highlighting
    config.applyMWPHighlight(mapping);
  }, [onDSLRangeHighlight]);

  /**
   * Find and highlight the sentence containing the second operand of an operation
   */
  const highlightSecondOperandSentence = useCallback((operationDslPath: string) => {
    // Early return if missing required data
    if (!mwpValue) return;

    // Find the second operand's value by looking for sibling entities 
    const secondOperandPath = `${operationDslPath}/entities[1]`;
    const secondOperandQuantityPath = `${secondOperandPath}/entity_quantity`;
    const secondOperandQuantity = mappings[secondOperandQuantityPath]?.property_value;
    
    // Early return if no quantity found
    if (!secondOperandQuantity) return;
    
    // Find sentence containing the second operand value using utility functions
    const sentences = splitIntoSentences(mwpValue);
    const numericQuantity = secondOperandQuantity.toString();
    const wordQuantity = numberToWord(parseInt(secondOperandQuantity.toString()), language);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      
      // Check if sentence contains either the numeric form or word form
      const containsNumeric = sentence.includes(numericQuantity);
      const containsWord = sentence.toLowerCase().includes(wordQuantity.toLowerCase());
      
      if (containsNumeric || containsWord) {
        // Use utility function to find sentence position
        const position = findSentencePosition(mwpValue, sentences, i, sentence);
        if (position) {
          const [actualStart, actualEnd] = position;
          onMWPRangeHighlight([[actualStart, actualEnd]]);
          return;
        }
      }
    }
  }, [mwpValue, mappings, onMWPRangeHighlight, language]);

  /**
   * Trigger highlighting for box/container components
   */
  const triggerBoxHighlight = useCallback((mapping: ComponentMappingEntry | undefined, dslPath: string, currentTargetElement: Element) => {
    triggerHighlight(mapping, {
      applyVisualHighlight: () => {
        const targetBox = currentTargetElement as SVGElement;
        targetBox.classList.add('highlighted-box');
      },
      applyMWPHighlight: () => {
        const containerNamePath = `${dslPath}/container_name`;
        const entityNamePath = `${dslPath}/entity_name`;
        const quantityPath = `${dslPath}/entity_quantity`;
        
        const containerName = mappings[containerNamePath]?.property_value;
        const entityName = mappings[entityNamePath]?.property_value;
        const quantity = mappings[quantityPath]?.property_value;

        // Early return if missing required data
        if (!entityName || !mwpValue) {
          onMWPRangeHighlight([]);
          return;
        }
        
        // Use utility function to create sentence patterns
        const sentencePatterns = createSentencePatterns(entityName, quantity, containerName, language);

        for (let i = 0; i < sentencePatterns.length; i++) {
          const pattern = sentencePatterns[i] as RegExp;
          const sentenceMatch = pattern.exec(mwpValue);
          if (sentenceMatch) {
            const sentenceStart = sentenceMatch.index;
            const sentenceEnd = sentenceStart + sentenceMatch[1].length;
            onMWPRangeHighlight([[sentenceStart, sentenceEnd]]);
            return;
          }
        }
        
        // No match found
        onMWPRangeHighlight([]);
      }
    });
  }, [triggerHighlight, mappings, mwpValue, onMWPRangeHighlight, language]);

  /**
   * Trigger highlighting for text/quantity components
   */
  const triggerEntityQuantityHighlightAll = useCallback((dslPath: string) => {
    const mapping = mappings[dslPath];
    const quantity = mapping?.property_value;
    const quantityNum = quantity ? Number(quantity) : NaN;
    const quantityTextElements = svgRef.current?.querySelectorAll(`[data-dsl-path="${CSS.escape(dslPath)}"]`) as NodeListOf<SVGGraphicsElement>;
    
    // Apply visual highlighting based on quantity threshold
    if (quantityTextElements?.length === 0 && !Number.isNaN(quantityNum) && quantityNum <= MAX_ITEM_DISPLAY) {
      // Highlight all individual embedded SVGs for quantities below threshold
      const entityPath = dslPath.replace(/\/entity_quantity$/, '');
      const entityElements = svgRef.current?.querySelectorAll(`[data-dsl-path="${CSS.escape(entityPath)}"]`) as NodeListOf<SVGGraphicsElement>;
      entityElements?.forEach((element) => {
        const entityEl = element as SVGElement;
        entityEl.classList.add('highlighted-box');
      });

      const entityTypePath = `${entityPath}/entity_type`;
      for (let i = 0; i < quantityNum; i++) {
        const indexedPath = `${entityTypePath}[${i}]`;
        const embeddedSvgElements = svgRef.current?.querySelectorAll(`svg[data-dsl-path="${CSS.escape(indexedPath)}"]`) as NodeListOf<SVGGraphicsElement>;
        embeddedSvgElements?.forEach((element) => {
          const embeddedSvgEl = element as SVGGraphicsElement;
          embeddedSvgEl.classList.add('highlighted-svg');
        });
      }
    } else {
      // Highlight quantity text for quantities above threshold
      quantityTextElements?.forEach((element) => {
        const quantityTextEl = element as SVGElement;
        quantityTextEl.classList.add('highlighted-text');
      });
    }
    
    // Common DSL and MWP highlighting logic
    onDSLRangeHighlight(mapping?.dsl_range ? [mapping.dsl_range] : []);
    
    if (quantity && mwpValue) {
      const positions = findQuantityInText(mwpValue, quantity, language);
      onMWPRangeHighlight(positions ?? []);
    }

    // Highlight in formula (optional) — analogous to MWP highlighting
    if (quantity && formulaValue) {
      const positions = findQuantityInText(formulaValue, quantity, language);
      setFormulaHighlightRanges(positions ?? []);
    }
  }, [svgRef, mwpValue, onMWPRangeHighlight, onDSLRangeHighlight, formulaValue, setFormulaHighlightRanges, mappings, language]);

  /**
   * Trigger highlighting for text/quantity component
   */
  const triggerEntityQuantityHighlightText = useCallback((mapping: ComponentMappingEntry | undefined, currentTargetElement: Element) => {
    const quantity = mapping?.property_value;
    
    // Highlight quantity text for quantities above threshold
    const quantityTextEl = currentTargetElement! as SVGElement;
    quantityTextEl.classList.add('highlighted-text');
    
    // Common DSL and MWP highlighting logic
    onDSLRangeHighlight(mapping?.dsl_range ? [mapping.dsl_range] : []);
    
    if (quantity && mwpValue) {
      const positions = findQuantityInText(mwpValue, quantity, language);
      onMWPRangeHighlight(positions ?? []);
    }

    // Highlight in formula (optional) — analogous to MWP highlighting
    if (quantity && formulaValue) {
      const positions = findQuantityInText(formulaValue, quantity, language);
      setFormulaHighlightRanges(positions ?? []);
    }
  }, [mwpValue, onMWPRangeHighlight, onDSLRangeHighlight, formulaValue, setFormulaHighlightRanges, language]);

  /**
   * Trigger highlighting for operation components
   */
  const triggerOperationHighlight = useCallback((mapping: ComponentMappingEntry | undefined, dslPath: string, currentTargetElement: Element) => {
    triggerHighlight(mapping, {
      applyVisualHighlight: () => {
        const operationEl = currentTargetElement as SVGGraphicsElement;
        // Apply CSS class - transform origin is already set by setupSvgTransformOrigins
        operationEl.classList.add('highlighted-svg');
      },
      applyMWPHighlight: () => {
        highlightSecondOperandSentence(dslPath);
      }
    });
  }, [triggerHighlight, highlightSecondOperandSentence]);

  /**
   * Generic function to handle MWP highlighting for text-based elements
   */
  const handleMWPHighlight = useCallback((mapping: ComponentMappingEntry | undefined) => {
    if (!mapping?.property_value || !mwpValue) {
      onMWPRangeHighlight([]);
      return;
    }
    
    const textValue = mapping.property_value;
    const ranges = findAllNameOccurrencesInText(textValue, mwpValue, language);
    
    onMWPRangeHighlight(ranges);
  }, [mwpValue, onMWPRangeHighlight, language]);

  /**
   * Trigger highlighting for entity_type components
   * Highlights the entity_name in the MWP (not the entity_type value)
   */
  const triggerEntityTypeHighlight = useCallback((mappings: ComponentMapping, basePath: string, targetElement: Element) => {
    const mapping = mappings[basePath];
    triggerHighlight(mapping, {
      applyVisualHighlight: () => {
        const embeddedSvgEl = targetElement as SVGGraphicsElement;
        // Apply CSS class and set custom transform origin
        embeddedSvgEl.classList.add('highlighted-svg');
      },
      applyMWPHighlight: () => {
        // For entity_type, we need to highlight the entity_name in the MWP, not the entity_type value
        // Derive the entity_name path from the entity_type path (basePath always ends with 'entity_type')
        const entityNamePath = basePath.slice(0, -11) + 'entity_name';
        const entityNameMapping = mappings[entityNamePath];
        if (entityNameMapping) {
          handleMWPHighlight(entityNameMapping);
        } else {
          handleMWPHighlight(mapping);
        }
      }
    });
  }, [triggerHighlight, handleMWPHighlight]);

  /**
   * Trigger highlighting for embedded SVG components (container_type, attr_type)
   */
  const triggerEmbeddedSvgHighlight = useCallback((mapping: ComponentMappingEntry | undefined, currentTargetElement: Element) => {
    triggerHighlight(mapping, {
      applyVisualHighlight: () => {
        const embeddedSvgEl = currentTargetElement as SVGGraphicsElement;
        // Apply CSS class and set custom transform origin
        embeddedSvgEl.classList.add('highlighted-svg');
      },
      applyMWPHighlight: () => handleMWPHighlight(mapping)
    });
  }, [triggerHighlight, handleMWPHighlight]);

  /**
   * Generic function to handle visual highlighting for text elements
   */
  const applyTextVisualHighlight = useCallback((_mapping: ComponentMappingEntry | undefined, currentTargetElement: Element) => {
    const textEl = currentTargetElement as SVGElement;
    textEl.classList.add('highlighted-text');
  }, []);

  /**
   * Trigger highlighting for attr_name components (text elements for attribute names)
   */
  const triggerAttrNameHighlight = useCallback((mapping: ComponentMappingEntry | undefined, currentTargetElement: Element) => {
    triggerHighlight(mapping, {
      applyVisualHighlight: (mapping) => applyTextVisualHighlight(mapping, currentTargetElement),
      applyMWPHighlight: (mapping) => handleMWPHighlight(mapping)
    });
  }, [triggerHighlight, applyTextVisualHighlight, handleMWPHighlight]);

  /**
   * Trigger highlighting for container_name components (text elements)
   */
  const triggerContainerNameHighlight = useCallback((mapping: ComponentMappingEntry | undefined, currentTargetElement: Element) => {
    triggerHighlight(mapping, {
      applyVisualHighlight: (mapping) => applyTextVisualHighlight(mapping, currentTargetElement),
      applyMWPHighlight: (mapping) => handleMWPHighlight(mapping)
    });
  }, [triggerHighlight, applyTextVisualHighlight, handleMWPHighlight]);

  /**
   * Trigger highlighting for result container components (box elements)
   */
  const triggerResultContainerHighlight = useCallback((mapping: ComponentMappingEntry | undefined, currentTargetElement: Element) => {
    triggerHighlight(mapping, {
      applyVisualHighlight: () => {
        const targetBox = currentTargetElement as SVGElement;
        targetBox.classList.add('highlighted-box');
      },
      applyMWPHighlight: () => {
        // For result containers, we don't highlight anything in the MWP
        onMWPRangeHighlight([]);
      }
    });
  }, [triggerHighlight, onMWPRangeHighlight]);

  const removeElementHighlights = useCallback(() => {
    if (svgRef.current) {
      const highlightedElements = svgRef.current.querySelectorAll('.highlighted-box, .highlighted-text, .highlighted-svg');
      highlightedElements.forEach((element) => {
        element.classList.remove('highlighted-box', 'highlighted-text', 'highlighted-svg');
      });
    }
  }, [svgRef]);

  /**
   * Highlight the visual element corresponding to a given DSL path and target element
   */
  const highlightDSLPath = useCallback((dslPath: string, targetElement: Element) => {
    // Remove indices from the end of the path for matching
    let basePath = dslPath.endsWith(']') ? dslPath.slice(0, dslPath.lastIndexOf("[")) : dslPath;
    // Get the mapping for the current DSL path
    let mapping = mappings[dslPath];
    
    // Handle indexed paths - convert to base path if needed
    const pathSegments = dslPath.split("/");
    const lastSegment = pathSegments.pop();
    if (!mapping && lastSegment?.startsWith('entity_type')) {
      pathSegments.push('entity_type');
      basePath = pathSegments.join('/');
      mapping = mappings[basePath];
    }

    // Map DSL path types to their corresponding highlight functions
    const pathTypeHandlers: Record<string, () => void> = {
      'entity_quantity': () => triggerEntityQuantityHighlightText(mapping, targetElement),
      'container_name': () => triggerContainerNameHighlight(mapping, targetElement),
      'attr_name': () => triggerAttrNameHighlight(mapping, targetElement),
      'entity_type': () => triggerEntityTypeHighlight(mappings, basePath, targetElement),
      'container_type': () => triggerEmbeddedSvgHighlight(mapping, targetElement),
      'attr_type': () => triggerEmbeddedSvgHighlight(mapping, targetElement),
      'operation': () => triggerOperationHighlight(mapping, dslPath, targetElement),
      'result_container': () => triggerResultContainerHighlight(mapping, targetElement),
    };

    // Find the matching handler for the current path
    const pathType = basePath.split('/').pop();
    const handler = pathType && pathTypeHandlers[pathType];

    if (handler) {
      handler(); // Execute the handler function
    } else if (basePath.endsWith('entities')) {
      // Special case for entity containers (boxes)
      triggerBoxHighlight(mapping, dslPath, targetElement);
    }
  }, [triggerEntityQuantityHighlightText, triggerContainerNameHighlight, triggerAttrNameHighlight, triggerEntityTypeHighlight, triggerEmbeddedSvgHighlight, triggerBoxHighlight, triggerOperationHighlight, triggerResultContainerHighlight, mappings]);

  /**
   * Highlight the visual element corresponding to the current DSL path
   */
  const highlightCurrentDSLPath = useCallback(() => {
    if (!currentDSLPath) {
      return;
    }
        
    if (currentTargetElement) {
      // Case 1: We have both DSL path and target element (from hovering over SVG)
      highlightDSLPath(currentDSLPath, currentTargetElement);
    } else if (currentDSLPath.endsWith('/entity_quantity')) {
      triggerEntityQuantityHighlightAll(currentDSLPath);
    } else {
      // Case 2: We have DSL path but no target element (from clicking in DSL editor)
      // Find all elements with this DSL path and highlight them

      const escapedPath = CSS.escape(currentDSLPath);
      const targetElements = svgRef.current?.querySelectorAll(`[data-dsl-path="${escapedPath}"]`);
      
      if (targetElements && targetElements.length > 0) {
        targetElements.forEach((element) => {
          highlightDSLPath(currentDSLPath, element);
        });
      }
    }
  }, [removeElementHighlights, currentDSLPath, currentTargetElement, highlightDSLPath, triggerEntityQuantityHighlightAll, svgRef]);


  const returnValue = useMemo(() => ({
    setupTransformOrigins,
    triggerBoxHighlight,
    triggerEntityQuantityHighlightText,
    triggerOperationHighlight,
    triggerEmbeddedSvgHighlight,
    triggerContainerNameHighlight,
    triggerAttrNameHighlight,
    triggerResultContainerHighlight,
    highlightDSLPath,
    highlightCurrentDSLPath,
    removeElementHighlights,
  }), [
    setupTransformOrigins,
    triggerBoxHighlight,
    triggerEntityQuantityHighlightText,
    triggerOperationHighlight,
    triggerEmbeddedSvgHighlight,
    triggerContainerNameHighlight,
    triggerAttrNameHighlight,
    triggerResultContainerHighlight,
    highlightDSLPath,
    highlightCurrentDSLPath,
    removeElementHighlights,
  ]);

  return returnValue;
};
