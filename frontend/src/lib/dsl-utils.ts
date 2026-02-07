import type { ParsedOperation, ParsedEntity } from '@/utils/dsl-parser';
import { replaceEntityNames, replaceQuantities, replaceContainerNames } from '@/utils/mwpUtils';

/**
 * DSL parsing and MWP text update utilities
 * Handles bidirectional synchronization between DSL and MWP text
 */

export interface EntityInfo {
  entityName: string;
  entityQuantity: number;
  entityType: string;
  containerName: string;
  dslPath: string;
}

export interface DSLChange {
  type: 'entity_name' | 'entity_quantity' | 'entity_type' | 'container_name';
  oldValue: string;
  newValue: string;
  entityPath: string;
}

/**
 * Parse DSL object to extract entity information (supports nested structures)
 */
export function parseDSLEntities(parsedDSL: ParsedOperation): EntityInfo[] {
  const entities: EntityInfo[] = [];
  
  try {
    // Recursively extract entities from the parsed DSL object
    extractEntitiesRecursive(parsedDSL, entities);
  } catch (error) {
    console.warn('Failed to parse DSL entities:', error);
  }
  
  return entities;
}

/**
 * Recursively extract entities from parsed DSL structure
 */
function extractEntitiesRecursive(operation: ParsedOperation, entities: EntityInfo[], parentPath: string = ''): void {
  const operationPath = parentPath ? `${parentPath}/operation` : 'operation';
  
  // Process all entities in this operation
  if (!operation.entities || !Array.isArray(operation.entities)) {
    console.warn('Operation entities is not an array:', operation);
    return;
  }
  
  operation.entities.forEach((entity, index) => {
    const entityPath = `${operationPath}/entities[${index}]`;
    
    if ('operation' in entity) {
      // This is a nested operation, recurse
      extractEntitiesRecursive(entity as ParsedOperation, entities, entityPath);
    } else {
      // This is a regular entity
      const parsedEntity = entity as ParsedEntity;
      const entityInfo = extractEntityInfo(parsedEntity, entityPath);
      if (entityInfo) {
        entities.push(entityInfo);
      }
    }
  });
  
  // Process result container if it exists
  if (operation.result_container) {
    const resultPath = `${operationPath}/result_container`;
    const entityInfo = extractEntityInfo(operation.result_container, resultPath);
    if (entityInfo) {
      entities.push(entityInfo);
    }
  }
}

/**
 * Extract entity information from a ParsedEntity
 */
