import { SVGActionMenu } from "@/components/popups/SVGActionMenu";
import { EntityQuantityPopup } from "@/components/popups/EntityQuantityPopup";
import { NamePopup } from "@/components/popups/NamePopup";

type Props = {
  selectorPopupState: { isOpen: boolean; dslPath: string; currentValue: string; sanitizedEntityType: string };
  closeSelectorPopup: () => void;
  updateSVG: (newType: string) => Promise<void>;

  quantityPopupState: { isOpen: boolean; initialQuantity: number };
  closeQuantityPopup: () => void;
  updateEntityQuantity: (newQuantity: number) => Promise<void>;

  namePopupState: { isOpen: boolean; initialValue: string; };
  closeNamePopup: () => void;
  updateName: (newValue: string) => Promise<void>;
};

export function PopupManager({
  selectorPopupState,
  closeSelectorPopup,
  updateSVG,
  quantityPopupState,
  closeQuantityPopup,
  updateEntityQuantity,
  namePopupState,
  closeNamePopup,
  updateName,
}: Props) {
  return (
    <>
      {selectorPopupState.isOpen && (
        <SVGActionMenu
          onClosePopup={closeSelectorPopup}
          onEmbeddedSVGChange={updateSVG}
          sanitizedEntityType={selectorPopupState.sanitizedEntityType}
        />
      )}

      {quantityPopupState.isOpen && (
        <EntityQuantityPopup
          onClose={closeQuantityPopup}
          onUpdate={updateEntityQuantity}
          initialQuantity={quantityPopupState.initialQuantity}
        />
      )}

      {namePopupState.isOpen && (
        <NamePopup
          onClose={closeNamePopup}
          onUpdate={updateName}
          initialValue={namePopupState.initialValue}
        />
      )}
    </>
  );
}


