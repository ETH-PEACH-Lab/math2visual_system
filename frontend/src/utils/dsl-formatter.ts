/**
 * DSL Formatter Utility - Complete implementation
 * Handles DSL parsing, formatting and range calculation for component mappings
 */
import { parseDSL as parse, type ParsedEntity, type ParsedOperation } from '@/utils/dsl-parser';

// Type aliases for consistency
export type DSLEntity = ParsedEntity;
export type DSLOperation = ParsedOperation;

export interface ComponentRange {
  dsl_range: [number, number];
  property_value?: string;
}

export interface ComponentMapping {
  [dslPath: string]: ComponentRange;
}

export class DSLFormatter {
  public componentRegistry: ComponentMapping = {};

  /**
   * Track component metadata for frontend mapping
   */
  trackComponent(dslPath: string, dslRange: [number, number], propertyValue?: string | number): void {
    const entry: ComponentRange = { dsl_range: dslRange };
    if (propertyValue !== undefined) {
      entry.property_value = String(propertyValue);
    }
    this.componentRegistry[dslPath] = entry;
  }

  /**
   * Format DSL and calculate ranges for all hierarchical paths
   */
  formatWithRanges(parsedDSL: DSLOperation): string {
    // Clear component registry for new formatting
    this.componentRegistry = {};

    // Format the DSL and compute ranges simultaneously during formatting
    const [formattedDSL] = this.formatWithRangesRecursive(parsedDSL, 0, '', 0);
    return formattedDSL;
  }

  /**
   * Format DSL while tracking ranges during formatting process
   */
  private formatWithRangesRecursive(
    node: ParsedOperation | ParsedEntity,
    indentLevel: number,
    parentPath: string,
    currentPos: number
  ): [string, number] {
    const indent = '  '.repeat(indentLevel);

    if ('operation' in node) {
      // This is an operation node
      const operation = node.operation;
      const currentPath = parentPath ? `${parentPath}/operation` : 'operation';

      // Start building the operation
      const operationStart = `${indent}${operation}(`;
      const operationRangeStart = currentPos + indent.length; // Position of operation name
      let pos = currentPos + operationStart.length;

      // Collect all children
      const childrenParts: string[] = [];
      const childrenPositions: number[] = [];

      // Process entity children (operation or container)
      for (let i = 0; i < node.entities.length; i++) {
        const entity = node.entities[i];
        const entityPath = `${currentPath}/entities[${i}]`;
        const childOffset = i === 0 ? 1 : 0; // +1 for newline after first "operation("

        let childFormatted: string;
        let endPos: number;
        if ('operation' in entity) {
          // Nested operation
          [childFormatted, endPos] = this.formatWithRangesRecursive(
            entity as ParsedOperation,
            indentLevel + 1,
            entityPath,
            pos + childOffset
          );
        } else {
          // Container entity
          [childFormatted, endPos] = this.formatContainerWithRanges(
            entity,
            indentLevel + 1,
            entityPath,
            pos + childOffset
          );
        }

        childrenParts.push(childFormatted);
        childrenPositions.push(endPos);
        pos = endPos + 2; // +2 for ",\n"
      }

      // Process result container if present
      if (node.result_container) {
        const resultPath = `${currentPath}/result_container`;
        const [resultFormatted, endPos] = this.formatContainerWithRanges(
          node.result_container,
          indentLevel + 1,
          resultPath,
          pos
        );
        childrenParts.push(resultFormatted);
        childrenPositions.push(endPos);
        pos = endPos;
      }

      // Build the complete operation
      let formatted: string;
      let finalPos: number;

      if (childrenParts.length === 0) {
        formatted = `${indent}${operation}()`;
        finalPos = currentPos + formatted.length;
      } else {
        const childrenStr = childrenParts.join(',\n');
        formatted = `${indent}${operation}(\n${childrenStr}\n${indent})`;
        finalPos = currentPos + formatted.length;
      }

      // Track only the operation name range (not the entire block)
      const operationRangeEnd = operationRangeStart + operation.length;
      this.trackComponent(currentPath, [operationRangeStart, operationRangeEnd], operation);

      return [formatted, finalPos];
    } else {
      // This is a container (root level)
      return this.formatContainerWithRanges(node, indentLevel, parentPath, currentPos);
    }
  }

  /**
   * Format a container while tracking ranges during formatting
   */
  private formatContainerWithRanges(
    container: ParsedEntity,
    indentLevel: number,
    containerPath: string,
    currentPos: number
  ): [string, number] {
    const indent = '  '.repeat(indentLevel);
    const containerName = container.name || 'container';

    // Set the DSL path on the container for SVG generation
    container._dsl_path = containerPath;

    // Container starts at current position + indent
    const containerStart = currentPos + indent.length;

    // Build container opening
    const containerOpening = `${indent}${containerName}[`;
    let pos = currentPos + containerOpening.length + 1; // +1 for newline

    // Format properties and track their ranges
    const properties: string[] = [];
    const propertyOrder = [
      'entity_name', 'entity_type', 'entity_quantity',
      'container_name', 'container_type', 'attr_name', 'attr_type'
    ] as const;

    for (const prop of propertyOrder) {
      const value = this.getContainerPropertyValue(container, prop);

      if (value !== undefined && value !== null) {
        // Format value properly (remove .0 for integers)
        let formattedValue: string;
        if (typeof value === 'number' && Number.isInteger(value)) {
          formattedValue = String(Math.floor(value));
        } else {
          formattedValue = String(value);
        }

        // Build property line
        const propertyLine = `${indent}  ${prop}: ${formattedValue}`;
        properties.push(propertyLine);

        // Calculate property range - from start of property name to end of property value
        const propStart = pos + `${indent}  `.length;
        const propEnd = propStart + prop.length + 2 + formattedValue.length;

        // Track this property
        const propertyPath = `${containerPath}/${prop}`;
        this.trackComponent(propertyPath, [propStart, propEnd], formattedValue);

        // Update position for next property
        pos += propertyLine.length + 2; // +2 for ",\n"
      }
    }

    // Build the complete container
    let formatted: string;
    let containerEnd: number;
    let finalPos: number;

    if (properties.length === 0) {
      formatted = `${indent}${containerName}[]`;
      containerEnd = containerStart + `${containerName}[]`.length;
      finalPos = currentPos + formatted.length;
    } else {
      const propertiesStr = properties.join(',\n');
      formatted = `${indent}${containerName}[\n${propertiesStr}\n${indent}]`;
      containerEnd = currentPos + formatted.length;
      finalPos = currentPos + formatted.length;
    }

    // Track the container range
    this.trackComponent(containerPath, [containerStart, containerEnd]);

    return [formatted, finalPos];
  }

