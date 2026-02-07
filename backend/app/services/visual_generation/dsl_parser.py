import re


class DSLParser:
    """
    Shared DSL parsing functionality for both formal and intuitive visual generators.
    
    This class provides a unified interface for parsing Math2Visual DSL strings
    into structured data that can be used by both visual generators.
    """
    
    def __init__(self):
        self.operations_list = ["addition", "subtraction", "multiplication", "division", "surplus", "unittrans", "area", "comparison", "identity"]
    
    def parse_dsl(self, dsl_str):
        """
        Parse a DSL string into a structured data format.
        
        Args:
            dsl_str (str): The DSL string to parse
            
        Returns:
            dict: Structured data containing operation, entities, and result_container
            
        Raises:
            ValueError: If the DSL format is invalid
        """
        cleaned = " ".join(dsl_str.strip().split())

        # Accept a bare entity as an identity operation (single-container visualization)
        bare_entity_pattern = r"^\w+\s*\[.*\]$"
        if re.match(bare_entity_pattern, cleaned):
            entity_dict, is_result = self._parse_entity_token(cleaned)
            result = {"operation": "identity", "entities": []}
            if is_result:
                result["result_container"] = entity_dict
            else:
                result["entities"].append(entity_dict)
            # If the only thing provided is a result_container, treat it as the entity
            if not result["entities"] and result.get("result_container"):
                result["entities"].append(result.pop("result_container"))
            return result

        return self._recursive_parse(cleaned)

    def _parse_entity_token(self, entity: str):
        """
        Parse an entity token like `container1[...]` into a dict.
        """
        entity_pattern = r"(\w+)\[(.*?)\]"
        entity_match = re.match(entity_pattern, entity)
        if not entity_match:
            raise ValueError(f"Entity format is incorrect: {entity}")
        entity_name, entity_content = entity_match.groups()
        parts = [p.strip() for p in entity_content.split(',')]
        entity_dict = {"name": entity_name, "item": {}}
        for part in parts:
            if ':' in part:
                key, val = part.split(':', 1)
                key, val = key.strip(), val.strip()
                if key == "entity_quantity":
                    try:
                        entity_dict["item"]["entity_quantity"] = float(val)
                    except ValueError:
                        entity_dict["item"]["entity_quantity"] = 0.0  # Default to 0.0 if conversion fails
                elif key == "entity_type":
                    entity_dict["item"]["entity_type"] = val
                else:
                    entity_dict[key] = val

        return entity_dict, entity_name == "result_container"
    
    def _split_entities(self, inside_str):
        """
        Safely splits entities or nested operations while balancing parentheses and square brackets.
        
        Args:
            inside_str (str): The content inside parentheses to split
            
        Returns:
            list: List of entity strings
        """
        entities = []
        balance_paren = 0
        balance_bracket = 0
        buffer = ""

        for char in inside_str:
            if char == "(":
                balance_paren += 1
            elif char == ")":
                balance_paren -= 1
            elif char == "[":
                balance_bracket += 1
            elif char == "]":
                balance_bracket -= 1

            if char == "," and balance_paren == 0 and balance_bracket == 0:
                entities.append(buffer.strip())
                buffer = ""
            else:
                buffer += char

        if buffer:
            entities.append(buffer.strip())

        return entities
    
    def _recursive_parse(self, input_str):
        """
        Recursively parses operations and entities.
        
        Args:
            input_str (str): The DSL string to parse
            
        Returns:
            dict: Structured data with operation, entities, and result_container
            
        Raises:
            ValueError: If the DSL format is invalid
        """
        input_str = " ".join(input_str.strip().split())  # Clean spaces
        func_pattern = r"(\w+)\s*\((.*)\)"
        match = re.match(func_pattern, input_str)

        if not match:
            raise ValueError(f"DSL does not match the expected pattern: {input_str}")

        operation, inside = match.groups()  # Extract operation and content
        parsed_entities = []
        result_container = None

        # Safely split entities
        for entity in self._split_entities(inside):
            if any(entity.startswith(op) for op in self.operations_list):
                # Recognize and recurse into nested operations
                parsed_entities.append(self._recursive_parse(entity))
            else:
                entity_dict, is_result = self._parse_entity_token(entity)
                if is_result:
                    result_container = entity_dict
                else:
                    parsed_entities.append(entity_dict)

        result = {"operation": operation, "entities": parsed_entities}
        if result_container:
            result["result_container"] = result_container

        return result
