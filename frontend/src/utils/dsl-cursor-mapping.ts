/**
 * DSL Cursor Mapping
 */
import { MAX_ITEM_DISPLAY } from '@/config/api';
import type { ComponentMapping } from '@/types/visualInteraction';

/**
 * Find the most specific DSL path for a given cursor position using component mappings
 */
export function findDSLPathAtPosition(componentMappings: ComponentMapping, cursorOffset: number): string | null {
  // Validate offset bounds
  if (cursorOffset < 0) {
    return null;
  }

  // Find all ranges that contain the cursor position
  const containingRanges = Object.entries(componentMappings)
    .filter(([, range]) => 
      range.dsl_range && cursorOffset >= range.dsl_range[0] && cursorOffset < range.dsl_range[1]
    )
    .map(([dslPath, range]) => ({ dslPath, range }));

  if (containingRanges.length === 0) {
    return null;
  }

  // Sort by range size (smallest first) to get the most specific match
  // In case of ties, prefer the one that starts later (more specific)
  containingRanges.sort((a, b) => {
    const sizeA = a.range.dsl_range![1] - a.range.dsl_range![0];
    const sizeB = b.range.dsl_range![1] - b.range.dsl_range![0];
    if (sizeA === sizeB) {
      return b.range.dsl_range![0] - a.range.dsl_range![0]; // Later start is more specific
    }
    return sizeA - sizeB; // Smaller size is more specific
  });

  let selectedPath = containingRanges[0].dslPath;

  // If the selected path points to an entity_type, decide whether to point to its first item
  // based on the entity_quantity and MAX_ITEM_DISPLAY threshold
  {
    const lastSlash = selectedPath.lastIndexOf('/');
    const lastSegment = lastSlash >= 0 ? selectedPath.slice(lastSlash + 1) : selectedPath;

    const isEntityTypeSegment = (() => {
      if (lastSegment === 'entity_type') return true;
      if (!lastSegment.startsWith('entity_type[') || !lastSegment.endsWith(']')) return false;
      const idx = lastSegment.indexOf('[');
      const inside = lastSegment.slice(idx + 1, -1);
      return inside.length > 0 && inside.split('').every((ch) => ch >= '0' && ch <= '9');
    })();

    if (isEntityTypeSegment) {
      const containerPath = lastSlash >= 0 ? selectedPath.slice(0, lastSlash) : '';
      const quantityPath = (containerPath ? containerPath : '') + '/entity_quantity';
      const quantityVal = componentMappings[quantityPath]?.property_value;
      const quantity = quantityVal !== undefined ? Number(quantityVal) : NaN;

      if (!Number.isNaN(quantity) && quantity <= MAX_ITEM_DISPLAY) {
        // Use first item index for single-icon representation
        const hasIndex = lastSegment !== 'entity_type' && lastSegment.endsWith(']');
        if (!hasIndex) {
          selectedPath = `${selectedPath}[0]`;
        }
      }
    }
  }
  return selectedPath;
}

/**
 * Print formatted tree structure
 */
export function printDSLTreeFormatted(componentMappings: ComponentMapping): string {
  // Sort mappings by start position for tree-like output
  const sortedMappings = Object.entries(componentMappings)
    .filter(([, range]) => range.dsl_range)
    .map(([dslPath, range]) => ({ dslPath, range }))
    .sort((a, b) => a.range.dsl_range![0] - b.range.dsl_range![0]);
  
  let result = '';
  for (const mapping of sortedMappings) {
    // Derive display hint from the path suffix
    let hint = '';
    if (mapping.dslPath.endsWith('/operation') || mapping.dslPath === 'operation') {
      hint = '(op)';
    } else if (/\/entities\[\d+\]$/.test(mapping.dslPath)) {
      hint = '[entity]';
    } else if (/\/(entity_name|entity_type|entity_quantity|container_name|container_type|attr_name|attr_type)(\[\d+\])?$/.test(mapping.dslPath)) {
      hint = '"prop"';
    }

    const pathDepth = mapping.dslPath.split('/').length - 1;
    const nodeIndent = '  '.repeat(pathDepth);
    result += `${nodeIndent}${mapping.dslPath} ${hint} [${mapping.range.dsl_range![0]}-${mapping.range.dsl_range![1]}]`;
    result += '\n';
  }
  
  return result;
}