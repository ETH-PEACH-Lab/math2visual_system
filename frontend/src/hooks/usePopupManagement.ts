import { useCallback, useMemo } from "react";
import { useSVGSelector } from "./useSVGSelector";
import { useEntityQuantityPopup } from "@/hooks/useEntityQuantityPopup";
import { useNamePopup } from "@/hooks/useNamePopup";
import type { ComponentMapping } from "@/types/visualInteraction";
import type { ParsedOperation } from "@/utils/dsl-parser";

export type PopupManagementDeps = {
  mwp: string;
  formula: string | null;
  onVisualsUpdate: (data: {
    visual_language: string;
    svg_formal: string | null;
    svg_intuitive: string | null;
    formal_error: string | null;
    intuitive_error: string | null;
    missing_svg_entities: string[];
    componentMappings: ComponentMapping;
    parsedDSL: ParsedOperation | null;
    mwp?: string;
    formula?: string | null;
  }) => void;
};

export const usePopupManagement = ({ mwp, formula, onVisualsUpdate }: PopupManagementDeps) => {

  const {
    selectorState : selectorPopupState,
    openSelector : openSelectorPopup,
    closeSelector : closeSelectorPopup,
    updateEmbeddedSVG : updateSVG,
  } = useSVGSelector({ mwp, formula, onVisualsUpdate });

  const {
    popupState: quantityPopupState,
    openPopup: openQuantityPopup,
    closePopup: closeQuantityPopup,
    updateEntityQuantity,
  } = useEntityQuantityPopup({ mwp, formula, onVisualsUpdate });

  const {
    popupState: namePopupState,
    openPopup: openNamePopup,
    closePopup: closeNamePopup,
    updateFieldValue: updateName,
  } = useNamePopup({ mwp, formula, onVisualsUpdate });

  const handleEmbeddedSVGClick = useCallback(
    (event: MouseEvent) => openSelectorPopup(event),
    [openSelectorPopup]
  );

  const handleEntityQuantityClick = useCallback(
    (event: MouseEvent) => openQuantityPopup(event),
    [openQuantityPopup]
  );

  const handleNameClick = useCallback(
    (event: MouseEvent) => openNamePopup(event),
    [openNamePopup]
  );

  return useMemo(() => ({
    selectorPopupState,
    closeSelectorPopup,
    updateSVG,
    handleEmbeddedSVGClick,
    quantityPopupState,
    closeQuantityPopup,
    updateEntityQuantity,
    handleEntityQuantityClick,
    namePopupState,
    closeNamePopup,
    updateName,
    handleNameClick,
  }), [
    selectorPopupState,
    closeSelectorPopup,
    updateSVG,
    handleEmbeddedSVGClick,
    quantityPopupState,
    closeQuantityPopup,
    updateEntityQuantity,
    handleEntityQuantityClick,
    namePopupState,
    closeNamePopup,
    updateName,
    handleNameClick,
  ]);
};


