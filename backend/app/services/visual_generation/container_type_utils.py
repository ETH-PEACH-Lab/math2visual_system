"""
Shared utility functions for container type modifications in visual generators.
"""
from collections import defaultdict


def update_container_types_optimized(entities, result_entities):
    """
    Update the container_type for entities in the same group (by container_type)
    when there is more than one unique container_name. In addition, treat the last
    item of result_entities as one of the entities (by reference) so that its
    container_type is updated if necessary.
    
    If there is only one unique container_name for a given container_type,
    leave it unchanged. Otherwise, assign a unique container_type value for each
    container_name within that group.
    
    This function is used by both formal and intuitive visual generators to ensure
    consistent icon selection when multiple containers share the same type but have
    different names.
    
    Parameters:
    entities (list): List of entity dictionaries.
    result_entities (list): List of result entity dictionaries.
        If non-empty, the last item will be processed along with entities.
    
    Returns:
    A tuple (entities, result_entities) where:
        - entities: the original list (with updated container_type values)
        - result_entities: the modified list (the last item updated as needed)
    """
    # Create a temporary combined list from entities.
    combined = entities[:]  # shallow copy; dictionary objects remain the same
    if result_entities:
        # Append the last result entity (by reference) to combined.
        combined.append(result_entities[-1])
    
    # Group combined items by the original container_type.
    entity_type_to_entities = defaultdict(list)
    for entity in combined:
        entity_type_to_entities[entity['container_type']].append(entity)
    
    # Iterate through each container_type group.
    for container_type, group in entity_type_to_entities.items():
        # Group further by container_name.
        name_to_entities = defaultdict(list)
        for entity in group:
            name_to_entities[entity['container_name']].append(entity)
        
        # If there is only one unique container_name in this group, nothing to change.
        if len(name_to_entities) <= 1:
            continue
        
        # Initialize modification index.
        modification_index = 1  # for the first unique container_name, leave container_type unchanged.
        
        # Iterate through unique container_name groups in insertion order.
        for name, ent_group in name_to_entities.items():
            if modification_index == 1:
                # Use the original container_type for the first group.
                new_entity_type = container_type
            else:
                new_entity_type = container_type + "-" + str(modification_index)
            # Set the container_type for all entities in this group.
            for entity in ent_group:
                entity['container_type'] = new_entity_type
            modification_index += 1

    return entities, result_entities