  /**
   * Resolve a property value from a container, handling fallbacks consistently
   */
  private getContainerPropertyValue(
    container: ParsedEntity,
    prop:
      | 'entity_name'
      | 'entity_type'
      | 'entity_quantity'
      | 'container_name'
      | 'container_type'
      | 'attr_name'
      | 'attr_type'
  ): string | number | undefined {
    switch (prop) {
      case 'entity_quantity':
        return container.entity_quantity ?? container.item?.entity_quantity;
      case 'entity_type':
        return container.entity_type ?? container.item?.entity_type;
      case 'entity_name':
        return container.entity_name;
      case 'container_name':
        return container.container_name;
      case 'container_type':
        return container.container_type;
      case 'attr_name':
        return container.attr_name;
      case 'attr_type':
        return container.attr_type;
      default:
        return undefined;
    }
  }

  /**
   * Format DSL string with proper indentation and line breaks (simple version without ranges)
   */
  formatDSL(dslStr: string): string {
    try {
      const parsed = parse(dslStr.trim()) as unknown as DSLOperation;
      return this.formatDSLRecursiveClean(parsed, 0);
    } catch (e) {
      // If formatting fails, return original string
      console.warn('DSL formatting failed:', e);
      return dslStr;
    }
  }

  /**
   * Recursively format DSL nodes with clean logic (no ranges)
   */
  private formatDSLRecursiveClean(node: ParsedOperation | ParsedEntity, indentLevel: number = 0): string {
    const indent = '  '.repeat(indentLevel);

    if ('operation' in node) {
      // This is an operation node
      const operation = node.operation;

      // Collect all child elements
      const children: string[] = [];

      // Add entity children
      for (const entity of node.entities) {
        let childFormatted: string;
        if ('operation' in entity) {
          // Nested operation
          childFormatted = this.formatDSLRecursiveClean(entity, indentLevel + 1);
        } else {
          // Container entity
          childFormatted = this.formatContainerClean(entity, indentLevel + 1);
        }
        children.push(childFormatted);
      }

      // Add result container if present
      if (node.result_container) {
        const resultFormatted = this.formatContainerClean(node.result_container, indentLevel + 1);
        children.push(resultFormatted);
      }

      // Build the operation
      if (children.length === 0) {
        return `${indent}${operation}()`;
      } else {
        const childrenStr = children.join(',\n');
        return `${indent}${operation}(\n${childrenStr}\n${indent})`;
      }
    } else {
      // This is a container
      return this.formatContainerClean(node, indentLevel);
    }
  }

  /**
   * Format a container with proper indentation (no ranges)
   */
  private formatContainerClean(container: ParsedEntity, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);
    const containerName = container.name || 'container';

    // Format properties
    const properties: string[] = [];
    const propertyOrder = [
      'entity_name', 'entity_type', 'entity_quantity',
      'container_name', 'container_type', 'attr_name', 'attr_type'
    ] as const;

    for (const prop of propertyOrder) {
      const value = this.getContainerPropertyValue(container, prop);

      if (value !== undefined && value !== null) {
        // Format numeric values properly (remove .0 for integers)
        let formattedValue: string;
        if (typeof value === 'number' && Number.isInteger(value)) {
          formattedValue = String(Math.floor(value));
        } else {
          formattedValue = String(value);
        }
        properties.push(`${indent}  ${prop}: ${formattedValue}`);
      }
    }

    // Build formatted container
    if (properties.length === 0) {
      return `${indent}${containerName}[]`;
    } else {
      const propertiesStr = properties.join(',\n');
      return `${indent}${containerName}[\n${propertiesStr}\n${indent}]`;
    }
  }

  /**
   * Minify formatted DSL back to single line (for API calls)
   */
  static minify(dslString: string): string {
    return dslString
      .replace(/\s*\n\s*/g, ' ')  // Replace newlines with spaces
      .replace(/\s*,\s*/g, ', ')  // Normalize comma spacing
      .replace(/\s*\[\s*/g, '[')  // Remove spaces around brackets
      .replace(/\s*\]\s*/g, ']')
      .replace(/\s*\(\s*/g, '(')  // Remove spaces around parentheses
      .replace(/\s*\)\s*/g, ')')
      .replace(/\s*:\s*/g, ': ')  // Normalize colon spacing
      .replace(/\s+/g, ' ')       // Collapse multiple spaces
      .trim();
  }


}