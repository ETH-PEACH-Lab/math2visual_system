import re
from lxml import etree
import math
import os
from collections import defaultdict
import difflib
import inflect
import re
import logging
from app.services.visual_generation.container_type_utils import update_container_types_optimized

logger = logging.getLogger(__name__)


class FormalVisualGenerator:

    def __init__(self, translate=None):
        """
        Initialize the formal visual generator.
        
        Args:
            translate: Optional translation function (e.g., Flask-Babel's _() function).
                      If None, messages will not be translated.
        """
        self.error_message = ""
        self._missing_svg_entities = []
        self._svg_directory_cache = {}
        self.p = inflect.engine()
        self._translate = translate if translate else lambda msg, **kwargs: msg

    def get_missing_entities(self):
        """Return a de-duplicated list of missing SVG entity base names (preserve order)."""
        return list(dict.fromkeys(self._missing_svg_entities))

    def get_error_message(self):
        """Return the error message if visual generation failed."""
        return self.error_message if self.error_message else None



    def render_svgs_from_data(self, output_file, resources_path, data):
        NS = "http://www.w3.org/2000/svg"
        svg_root = etree.Element("svg", nsmap={None: NS})

        def get_priority(op_name):
            """
            Returns a numeric priority for an operation name.
            Higher number => higher precedence.
            """
            if op_name in ("multiplication", "division"):
                return 2
            elif op_name in ("addition", "subtraction"):
                return 1
            else:
                # Default or fallback
                return 0

        def can_skip_same_precedence(parent_op, child_op):
            """
            Returns True if we can safely omit parentheses around the child sub-expression
            when the parent_op and child_op have the same precedence.
            - addition is associative
            - multiplication is associative
            - subtraction/division are not
            """
            # For addition: A + (B + C) == (A + B) + C
            # For multiplication: A * (B * C) == (A * B) * C
            # So skip brackets if both are addition or both are multiplication
            if parent_op == "addition" and child_op == "addition":
                return True
            if parent_op == "multiplication" and child_op == "multiplication":
                return True
            return False
        def extract_operations_and_entities(
            node,
            operations=None,
            entities=None,
            result_entities=None,
            parent_op=None,
            parent_container_name=None,
            current_path=""
        ):
            if operations is None:
                operations = []
            if entities is None:
                entities = []
            if result_entities is None:
                result_entities = []

            op = node.get("operation", "")

            # 1) If operation is "unittrans", just handle special logic and return
            if op == "unittrans":
                sub_ents = node.get("entities", [])
                if len(sub_ents) == 2:
                    main_entity = sub_ents[0]
                    unit_entity = sub_ents[1]
                    # Example: store unit conversion info
                    main_entity["unittrans_unit"]  = unit_entity["name"]
                    main_entity["unittrans_value"] = unit_entity["item"]["entity_quantity"]
                    entities.append(main_entity)
                return operations, entities, result_entities

            # 2) "comparison"? If not handled, raise or skip
            if op == "comparison":
                raise ValueError("We do not handle 'comparison' in this snippet")

            # 3) For normal operations (like addition, subtraction, multiplication, division)
            child_ents = node.get("entities", [])
            my_result  = node.get("result_container")

            # --- Identity (single-container) handling ---
            if op == "identity":
                if child_ents:
                    child = child_ents[0]
                    entities.append(child)
                return operations, entities, result_entities

            if len(child_ents) < 2:
                # Not enough children to form an operation—skip
                return operations, entities, result_entities

            left_child  = child_ents[0]
            right_child = child_ents[1]

            # Determine this node's container_name (if any)
            if my_result and isinstance(my_result, dict):
                container_name = my_result.get("container_name")
            else:
                container_name = None

            # Decide if the entire sub-expression needs brackets
            need_brackets = False
            if parent_op is not None:
                parent_priority = get_priority(parent_op)
                current_priority = get_priority(op)

                if parent_priority > current_priority:
                    # Strictly higher priority => definitely bracket
                    need_brackets = True
                elif parent_priority == current_priority:
                    if not can_skip_same_precedence(parent_op, op):
                        need_brackets = True

            # Track how many entities we already had before handling this sub-expression
            start_len = len(entities)

            # Construct operation path for use in child paths
            operation_path = f"{current_path}/operation" if current_path else "operation"

            # --- A) Handle left child ---
            if "operation" in left_child:
                left_path = f"{operation_path}/entities[0]"
                extract_operations_and_entities(
                    left_child,
                    operations,
                    entities,
                    result_entities,
                    parent_op=op,
                    parent_container_name=container_name,
                    current_path=left_path
                )
            else:
                # Leaf entity - add DSL path
                left_child["_dsl_path"] = f"{operation_path}/entities[0]"
                entities.append(left_child)

            # --- B) Record the current operation ---
            operations.append({"entity_type": op, "_dsl_path": operation_path})

            # --- C) Handle right child ---
            if "operation" in right_child:
                right_path = f"{operation_path}/entities[1]"
                extract_operations_and_entities(
                    right_child,
                    operations,
                    entities,
                    result_entities,
                    parent_op=op,
                    parent_container_name=container_name,
                    current_path=right_path
                )
            else:
                # Leaf entity - add DSL path
                right_child["_dsl_path"] = f"{operation_path}/entities[1]"
                entities.append(right_child)

            # --- D) Mark brackets if needed ---
            if need_brackets:
                # The entire sub-expression is in entities[start_len:]
                if len(entities) > start_len:
                    # Mark the first entity with bracket="left"
                    entities[start_len]["bracket"] = "left"
                    # Mark the last entity in this chunk with bracket="right"
                    entities[-1]["bracket"] = "right"

            # --- E) If this is the top-level node (no parent_op), record the result entity ---
            if parent_op is None and my_result:
                if isinstance(my_result, dict):
                    my_result["_dsl_path"] = f"{operation_path}/result_container"
                    result_entities.append(my_result)

            return operations, entities, result_entities

        def extract_operations_and_entities_for_comparison(data, current_path=""):
            """
            Extract two sides (compare1 and compare2) from a top-level comparison.
            We assume data["operation"] == "comparison".
            Returns 6 separate lists:
                compare1_operations, compare1_entities, compare1_result_entities,
                compare2_operations, compare2_entities, compare2_result_entities
            """

            # Make sure data["entities"] exists and has 2 items
            if "entities" not in data or len(data["entities"]) < 2:
                # Malformed data => Return empty
                return [], [], [], [], [], []

            # The first item is compare1, the second is compare2
            compare1_data = data["entities"][0]
            compare2_data = data["entities"][1]

            # We'll parse each side with your original function
            # But that function might return 2 items or 3 items depending on 'unittrans'
            def safe_extract(data_piece, current_path=""):
                ret = extract_operations_and_entities(data_piece, current_path=current_path)
                if len(ret) == 2:
                    # Means it was (operations, entities_list) => no result entities returned
                    ops, ents = ret
                    res = []
                else:
                    # Means it was (operations, entities_list, result_entities_list)
                    ops, ents, res = ret
                return ops, ents, res

            # Construct the base path for entities
            base_path = f"{current_path}/entities" if current_path else "entities"
            
            # 1) Parse compare1 side
            if isinstance(compare1_data, dict) and "operation" in compare1_data:
                compare1_ops, compare1_ents, compare1_res = safe_extract(compare1_data, f"{base_path}[0]")
            else:
                # If it's just a single entity, no operation
                compare1_ops = []
                compare1_data["_dsl_path"] = f"{base_path}[0]"
                compare1_ents = [compare1_data]
                compare1_res = []

            # 2) Parse compare2 side
            if isinstance(compare2_data, dict) and "operation" in compare2_data:
                compare2_ops, compare2_ents, compare2_res = safe_extract(compare2_data, f"{base_path}[1]")
            else:
                compare2_ops = []
                compare2_data["_dsl_path"] = f"{base_path}[1]"
                compare2_ents = [compare2_data]
                compare2_res = []

            # Return 6 separate lists
            return (
                compare1_ops, 
                compare1_ents, 
                compare1_res, 
                compare2_ops, 
                compare2_ents, 
                compare2_res
            )
        

        def handle_comparison(
            compare1_operations, compare1_entities, compare1_result_entities,
            compare2_operations, compare2_entities, compare2_result_entities,
            svg_root,
            resources_path,
            start_x=50,
            start_y=150,
            comparison_dsl_path='operation'):


            # We will store bounding boxes: (x, y, width, height) for each side
            entity_boxes = [None, None]

            # We'll iterate over the two "compare sides"
            comp_op_list = [compare1_operations, compare2_operations]
            comp_entity_list = [compare1_entities, compare2_entities]
            comp_result_container_list = [compare1_result_entities, compare2_result_entities]

            current_x = start_x
            current_y = start_y

            for i in range(2):
                operations_i = comp_op_list[i]
                entities_i = comp_entity_list[i]
                result_i = comp_result_container_list[i]
                svg_width = 0
                svg_height = 0

                try:
                    created, w, h = handle_all_except_comparison(operations_i,
                                    entities_i,
                                    svg_root,
                                    resources_path,
                                    result_i,
                                    start_x=current_x,
                                    start_y=current_y)
                except:
                    created = False
                    logger.error("Error in handle_all_except_comparison exception")
                svg_width, svg_height = int(float(w)), int(float(h))
                entity_boxes[i] = (current_x, current_y, svg_width, svg_height)

                current_x += svg_width + 110  # spacing
            # draw balance scale
            draw_balance_scale(svg_root, entity_boxes, comparison_dsl_path)

            return created, svg_root.attrib["width"], svg_root.attrib["height"]


        def draw_balance_scale(svg_root, entity_boxes, comparison_dsl_path='operation'):
            """
            Draws a balance scale below two figures whose bounding boxes are given
            by entity_boxes = [(x0, y0, w0, h0), (x1, y1, w1, h1)].
            The left plate has the same width as the first figure;
            the right plate has the same width as the second figure.
            The base and vertical stick are centered between both figures.

            Also updates the <svg> width and height so that the new elements are in view.
            """

            # Unpack bounding boxes for the two figures
            left_x,  left_y,  left_w,  left_h  = entity_boxes[0]
            right_x, right_y, right_w, right_h = entity_boxes[1]


            # Define how far below the bottom of the two figures to place the horizontal bar of the scale
            vertical_offset = 0

            # The lowest bottom among the two figures
            bottom_of_figures = max(left_h, right_h)

            # This will be the y-coordinate for the horizontal bar (and top of the vertical stick)
            bar_y = bottom_of_figures + vertical_offset

            # The center x between the two figures (we'll place the base & vertical pole here)
            center_x = ((left_x + left_w) + right_x) / 2.0

            # Create a <g> element to hold all parts of the balance scale with DSL path for comparison operation highlighting
            balance_group = etree.SubElement(svg_root, 'g', id='balance-scale')
            balance_group.set('data-dsl-path', comparison_dsl_path)
            balance_group.set('style', 'pointer-events: all;')

            

            ############################################################################
            

            

            ############################################################################
            # 4) Draw the left plate
            #    - The "top" of the plate is slightly below the bottom of the left figure
            #    - The width of the plate is the same as the width of the left figure
            ############################################################################
            left_plate_top_y =  bottom_of_figures + 10  # 10 px below left figure
            left_plate_left_x = left_x
            left_plate_right_x = left_x + left_w

            # We'll create a path that draws a line across the top, then a small curve back
            curve_offset = 90
            plate_mid_x = (left_plate_left_x + left_plate_right_x) / 2.0
            plate_bottom_y = left_plate_top_y + curve_offset

            # Our path: M L Q Z
            left_plate_path = (
                f"M {left_plate_left_x} {left_plate_top_y} "
                f"L {left_plate_right_x} {left_plate_top_y} "
                f"Q {plate_mid_x} {plate_bottom_y} {left_plate_left_x} {left_plate_top_y} Z"
            )

            etree.SubElement(
                balance_group, 'path',
                d=left_plate_path,
                fill="#f58d42",
                stroke="#f58d42",
                attrib={"stroke-width": "2"}
            )

        
            ############################################################################
            # 5) Draw the right plate
            #    - The top of the plate is slightly below the bottom of the right figure
            #    - The width of the plate is the same as the width of the right figure
            ############################################################################
            right_plate_top_y =  bottom_of_figures + 10
            right_plate_left_x = right_x
            right_plate_right_x = right_x + right_w

            plate_mid_x = (right_plate_left_x + right_plate_right_x) / 2.0
            plate_bottom_y = right_plate_top_y + curve_offset

            right_plate_path = (
                f"M {right_plate_left_x} {right_plate_top_y} "
                f"L {right_plate_right_x} {right_plate_top_y} "
                f"Q {plate_mid_x} {plate_bottom_y} {right_plate_left_x} {right_plate_top_y} Z"
            )

            etree.SubElement(
                balance_group, 'path',
                d=right_plate_path,
                fill="#f58d42",
                stroke="#f58d42",
                attrib={"stroke-width": "2"}
            )

            # The small vertical stick from the bar to the right plate
            right_vertical_plate_stick_width = 5
            right_vertical_plate_stick_height = (right_plate_top_y - bar_y)
            right_vertical_plate_stick_x = (right_x + right_w / 2.0) - (right_vertical_plate_stick_width / 2.0)
            right_vertical_plate_stick_y = bar_y

        

            # 2) Draw the horizontal bar
            ############################################################################
            # Let's make the bar span from just left of the left figure to just right of the right figure
            bar_margin = 20
            horizontal_bar_x = left_x + left_w/2
            horizontal_bar_y = plate_bottom_y - 15
            horizontal_bar_width = right_x + right_w/2 - (left_x + left_w/2)
            horizontal_bar_height = 20

            etree.SubElement(
                balance_group, 'rect',
                x=str(horizontal_bar_x),
                y=str(horizontal_bar_y),  # so it's centered at bar_y
                width=str(horizontal_bar_width),
                height=str(horizontal_bar_height),
                fill='#f58d42'
            )

            ############################################################################
            # 1) Draw the 2 vertical stick to support two plates
            ############################################################################
            # left stick
            vertical_stick_width = 10
            
            # The top of this pole is at bar_y, going downward
            left_vertical_stick_x = horizontal_bar_x
            vertical_stick_y = plate_bottom_y - 50
            vertical_stick_height = horizontal_bar_y - vertical_stick_y
            # vertical_stick_y - horizontal_bar_y

            etree.SubElement(
                balance_group, 'rect',
                x=str(left_vertical_stick_x),
                y=str(vertical_stick_y),
                width=str(vertical_stick_width),
                height=str(vertical_stick_height),
                fill='#f58d42'
            )

            # right stick
            vertical_stick_width = 10
            right_vertical_stick_x = horizontal_bar_x + horizontal_bar_width


            etree.SubElement(
                balance_group, 'rect',
                x=str(right_vertical_stick_x),
                y=str(vertical_stick_y),
                width=str(vertical_stick_width),
                height=str(vertical_stick_height + horizontal_bar_height),
                fill='#f58d42'
            )
            ############################################################################
            # 1) Draw the central stick
            ############################################################################
            # vertical_stick_width = 10
            # vertical_stick_height = 50
            # # The top of this pole is at bar_y, going downward
            # vertical_stick_x = center_x - (vertical_stick_width / 2.0)
            # vertical_stick_y = bar_y - vertical_stick_height
            central_stick_x = horizontal_bar_x + horizontal_bar_width/2
            central_stick_height = 100
            central_stick_width = 20
            etree.SubElement(
                balance_group, 'rect',
                x=str(central_stick_x),
                y=str(horizontal_bar_y),
                width=str(central_stick_width),
                height=str(central_stick_height),
                fill='#f58d42'
            )

            ############################################################################
            # 3) Draw the base (small rectangle under the vertical pole)
            ############################################################################

            
            base_y = horizontal_bar_y + central_stick_height
            base_width = 2 * central_stick_width 
            base_height = 50
            base_x = central_stick_x - base_width/4
            etree.SubElement(
                balance_group, 'rect',
                x=str(base_x),
                y=str(base_y),
                width=str(base_width),
                height=str(base_height),
                fill='#f58d42'
            )
            ###########################################################################
            # 6) Update the SVG's width/height so the newly added scale is visible
            ############################################################################
        
            # Force them to be integers for cleanliness
            
            svg_root.attrib["height"] = str(base_y + base_height + 20)

        
    
        def handle_all_except_comparison(operations, entities, svg_root, resources_path,result_entities,start_x=50, start_y=100):
            # Constants
            UNIT_SIZE = 40
            APPLE_SCALE = 0.75
            ITEM_SIZE = int(UNIT_SIZE * APPLE_SCALE)
            ITEM_PADDING = int(UNIT_SIZE * 0.25)
            BOX_PADDING = UNIT_SIZE
            OPERATOR_SIZE = 30
            MAX_ITEM_DISPLAY = 10
            MARGIN = 50
            if any("unittrans_unit" in entity for entity in entities):   #刀
                ITEM_SIZE = 3 * ITEM_SIZE


            # Extract quantities and entity_types
            quantities = [e["item"].get("entity_quantity", 0) for e in entities]
            entity_types = [e["item"].get("entity_type", "") for e in entities]

            any_multiplier = any(t == "multiplier" for t in entity_types)
            any_above_20 = any(q > MAX_ITEM_DISPLAY for q in quantities)

            # Determine entity layout entity_type first
            for e in entities:
                q = e["item"].get("entity_quantity", 0)
                t = e["item"].get("entity_type", "")
                container = e.get("container_type", "")
                attr = e.get("attr_entity_type", "")

                
                if t == "multiplier":
                    e["layout"] = "multiplier"
                elif q > MAX_ITEM_DISPLAY or q % 1 != 0:
                    e["layout"] = "large"
                else:
                    if "row" in [container, attr]:
                        e["layout"] = "row"
                    elif "column" in [container, attr]:
                        e["layout"] = "column"
                    else:
                        e["layout"] = "normal"

            # Focus on normal layout entities
            normal_entities = [e for e in entities if e["layout"] == "normal"]

            # Compute global layout for normal entities:
            # 1. Find the largest entity_quantity among normal layout entities
            if normal_entities:
                largest_normal_q = max(e["item"].get("entity_quantity",0) for e in normal_entities)
            else:
                largest_normal_q = 1

            # 2. Compute global max_cols and max_rows for this largest normal q
            if largest_normal_q > 0:
                max_cols = int(math.ceil(math.sqrt(largest_normal_q)))
                max_rows = (largest_normal_q + max_cols - 1) // max_cols
            else:
                max_cols, max_rows = 1, 1

            # Assign these global cols and rows to all normal entities
            for e in normal_entities:
                e["cols"] = max_cols
                e["rows"] = max_rows

            # For row/column entities and large entities, compute cols/rows individually
            unit_trans_padding = 0
            for e in entities:
                if e["layout"] == "large":
                    # Large scenario doesn't rely on cols/rows for layout calculation (just 1x1 effectively)
                    e["cols"] = 1
                    e["rows"] = 1
                elif e["layout"] == "row":
                    q = e["item"].get("entity_quantity", 0)
                    e["cols"] = q if q > 0 else 1
                    e["rows"] = 1
                elif e["layout"] == "column":
                    q = e["item"].get("entity_quantity", 0)
                    e["cols"] = 1
                    e["rows"] = q if q > 0 else 1
                elif e["layout"] == "multiplier":
                    e["cols"] = 1
                    e["rows"] = 1

                if e.get("unittrans_unit", ""):
                    unit_trans_padding = 50
                
                # normal layout already assigned

            # Compute normal box size using global max_cols and max_rows
            normal_box_width = max_cols * (ITEM_SIZE + ITEM_PADDING) + BOX_PADDING
            normal_box_height = max_rows * (ITEM_SIZE + ITEM_PADDING + unit_trans_padding) + BOX_PADDING

            # Large scenario box dimension
            largest_q = max(quantities) if quantities else 1
            q_str = str(largest_q)
            text_width = len(q_str)*20
            # large_total_width = text_width + 10 + UNIT_SIZE + 10 + UNIT_SIZE  #刀
            large_total_width = ITEM_SIZE * 4
            large_box_width = large_total_width + BOX_PADDING
            # large_box_height = UNIT_SIZE + BOX_PADDING*2 + unit_trans_padding
            large_box_height = ITEM_SIZE * 4 + BOX_PADDING

            # Decide reference box size if large scenario or multiplier
            if any_multiplier or any_above_20:
                ref_box_width = max(normal_box_width, large_box_width)
                ref_box_height = max(normal_box_height, large_box_height)
            else:
                ref_box_width = normal_box_width
                ref_box_height = normal_box_height

            # Compute final box size for each entity based on layout
            def compute_entity_box_size(e):
                q = e["item"].get("entity_quantity", 0)
                t = e["item"].get("entity_type", "")
                layout = e["layout"]
                unit_trans_padding = 0
                

                if layout == "multiplier":
                    # Multiplier: minimal width, same height as ref to align
                    return (UNIT_SIZE * 2, ref_box_height )
                if layout == "large":
                    return (large_box_width, large_box_height )
                elif layout == "normal":
                    # Use global normal box size
                    return (normal_box_width, normal_box_height)
                elif layout == "row":
                    cols = e["cols"] # q items in a row
                    rows = 1
                    w = cols*(ITEM_SIZE+ITEM_PADDING)+BOX_PADDING
                    h = rows*(ITEM_SIZE+ITEM_PADDING)+BOX_PADDING
                    return (w, h)
                elif layout == "column":
                    cols = 1
                    rows = e["rows"] 
                    w = cols*(ITEM_SIZE+ITEM_PADDING)+BOX_PADDING
                    h = rows*(ITEM_SIZE+ITEM_PADDING)+BOX_PADDING
                    return (w, h)
                # fallback
                return (normal_box_width, normal_box_height)

            for e in entities:
                w,h = compute_entity_box_size(e)
                e["planned_width"] = w
                if e.get("unittrans_unit", ""):
                    e["planned_height"] = h + 50
                else:
                    e["planned_height"] = h

                # print('e["planned_width"]', e["planned_width"])
                # print('e["planned_height"]', e["planned_height"])


            # Position planning 
            # start_x, start_y = 50, 100
            operator_gap = e_gap = eq_gap = qmark_gap = 20

            # Initialize the starting point for the first entity
            current_x = start_x
            current_y = start_y
            box_y = start_y
            position_box_y = 0
            # Iterate through the entities and operators
            for i, entity in enumerate(entities):
                # Set position for the current entity
                entity["planned_x"] = current_x
                if entity.get("unittrans_unit", ""):
                    entity["planned_y"] = current_y 
                    entity["planned_box_y"] = current_y - 50
                    box_y = current_y - 50
                else:
                    entity["planned_y"] = current_y
                    entity["planned_box_y"] = current_y
                    box_y = current_y
                if i == 0:
                    position_box_y = box_y
                # Update the rightmost x-coordinate of the current entity
                e_right = current_x + entity["planned_width"]
                if operations and i < len(operations):
                    # Position the operator
                    operator_x = e_right + operator_gap
                    operator_y = position_box_y + (entities[0]["planned_height"] / 2) - (OPERATOR_SIZE / 2)
                    
                    operations[i]["planned_x"] = operator_x
                    operations[i]["planned_y"] = operator_y

                    # Update the x-coordinate for the next entity
                    current_x = operator_x + OPERATOR_SIZE + e_gap
                else:
                    # For the last entity, just update the x-coordinate for spacing
                    current_x = e_right + e_gap
            # Position the equals sign (only meaningful when we have operations)
            eq_x = current_x + eq_gap
            eq_y = position_box_y + (entities[0]["planned_height"] / 2) - (OPERATOR_SIZE / 2)
            
            # Position the question mark
            qmark_x = eq_x + 30 + qmark_gap
            qmark_y = position_box_y + (entities[0]["planned_height"] / 2) - (OPERATOR_SIZE / 2)-15






            max_x, max_y = 0,0
            def update_max_dimensions(x_val, y_val):
                nonlocal max_x, max_y
                if x_val > max_x:
                    max_x = x_val
                if y_val > max_y:
                    max_y = y_val

        
            def embed_svg(file_path, x, y, width, height):
                if not os.path.exists(file_path):
                    logger.debug(f"SVG file not found: {file_path}")
                    # Get the directory and base name from the file_path
                    dir_path = os.path.dirname(file_path)
                    base_name = os.path.splitext(os.path.basename(file_path))[0]
                    
                    # Use cached candidate list if available
                    if dir_path in self._svg_directory_cache:
                        candidate_files = self._svg_directory_cache[dir_path]
                    else:
                        candidate_files = [f for f in os.listdir(dir_path) if f.lower().endswith(".svg")]
                        self._svg_directory_cache[dir_path] = candidate_files

                    # Build candidate paths
                    candidate_paths = [os.path.join(dir_path, f) for f in candidate_files]
                    
                    found_path = None
                    
                    # Helper: Try a candidate name against all files (case-insensitive)
                    def try_candidate(name):
                        for candidate in candidate_paths:
                            candidate_base = os.path.splitext(os.path.basename(candidate))[0]
                            if candidate_base.lower() == name.lower():
                                return candidate
                        return None

                    # 1. Try exact match using the given base_name
                    found_path = try_candidate(base_name)
                    
                    # 2. Try using singular and plural forms using inflect
                    if not found_path:
                        self._missing_svg_entities.append(base_name)
                        singular_form = self.p.singular_noun(base_name) or base_name
                        plural_form = self.p.plural_noun(base_name) or base_name
                        for mod_name in (plural_form, singular_form):
                            found_path = try_candidate(mod_name)
                            if found_path:
                                break

                    # 3. If a hyphen exists, try matching only the part after the hyphen (and its variants)
                    if not found_path and "-" in base_name:
                        after_hyphen = base_name.split("-")[-1]
                        singular_after = self.p.singular_noun(after_hyphen) or after_hyphen
                        plural_after = self.p.plural_noun(after_hyphen) or after_hyphen
                        for mod_name in (after_hyphen, plural_after, singular_after):
                            found_path = try_candidate(mod_name)
                            if found_path:
                                break

                    # 4. As a last resort, use fuzzy matching to select the best candidate.
                    if not found_path:
                        candidate_bases = [os.path.splitext(f)[0] for f in candidate_files]
                        close_matches = difflib.get_close_matches(base_name, candidate_bases, n=1, cutoff=0.6)
                        if close_matches:
                            match = close_matches[0]
                            found_path = try_candidate(match)
                    
                    if found_path:
                        file_path = found_path
                        logger.info(f"Found alternative SVG file: {file_path}")
                    else:
                        logger.warning(f"SVG file not found using alternative search: {file_path}")
                        self.error_message = self._translate("Cannot generate visual: SVG file not found for %(base_name)s.", base_name=base_name)
                        raise FileNotFoundError(f"SVG file not found: {file_path}")

                # If file_path exists now, parse and update attributes.
                tree = etree.parse(file_path)
                root = tree.getroot()
                root.attrib["x"] = str(x)
                root.attrib["y"] = str(y)
                root.attrib["width"] = str(width)
                root.attrib["height"] = str(height)
                update_max_dimensions(x + width, y + height)
                return root
            
            def get_figure_svg_path(attr_entity_type):
                if attr_entity_type:
                    return os.path.join(resources_path, f"{attr_entity_type}.svg")
                return None

        
            def embed_top_figures_and_text(parent, box_x, box_y, box_width, container_type, container_name, attr_entity_type, attr_name, entity_dsl_path=""):
                items = []
                show_something = container_name or container_type or attr_name or attr_entity_type
                if not show_something:
                    items.append(("text", ""))
                else:
                    # Check if container_type exists and the corresponding SVG file is valid
                    if container_type:
                        figure_path = get_figure_svg_path(container_type)
                        if figure_path and os.path.exists(figure_path):
                            items.append(("svg", container_type))
                        else:
                            self._missing_svg_entities.append(container_type)
                            logger.debug(f"SVG for container_type '{container_type}' does not exist. Ignoring container_type.")
                    
                    if container_name:
                        items.append(("text", container_name))

                    if attr_entity_type and attr_name:
                        figure_path = get_figure_svg_path(attr_entity_type)
                        if figure_path and os.path.exists(figure_path):
                            items.append(("svg", attr_entity_type))
                        else:
                            self._missing_svg_entities.append(attr_entity_type)
                            logger.debug(f"SVG for attr_entity_type '{attr_entity_type}' does not exist. Ignoring attr_entity_type.")
                        items.append(("text", attr_name))

                # Simulate the needed width for all items
                item_positions = []
                total_width = 0
                for idx, (t, v) in enumerate(items):
                    if t == "svg":
                        width = UNIT_SIZE
                    else:
                        # Calculate text width based on length
                        width = len(v) * 7  # Approximate width per character at font-size 15px
                    item_positions.append((t, v, width))
                    total_width += width
                    if idx < len(items) - 1:
                        total_width += 10  # Add spacing between items

                # Calculate the starting X position to center all items
                start_x = box_x + (box_width - total_width) / 2
                center_y = box_y - UNIT_SIZE - 5

                group = etree.SubElement(parent, "g")
                current_x = start_x

                for idx, (t, v, width) in enumerate(item_positions):
                    if t == "svg":
                        figure_path = get_figure_svg_path(v)
                        if figure_path and os.path.exists(figure_path):
                            svg_el = embed_svg(figure_path, x=current_x, y=center_y, width=UNIT_SIZE, height=UNIT_SIZE)
                            # Add DSL path metadata for SVG elements (container type or attribute type)
                            if v == container_type and container_type:
                                container_type_dsl_path = f"{entity_dsl_path}/container_type"
                                svg_el.set('data-dsl-path', container_type_dsl_path)
                                svg_el.set('visual-element-path', container_type_dsl_path)
                                svg_el.set('style', 'pointer-events: bounding-box;')
                            elif v == attr_entity_type and attr_entity_type:
                                attr_type_dsl_path = f"{entity_dsl_path}/attr_type"
                                svg_el.set('data-dsl-path', attr_type_dsl_path)
                                svg_el.set('visual-element-path', attr_type_dsl_path)
                                svg_el.set('style', 'pointer-events: bounding-box;')
                            # Append the returned svg element to the group
                            group.append(svg_el)
                        current_x += width
                    else:
                        # text_x = current_x + (width / 2)  # Center the text properly
                        text_x = current_x
                        text_y = center_y + (UNIT_SIZE / 2)
                        text_element = etree.SubElement(group, "text", x=str(text_x), y=str(text_y),
                                                        style="font-size: 15px; pointer-events: auto;", dominant_baseline="middle", text_anchor="middle")
                        text_element.text = v
                        
                        # Add DSL path metadata for text elements (container names or attribute names)
                        if v == container_name and container_name:
                            # This is a container name
                            container_name_dsl_path = f"{entity_dsl_path}/container_name"
                            text_element.set('data-dsl-path', container_name_dsl_path)
                            text_element.set('visual-element-path', container_name_dsl_path)
                        elif v == attr_name and attr_name:
                            # This is an attribute name
                            attr_name_dsl_path = f"{entity_dsl_path}/attr_name"
                            text_element.set('data-dsl-path', attr_name_dsl_path)
                            text_element.set('visual-element-path', attr_name_dsl_path)
                        
                        current_x += width

                    if idx < len(items) - 1:
                        current_x += 10

            

            def draw_entity(e):
                q = e["item"].get("entity_quantity", 0)
                t = e["item"].get("entity_type", "apple")
                container_name = e.get("container_name", "").strip()
                container_type = e.get("container_type", "").strip()
                attr_name = e.get("attr_name", "").strip()
                attr_entity_type = e.get("attr_entity_type", "").strip()

                # UnitTrans-specific attributes
                unittrans_unit = e.get("unittrans_unit", "")
                unittrans_value = e.get("unittrans_value", None)

                x = e["planned_x"]
                y = e["planned_y"]
                box_y = e["planned_box_y"]
                box_y = e["planned_box_y"]
                w = e["planned_width"]
                h = e["planned_height"]
                layout = e["layout"]
                cols = e["cols"]
                rows = e["rows"]

        
                q = float(q)
                if layout == "multiplier":
                    if q.is_integer():
                        q_str = str(int(q))  # Convert to integer
                    else:
                        q_str = str(q)  # Keep as is
                    text_x = x + w/2
                    # Adjust text_y to align with operator
                    text_y = position_box_y+ (entities[0]["planned_height"] / 2) - (OPERATOR_SIZE / 2) + 34
                    text_element = etree.SubElement(svg_root, "text", x=str(text_x), y=str(text_y),
                                                    style="font-size: 50px; pointer-events: auto;", dominant_baseline="middle")
                    text_element.text = q_str
                    # Add DSL path metadata for quantity text
                    entity_dsl_path = e.get('_dsl_path', '')
                    quantity_dsl_path = f"{entity_dsl_path}/entity_quantity"
                    text_element.set('data-dsl-path', quantity_dsl_path)
                    text_element.set('visual-element-path', quantity_dsl_path)
                    update_max_dimensions(text_x + len(q_str)*30, text_y + 50)
                    return
                # Draw box with DSL path metadata
                entity_dsl_path = e.get('_dsl_path', '')
                rect_elem = etree.SubElement(svg_root, "rect", x=str(x), y=str(box_y),
                                width=str(w), height=str(h), stroke="black", fill="none",
                                style="pointer-events: all;")
                rect_elem.set('data-dsl-path', entity_dsl_path)
                rect_elem.set('visual-element-path', entity_dsl_path)
                
                # Draw bracket
                bracket_y = position_box_y + (entities[0]["planned_height"] / 2) + 13
                try: 
                    if e.get("bracket") == "left":
                        
                        text_element = etree.SubElement(svg_root, "text",
                                                                        x=str(x-20), #刀
                                                                        y=str(bracket_y),  # Center text vertically
                                                                        style="font-size: 60px; pointer-events: none;",
                                                                        text_anchor="middle",  # Center align text
                                                                        dominant_baseline="middle")  # Center align text vertically
                        text_element.text = "("
                    elif e.get("bracket") == "right":
                        operator_y = position_box_y + (entities[0]["planned_height"] * 1.2 / 2)
                        text_element = etree.SubElement(svg_root, "text",
                                                                x=str(x+w), #刀
                                                                y=str(bracket_y),  # Center text vertically
                                                                style="font-size: 60px; pointer-events: none;",
                                                                text_anchor="middle",  # Center align text
                                                                dominant_baseline="middle")
                        text_element.text = ")"
                except:
                    logger.debug("No bracket")

                # y + h 
                update_max_dimensions(x + w, y + h)

                # Embed text or figures at the top
                entity_dsl_path = e.get('_dsl_path', '')
                embed_top_figures_and_text(svg_root, x, box_y, w, container_type, container_name, attr_entity_type, attr_name, entity_dsl_path)


                if layout == "large":
                    # print('ITEM_SIZE', ITEM_SIZE)
                    # if unittrans_unit and unittrans_value is not None:
                    #     global ITEM_SIZE
                    #     ITEM_SIZE = ITEM_SIZE / 2
                    # Large scenario
                    q = float(q)
                    if q.is_integer():
                        q_str = str(int(q))  # Convert to integer
                    else:
                        q_str = str(q)  # Keep as is
                    tw = len(q_str)*20
                    # total_width = tw + 10 + UNIT_SIZE + 10 + UNIT_SIZE
                    # print('item_size', ITEM_SIZE)
                    total_width = ITEM_SIZE * 4
                    # print('item_size', ITEM_SIZE)
                    start_x_line = x + (w - total_width)/2
                    svg_x = start_x_line
                    center_y_line = y + (h - UNIT_SIZE)/2
                    svg_y = center_y_line - 1.5 * ITEM_SIZE
                    svg_y = y + ITEM_PADDING
                    text_y = y + ITEM_PADDING + 2.4 * ITEM_SIZE
                    text_x = svg_x+ITEM_SIZE*1.

                    
                    # Add item SVG with DSL path metadata
                    item_svg_path = os.path.join(resources_path, f"{t}.svg")
                    embedded_svg = embed_svg(item_svg_path, x=svg_x, y= svg_y, width=ITEM_SIZE * 4  , height=ITEM_SIZE * 4)
                    # Add DSL path metadata for entity_type highlighting
                    entity_type_dsl_path = f"{entity_dsl_path}/entity_type"
                    embedded_svg.set('data-dsl-path', entity_type_dsl_path)
                    embedded_svg.set('visual-element-path', entity_type_dsl_path)
                    embedded_svg.set('style', 'pointer-events: bounding-box;')
                    svg_root.append(embedded_svg)
                    
                    # Add entity_quantity text with DSL path metadata
                    if unittrans_unit and unittrans_value is not None:
                        text_element = etree.SubElement(svg_root, "text", x=str(text_x),
                                                        y=str(text_y),
                                                        style="font-size: 100px; fill: white; font-weight: bold; stroke: black; stroke-width: 2px; pointer-events: auto;", dominant_baseline="middle")
                    else:
                        text_element = etree.SubElement(svg_root, "text", x=str(text_x),
                                                        y=str(text_y),
                                                        style="font-size: 45px; fill: white; font-weight: bold; stroke: black; stroke-width: 2px; pointer-events: auto;", dominant_baseline="middle")
                    text_element.text = q_str
                    # Add DSL path metadata for quantity text
                    quantity_dsl_path = f"{entity_dsl_path}/entity_quantity"
                    text_element.set('data-dsl-path', quantity_dsl_path)
                    text_element.set('visual-element-path', quantity_dsl_path)
                    update_max_dimensions(start_x_line + tw, center_y_line + 40)

                    if unittrans_unit and unittrans_value is not None:
                        # Define circle position
                        circle_radius = 30
                        unit_trans_padding = 50
                        # circle_center_x = item_x + ITEM_SIZE -5 
                        # item_x = x + BOX_PADDING / 2 + ITEM_SIZE + ITEM_PADDING
                        item_x = start_x_line
                        item_y = y + BOX_PADDING / 2 + ITEM_SIZE + ITEM_PADDING + unit_trans_padding
                        circle_center_x = x + 2 * ITEM_SIZE
                        circle_center_y = svg_y - circle_radius # Above the top-right corner of the item

                        # Add purple circle
                        etree.SubElement(svg_root, "circle", cx=str(circle_center_x), cy=str(circle_center_y),
                                        r=str(circle_radius), fill="#BBA7F4")

                        # Add text inside the circle
                        # plural_suffix = "s" if unittrans_value > 1 else ""  # Add 's' if value is plural
                        # unittrans_text = f"{unittrans_value} {unittrans_unit}{plural_suffix}"
                        unittrans_text = f"{unittrans_value}"
                    
                        #     unittrans_text = f"{int(unittrans_value)}"  # Convert to integer
                        # else:
                        #     unittrans_text = f"{unittrans_value}"  # Keep as is
                        text_element = etree.SubElement(svg_root, "text",
                                                        x=str(circle_center_x-15), #
                                                        y=str(circle_center_y + 5),  # Center text vertically
                                                        style="font-size: 15px;",
                                                        text_anchor="middle",  # Center align text
                                                        dominant_baseline="middle")  # Center align text vertically
                        text_element.text = unittrans_text
                else:
                    # Use global cols and rows for normal, row, column layouts
                    if layout in ["normal", "row", "column"]:
                        item_svg_path = os.path.join(resources_path, f"{t}.svg")
                        for i in range(int(q)):
                            row = i // cols
                            col = i % cols
                            unit_trans_padding = 0
                            if unittrans_unit and row != 0:
                                unit_trans_padding = 50
                            item_x = x + BOX_PADDING / 2 + col * (ITEM_SIZE + ITEM_PADDING)
                            item_y = y + BOX_PADDING / 2 + row * (ITEM_SIZE + ITEM_PADDING + unit_trans_padding) 

                            # Draw the item with DSL path metadata
                            embedded_svg = embed_svg(item_svg_path, x=item_x, y=item_y, width=ITEM_SIZE, height=ITEM_SIZE)
                            # Add DSL path metadata for entity_type highlighting
                            entity_type_dsl_path = f"{entity_dsl_path}/entity_type[{i}]"
                            embedded_svg.set('data-dsl-path', entity_type_dsl_path)
                            embedded_svg.set('visual-element-path', entity_type_dsl_path)
                            embedded_svg.set('style', 'pointer-events: bounding-box;')
                            svg_root.append(embedded_svg)
                            
                            # If unittrans_unit exists, add the purple circle
                            if unittrans_unit:
                                # Define circle position
                                circle_radius = 30
                                # circle_center_x = item_x + ITEM_SIZE -5 
                                circle_center_x = item_x + ITEM_SIZE/2
                                circle_center_y = item_y - circle_radius # Above the top-right corner of the item

                                # Add purple circle
                                etree.SubElement(svg_root, "circle", cx=str(circle_center_x), cy=str(circle_center_y),
                                                r=str(circle_radius), fill="#BBA7F4")

                                # Add text inside the circle
                                # plural_suffix = "s" if unittrans_value > 1 else ""  # Add 's' if value is plural
                                # unittrans_text = f"{unittrans_value} {unittrans_unit}{plural_suffix}"
                                unittrans_text = f"{unittrans_value}"
                            
                                #     unittrans_text = f"{int(unittrans_value)}"  # Convert to integer
                                # else:
                                #     unittrans_text = f"{unittrans_value}"  # Keep as is
                                text_element = etree.SubElement(svg_root, "text",
                                                                x=str(circle_center_x-15), #
                                                                y=str(circle_center_y + 5),  # Center text vertically
                                                                style="font-size: 15px;",
                                                                text_anchor="middle",  # Center align text
                                                                dominant_baseline="middle")  # Center align text vertically
                                text_element.text = unittrans_text


                


            # Draw entities
            for entity in entities:  # Assuming exactly two entities
                draw_entity(entity)

            # Draw operator
            if operations:
                operator_svg_mapping = {
                    "surplus": "division",  # Map 'surplus' to 'subtraction.svg'
                    "area": "multiplication",
                    "default": "addition"      # Fallback default operator
                }
                for operator in operations:
                # Get the mapped SVG entity_type for the operator
                    operator_entity_type = operator['entity_type']
                    mapped_operator_entity_type = operator_svg_mapping.get(operator_entity_type, operator_entity_type)  # Fallback to itself if not in mapping
                    
                    # Determine the SVG file path
                    operator_svg_path = os.path.join(resources_path, f"{mapped_operator_entity_type}.svg")
                    
                    # Fallback to the default operator SVG if the file does not exist
                    if not os.path.exists(operator_svg_path):
                        fallback_entity_type = operator_svg_mapping["default"]
                        operator_svg_path = os.path.join(resources_path, f"{fallback_entity_type}.svg")
                    
                    # Create a group element to contain the operation and add interactivity
                    operation_group = etree.SubElement(svg_root, 'g')
                    operation_group.set('data-dsl-path', operator.get('_dsl_path', ''))
                    operation_group.set('style', 'pointer-events: all;')
                    
                    # Embed the operator SVG at its planned position
                    operation_group.append(
                        embed_svg(
                            operator_svg_path,
                            x=operator["planned_x"],
                            y=operator["planned_y"],
                            width=OPERATOR_SIZE,
                            height=OPERATOR_SIZE
                        )
                    )



            last_x_point = current_x
            if operations and data.get("operation") != "identity":
                # Draw equals
                equals_svg_path = os.path.join(resources_path, "equals.svg")
                if not os.path.exists(equals_svg_path):
                    equals_svg_path = os.path.join(resources_path, "equals_default.svg")  # Fallback if necessary
                svg_root.append(embed_svg(equals_svg_path, x=eq_x, y=eq_y, width=30, height=30))

                last_x_point = 0
                # Draw question mark
                if operations and operations[-1]["entity_type"] == "surplus":
                    # Draw the first question mark
                    question_mark_svg_path = os.path.join(resources_path, "question.svg")
                    if not os.path.exists(question_mark_svg_path):
                        question_mark_svg_path = os.path.join(resources_path, "question_default.svg")  # Fallback if necessary
                    svg_root.append(embed_svg(question_mark_svg_path, x=qmark_x, y=qmark_y, width=60, height=60))

                    # Calculate position for the "with remainder" text
                    text_x = qmark_x + 70  # Adjust spacing to place text after the first question mark
                    text_y = qmark_y + 35  # Vertically aligned with the question mark

                    # Add the "with remainder" text
                    text_element = etree.SubElement(
                        svg_root,
                        "text",
                        x=str(text_x),
                        y=str(text_y),
                        style="font-size: 15px;",
                        dominant_baseline="middle"
                    )
                    text_element.text = "with remainder"

                    # Calculate position for the second question mark
                    second_qmark_x = text_x + 100  # Adjust based on text width (approximate)
                    second_qmark_y = qmark_y

                    # Draw the second question mark
                    svg_root.append(embed_svg(question_mark_svg_path, x=second_qmark_x, y=second_qmark_y, width=60, height=60))
                    last_x_point = second_qmark_x + 60
                else:
                    # Default case: draw a single question mark
                    question_mark_svg_path = os.path.join(resources_path, "question.svg")
                    if not os.path.exists(question_mark_svg_path):
                        question_mark_svg_path = os.path.join(resources_path, "question_default.svg")  # Fallback if necessary
                    svg_root.append(embed_svg(question_mark_svg_path, x=qmark_x, y=qmark_y, width=60, height=60))
                    last_x_point = qmark_x + 60


            # Update SVG size
            final_width = max_x + MARGIN
            final_height = max_y + MARGIN
            svg_root.attrib["width"] = str(final_width)
            svg_root.attrib["height"] = str(final_height)

            width = last_x_point - start_x

            # return True, width, svg_root.attrib["height"]
            return True, str(float(svg_root.attrib["width"]) - start_x), svg_root.attrib["height"]



        # main function:
        created = False
        if data.get('operation') == "comparison":
            # Get the DSL path for the comparison operation
            comparison_dsl_path = data.get('_dsl_path', 'operation')
            
            (
            compare1_operations, 
            compare1_entities, 
            compare1_result_entities,
            compare2_operations, 
            compare2_entities, 
            compare2_result_entities
            ) = extract_operations_and_entities_for_comparison(data, comparison_dsl_path)

            # if find container_name of different entity are different but the container entity_type are the same, update the second entity's container entity_type to be original entity_type-2,the third to be original entity_type-3...
            compare1_entities,compare1_result_entities = update_container_types_optimized(compare1_entities,compare1_result_entities)
            #if the last result_container share the same container_name with any entity, update the container_name of result_container.
            if compare1_result_entities and compare1_entities: 
                # [e.update({'container_name': '', 'container_type': ''}) for e in compare1_entities if e.get('container_name') == compare1_result_entities[-1].get('container_name')]
                last_container = compare1_result_entities[-1].get('container_name')
                if any(e.get('container_name') == last_container for e in compare1_entities) and last_container:
                    compare1_result_entities[-1]['container_name'] = f"{last_container} (result)"
            

            
            # if find container_name of different entity are different but the container entity_type are the same, update the second entity's container entity_type to be original entity_type-2,the third to be original entity_type-3...
            compare2_entities,compare2_result_entities = update_container_types_optimized(compare2_entities,compare2_result_entities)
            if compare2_result_entities and compare2_entities: 
                # [e.update({'container_name': '', 'container_type': ''}) for e in compare1_entities if e.get('container_name') == compare1_result_entities[-1].get('container_name')]
                last_container = compare2_result_entities[-1].get('container_name')
                if any(e.get('container_name') == last_container for e in compare2_entities) and last_container:
                    compare2_result_entities[-1]['container_name'] = f"{last_container} (result)"


            # Operations are already in the expected format with DSL paths
            # No need to convert them
            try:
                created, svg_width, svg_height = handle_comparison(compare1_operations, compare1_entities, compare1_result_entities,
                            compare2_operations, compare2_entities, compare2_result_entities,
                            svg_root,resources_path, comparison_dsl_path=comparison_dsl_path)
            except:
                logger.error("Error in handle_comparison exception")
                created = False
        else:
            operations, entities, result_entities = extract_operations_and_entities(data, current_path="")

            # if result_entities and entities: 
            #     [e.update({'container_name': '', 'container_type': ''}) for e in entities if e.get('container_name') == result_entities[-1].get('container_name')]

            # if find container_name of different entity are different but the container entity_type are the same, update the second entity's container entity_type to be original entity_type-2,the third to be original entity_type-3...
            entities,result_entities = update_container_types_optimized(entities,result_entities)
            #if the last result_container share the same container_name with any entity, update the container_name of result_container.
            if result_entities and entities: 
                # [e.update({'container_name': '', 'container_type': ''}) for e in compare1_entities if e.get('container_name') == compare1_result_entities[-1].get('container_name')]
                last_container = result_entities[-1].get('container_name')
                if any(e.get('container_name') == last_container for e in entities) and last_container:
                    result_entities[-1]['container_name'] = f"{last_container} (result)"


            # Operations are already in the expected format with DSL paths
            # No need to convert them

            try:
                created, svg_width, svg_height = handle_all_except_comparison(operations, entities, svg_root, resources_path,result_entities)
            except:
                created = False
        
        # Write to output file
        if created:
            with open(output_file, "wb") as f:
                f.write(etree.tostring(svg_root, pretty_print=True))
        else:
            logger.error(f"error_message: {self.error_message}")
        return created
