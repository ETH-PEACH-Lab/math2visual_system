"""
Utility functions for applying container type modifications to DSL.
This ensures consistent icon selection when extracting DSL snippets.
"""
import logging
from typing import Dict, List, Any

from app.services.visual_generation.dsl_parser import DSLParser
from app.services.visual_generation.container_type_utils import update_container_types_optimized

logger = logging.getLogger(__name__)


def extract_operations_and_entities(node: Dict, entities: List[Dict] = None, 
                                    result_entities: List[Dict] = None,
                                    parent_op: str = None,
                                    current_path: str = "") -> tuple:
    """
    Extract entity references from a parsed DSL node.
    We collect references (not copies) so modifications apply to the original structure.
    
    Parameters:
    node: Parsed DSL node (dict with operation, entities, result_container)
    entities: Accumulator for entity references (will be modified in place)
    result_entities: Accumulator for result entity references (will be modified in place)
    parent_op: Parent operation name (for recursion)
    current_path: Current DSL path (for recursion)
    
    Returns:
    Tuple of (entities, result_entities)
    """
    if entities is None:
        entities = []
    if result_entities is None:
        result_entities = []
    
    op = node.get("operation", "")
    
    # Handle special operations
    if op == "unittrans":
        sub_ents = node.get("entities", [])
        if len(sub_ents) == 2:
            # For unittrans, we append the main entity directly (reference)
            entities.append(sub_ents[0])
        return entities, result_entities
    
    if op == "comparison":
        # For comparison, recursively extract from nested operations
        child_ents = node.get("entities", [])
        my_result = node.get("result_container")
        
        for child in child_ents:
            if "operation" in child:
                extract_operations_and_entities(child, entities, result_entities, op, current_path)
            else:
                entities.append(child)  # Reference, not copy
        
        if my_result and isinstance(my_result, dict):
            result_entities.append(my_result)  # Reference, not copy
        
        return entities, result_entities
    
    child_ents = node.get("entities", [])
    my_result = node.get("result_container")
    
    # Identity handling
    if op == "identity":
        if child_ents:
            entities.append(child_ents[0])  # Reference, not copy
        return entities, result_entities
    
    if len(child_ents) < 2:
        return entities, result_entities
    
    left_child = child_ents[0]
    right_child = child_ents[1]
    
    operation_path = f"{current_path}/operation" if current_path else "operation"
    
    # Handle left child - append reference directly
    if "operation" in left_child:
        left_path = f"{operation_path}/entities[0]"
        extract_operations_and_entities(left_child, entities, result_entities, op, left_path)
    else:
        entities.append(left_child)  # Reference, not copy
    
    # Handle right child - append reference directly
    if "operation" in right_child:
        right_path = f"{operation_path}/entities[1]"
        extract_operations_and_entities(right_child, entities, result_entities, op, right_path)
    else:
        entities.append(right_child)  # Reference, not copy
    
    # Add result container if at top level only (matches generator behavior)
    if parent_op is None and my_result:
        if isinstance(my_result, dict):
            result_entities.append(my_result)  # Reference, not copy
    
    return entities, result_entities


def serialize_entity(entity: Dict) -> str:
    """
    Serialize a single entity dictionary back to DSL format.
    Example: container1[entity_name: orange, entity_type: orange, ...]
    """
    entity_name = entity.get("name", "container1")
    parts = []
    
    # Add entity properties in order
    # Note: entity_name is stored at top level, entity_type and entity_quantity are in "item"
    prop_order = [
        ("entity_name", entity.get("entity_name")),
        ("entity_type", entity.get("item", {}).get("entity_type")),
        ("entity_quantity", entity.get("item", {}).get("entity_quantity")),
        ("container_name", entity.get("container_name")),
        ("container_type", entity.get("container_type")),
        ("attr_name", entity.get("attr_name")),
        ("attr_type", entity.get("attr_type")),
    ]
    
    for key, value in prop_order:
        if value is not None and value != "":
            if isinstance(value, float):
                # Format floats without unnecessary decimals
                if value.is_integer():
                    parts.append(f"{key}: {int(value)}")
                else:
                    parts.append(f"{key}: {value}")
            else:
                parts.append(f"{key}: {value}")
    
    return f"{entity_name}[{', '.join(parts)}]"


def serialize_dsl(node: Dict) -> str:
    """
    Serialize a parsed DSL node back to DSL string format.
    
    Parameters:
    node: Parsed DSL node (dict with operation, entities, result_container)
    
    Returns:
    DSL string representation
    """
    op = node.get("operation", "")
    entities_list = node.get("entities", [])
    result_container = node.get("result_container")
    
    parts = []
    
    # Serialize entities (which may be nested operations or entities)
    for entity in entities_list:
        if "operation" in entity:
            # This is a nested operation
            parts.append(serialize_dsl(entity))
        else:
            # This is a regular entity
            parts.append(serialize_entity(entity))
    
    # Add result container if present
    if result_container and isinstance(result_container, dict):
        # Create a copy with name set to result_container
        result_entity = dict(result_container)
        result_entity["name"] = "result_container"
        parts.append(serialize_entity(result_entity))
    
    return f"{op}({', '.join(parts)})"


def apply_container_type_modifications(dsl_str: str) -> str:
    """
    Parse DSL, apply container type modifications, and serialize back to DSL string.
    
    This function ensures that when DSL snippets are extracted by the tutor,
    they will have consistent container types (e.g., "girl-1", "girl-2") that
    match the full DSL rendering, ensuring consistent icon selection.
    
    Parameters:
    dsl_str: DSL string to process
    
    Returns:
    Modified DSL string with container types updated
    """
    if not dsl_str or not dsl_str.strip():
        return dsl_str
    
    try:
        # Parse the DSL
        parser = DSLParser()
        parsed = parser.parse_dsl(dsl_str)
        
        # Extract entity references (not copies) so modifications apply directly to parsed structure
        entities = []
        result_entities = []
        extract_operations_and_entities(parsed, entities, result_entities)
        
        # Apply container type modifications - this modifies entities in-place since they're references
        # Note: We only extract top-level result containers (matching generator extraction behavior).
        # The function will include the last result_entity in the differentiation logic, just like the generators do.
        update_container_types_optimized(entities, result_entities)
        
        # The parsed structure is already modified! Just serialize it back
        return serialize_dsl(parsed)
        
    except Exception as e:
        logger.warning(f"Failed to apply container type modifications to DSL: {e}. Returning original DSL.")
        return dsl_str

