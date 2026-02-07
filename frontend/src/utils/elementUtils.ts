/**
 * Utility functions for SVG element type detection and classification
 */

/**
 * Check if an element is a text element
 * @param el - The element to check
 * @returns true if the element is a text element
 */
export const isTextElement = (el: Element): boolean => {
  return el.tagName.toLowerCase() === 'text';
};

/**
 * Check if an element is a box element (rectangle)
 * @param el - The element to check
 * @returns true if the element is a box element
 */
export const isBoxElement = (el: Element): boolean => {
  const tag = el.tagName.toLowerCase();
  if (tag !== 'rect') return false;
  
  // Exclude result containers from being treated as regular boxes
  const path = (el as SVGElement).getAttribute('data-dsl-path') || '';
  return !path.endsWith('result_container');
};

/**
 * Check if an element is an embedded SVG element (entity_type)
 * @param el - The element to check
 * @returns true if the element is an embedded SVG element
 */
export const isEmbeddedSvgElement = (el: Element): boolean => {
  return el.tagName.toLowerCase() === 'svg';
};

/**
 * Check if an element is a container name text element (container_name)
 * @param el - The element to check
 * @returns true if the element is a container name text element
 */
export const isContainerNameElement = (el: Element): boolean => {
  const tag = el.tagName.toLowerCase();
  if (tag !== 'text') return false;
  
  const path = (el as SVGElement).getAttribute('data-dsl-path') || '';
  return path.includes('/container_name');
};

/**
 * Check if an element is an attribute name text element (attr_name)
 * @param el - The element to check
 * @returns true if the element is an attribute name text element
 */
export const isAttrNameElement = (el: Element): boolean => {
  const tag = el.tagName.toLowerCase();
  if (tag !== 'text') return false;
  
  const path = (el as SVGElement).getAttribute('data-dsl-path') || '';
  return path.includes('/attr_name');
};