function extractEntityInfo(entity: ParsedEntity, dslPath: string): EntityInfo | null {
  try {
    // Get entity name - try multiple possible locations
    const entityName = entity.entity_name || entity.name || '';
    
    // Get entity quantity - try multiple possible locations
    const entityQuantity = entity.entity_quantity || entity.item?.entity_quantity || 0;
    
    // Get entity type - try multiple possible locations
    const entityType = entity.entity_type || entity.item?.entity_type || '';
    
    // Get container name
    const containerName = entity.container_name || '';
    
    if (entityName) {
      return {
        entityName,
        entityQuantity,
        entityType,
        containerName,
        dslPath,
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to extract entity info:', entity, error);
    return null;
  }
}


/**
 * Detect changes between old and new parsed DSL objects (supports nested structures)
 */
export function detectDSLChanges(oldParsedDSL: ParsedOperation, newParsedDSL: ParsedOperation): DSLChange[] {
  const oldEntities = parseDSLEntities(oldParsedDSL);
  const newEntities = parseDSLEntities(newParsedDSL);
  const changes: DSLChange[] = [];
  
  // Check for changes in existing entities
  oldEntities.forEach(oldEntity => {
    const newEntity = newEntities.find(e => e.dslPath === oldEntity.dslPath);
    if (newEntity) {
      const fields: Array<{ type: DSLChange['type']; oldVal: unknown; newVal: unknown; stringify?: boolean }>= [
        { type: 'entity_name', oldVal: oldEntity.entityName, newVal: newEntity.entityName },
        { type: 'entity_quantity', oldVal: oldEntity.entityQuantity, newVal: newEntity.entityQuantity, stringify: true },
        { type: 'entity_type', oldVal: oldEntity.entityType, newVal: newEntity.entityType },
        { type: 'container_name', oldVal: oldEntity.containerName, newVal: newEntity.containerName },
      ];

      fields.forEach(({ type, oldVal, newVal, stringify }) => {
        if (oldVal !== newVal) {
          changes.push({
            type,
            oldValue: stringify ? String(oldVal) : String(oldVal ?? ''),
            newValue: stringify ? String(newVal) : String(newVal ?? ''),
            entityPath: oldEntity.dslPath,
          });
        }
      });
    }
  });
  
  return changes;
}

/**
 * Update MWP text and optional formula based on DSL changes
 * Formula is only updated based on entity_quantity changes
 * @param mwpText - The MWP text to update
 * @param formula - The formula to update (optional)
 * @param changes - Array of DSL changes to apply
 * @param language - Language code for pluralization (default: 'en')
 */
export function updateMWPInput(
  mwpText: string, 
  formula: string | null | undefined, 
  changes: DSLChange[],
  language: string = 'en'
): { mwp: string; formula: string | null | undefined } {
  let updatedMWP = mwpText;
  let updatedFormula = formula;
  
  const handlers: Record<DSLChange["type"], (t: string, o: string, n: string) => string> = {
    entity_name: (t, o, n) => replaceEntityNames(t, o, n, language),
    entity_type: (t) => t, // entity_type changes should not update MWP text
    entity_quantity: (t, o, n) => replaceQuantities(t, o, n, language),
    container_name: (t, o, n) => replaceContainerNames(t, o, n),
  };

  // Filter out changes where newValue is empty (deletion) - don't update text for deletions
  const changesToApply = changes.filter(({ newValue }) => newValue);

  // Update MWP text with all changes
  changesToApply.forEach(({ type, oldValue, newValue }) => {
    updatedMWP = handlers[type](updatedMWP, oldValue, newValue);
  });
  
  // Update formula only with entity_quantity changes
  if (updatedFormula) {
    const quantityChanges = changesToApply.filter(({ type }) => type === 'entity_quantity');
    quantityChanges.forEach(({ oldValue, newValue }) => {
      updatedFormula = replaceQuantities(updatedFormula!, oldValue, newValue, language);
    });
  }
  
  return { mwp: updatedMWP, formula: updatedFormula };
}


/**
 * Sanitize entity name by removing all non-letter and non-whitespace characters
 * Used for name: fields which should only contain letters and whitespace
 * Converts underscores and dashes to spaces for better readability
 */
export function sanitizeEntityName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')  // Replace underscores and dashes with spaces
    .replace(/[^a-zA-Z\s]/g, '')  // Remove all other non-letter and non-whitespace characters
    .replace(/\s+/g, ' ')  // Collapse multiple spaces into one
    .trim();
}

// Replace "type: ${oldValue}" with "type: ${newValue}"
export function replaceEntityTypeInDSL(dsl: string, oldType: string, newType: string): string {
  if (!dsl || !oldType || !newType) {
    return dsl;
  }

  const typePattern = new RegExp(`(type:\\s*)\\b${oldType}\\b`, 'g');
  const typeReplaced = dsl.replace(typePattern, `$1${newType}`);
  if (typeReplaced !== dsl) {
    return typeReplaced;
  } else{
    throw new Error(`Could not find '${oldType}' in DSL`);
  }
}

/**
 * Replace <value containing sanitizedOldType>", replaces entire value with "name: ${sanitizedNewValue}" (letters and spaces only)
 */
export function replaceNameForEntityTypeInDSL(dsl: string, sanitizedOldType: string, sanitizedNewType: string): string {
  if (!dsl || !sanitizedOldType || !sanitizedNewType) {
    return dsl;
  }

  const namePattern = new RegExp(`(name:\\s*)[^,]*\\b${sanitizedOldType}\\b[^,]*(,)`, 'g');
  const nameReplaced = dsl.replace(namePattern, `$1${sanitizedNewType}$2`);
  if (nameReplaced !== dsl) {
    return nameReplaced;
  }
}

