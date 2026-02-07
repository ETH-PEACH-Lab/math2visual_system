/**
 * DSL parser (extracted) - parses a DSL string into a simple JS structure.
 * Note: Types are intentionally minimal to avoid circular deps; 
 * callers can cast to their local types if needed.
 */

export interface ParsedEntity {
  name: string;
  _dsl_path?: string;
  item?: { entity_quantity?: number; entity_type?: string };
  entity_name?: string;
  entity_type?: string;
  entity_quantity?: number;
  container_name?: string;
  container_type?: string;
  attr_name?: string;
  attr_type?: string;
}

export interface ParsedOperation {
  operation: string;
  entities: ParsedEntity[] | ParsedOperation[];
  result_container?: ParsedEntity;
}

const OPERATIONS_LIST = [
  'addition', 'subtraction', 'multiplication', 'division',
  'surplus', 'unittrans', 'area', 'comparison'
];

function splitEntities(insideStr: string): string[] {
  const entities: string[] = [];
  let balanceParen = 0;
  let balanceBracket = 0;
  let buffer = '';

  for (const char of insideStr) {
    if (char === '(') balanceParen++;
    else if (char === ')') balanceParen--;
    else if (char === '[') balanceBracket++;
    else if (char === ']') balanceBracket--;

    if (char === ',' && balanceParen === 0 && balanceBracket === 0) {
      if (buffer.trim()) entities.push(buffer.trim());
      buffer = '';
    } else {
      buffer += char;
    }
  }

  if (buffer.trim()) entities.push(buffer.trim());
  return entities;
}

function parseEntity(entity: string): ParsedEntity {
  const entityPattern = /^(\w+)\[(.*?)\]$/;
  const entityMatch = entity.match(entityPattern);

  if (!entityMatch) {
    throw new Error(`Entity format is incorrect: ${entity}`);
  }

  const [, entityName, entityContent] = entityMatch;
  const parts = entityContent.split(',').map(p => p.trim());
  const entityDict: ParsedEntity = { name: entityName, item: {} };

  for (const part of parts) {
    if (part.includes(':')) {
      const [keyRaw, valRaw] = part.split(':', 2);
      const key = keyRaw.trim();
      const val = valRaw.trim();
      if (key === 'entity_quantity') {
        try {
          const numVal = val.includes('.') ? parseFloat(val) : parseInt(val, 10);
          entityDict.item!.entity_quantity = numVal;
        } catch {
          entityDict.item!.entity_quantity = 0;
        }
      } else if (key === 'entity_type') {
        entityDict.item!.entity_type = val;
      } else {
        (entityDict as unknown as { [key: string]: string })[key] = val;
      }
    }
  }

  return entityDict;
}

/**
 * Normalize DSL string to single line for consistent parsing
 */
function normalizeDSLToSingleLine(dslStr: string): string {
  return dslStr
    .replace(/\n/g, ' ')         // Replace newlines with spaces
    .replace(/\r/g, ' ')         // Replace carriage returns
    .replace(/\t/g, ' ')         // Replace tabs
    .replace(/  +/g, ' ')        // Collapse multiple spaces
    .replace(/ ,/g, ',')         // Remove space before commas
    .replace(/, /g, ',')         // Remove space after commas  
    .replace(/ \[/g, '[')        // Remove space before brackets
    .replace(/\[ /g, '[')        // Remove space after opening bracket
    .replace(/ \]/g, ']')        // Remove space before closing bracket
    .replace(/\] /g, ']')        // Remove space after closing bracket
    .replace(/ \(/g, '(')        // Remove space before parentheses
    .replace(/\( /g, '(')        // Remove space after opening parenthesis
    .replace(/ \)/g, ')')        // Remove space before closing parenthesis
    .replace(/\) /g, ')')        // Remove space after closing parenthesis
    .replace(/ :/g, ':')         // Remove space before colons
    .replace(/: /g, ':')         // Remove space after colons
    .trim();
}

/**
 * Safely parse DSL string with error handling
 */
export function parseWithErrorHandling(dslStr: string): ParsedOperation | null {
  try {
    return parseDSL(normalizeDSLToSingleLine(dslStr));
  } catch (error) {
    console.error('Failed to parse DSL:', error);
    return null;
  }
}

export function parseDSL(dslStr: string, currentPath: string = ''): ParsedOperation {
  const normalized = dslStr.trim().replace(/\s+/g, ' ');
  const funcPattern = /^(\w+)\s*\((.*)\)$/;
  const match = normalized.match(funcPattern);

  if (!match) {
    throw new Error(`DSL does not match the expected pattern: ${normalized}`);
  }

  const [, operation, inside] = match;
  const parsedEntities: Array<ParsedEntity | ParsedOperation> = [];
  let resultContainer: ParsedEntity | undefined;

  const operationPath = currentPath ? `${currentPath}/operation` : 'operation';
  const entities = splitEntities(inside);
  entities.forEach((entity, i) => {
    const entityPath = `${operationPath}/entities[${i}]`;
    if (OPERATIONS_LIST.some(op => entity.trimStart().startsWith(op + '('))) {
      const nested = parseDSL(entity, entityPath);
      parsedEntities.push(nested);
    } else {
      const entityDict = parseEntity(entity);
      entityDict._dsl_path = entityPath;
      if (entityDict.name === 'result_container') {
        entityDict._dsl_path = `${operationPath}/result_container`;
        resultContainer = entityDict;
      } else {
        parsedEntities.push(entityDict);
      }
    }
  });

  return {
    operation,
    entities: parsedEntities as ParsedEntity[] | ParsedOperation[],
    result_container: resultContainer
  };
}


