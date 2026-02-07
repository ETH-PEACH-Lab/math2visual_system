import React, { useState, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BasePopup } from "./BasePopup";
import { trackNamePopupType, trackPopupSubmit, trackPopupCancel, isAnalyticsEnabled } from "@/services/analyticsTracker";
import { useTranslation } from "react-i18next";

interface NamePopupProps {
  onClose: () => void;
  onUpdate: (newValue: string) => Promise<void>;
  initialValue: string;
}

export const NamePopup: React.FC<NamePopupProps> = ({
  onClose,
  onUpdate,
  initialValue,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const analyticsEnabled = isAnalyticsEnabled();

  // Handle cancel (click outside)
  const handleCancel = useCallback(() => {
    if (analyticsEnabled) {
      trackPopupCancel('name', 'click_outside');
    }
    onClose();
  }, [analyticsEnabled, onClose]);

  // Handle value update
  const handleUpdate = async () => {
    const trimmedValue = value.trim();
    
    // Don't update if value hasn't changed
    if (trimmedValue === initialValue) {
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      await onUpdate(trimmedValue);
      onClose();
      if (trimmedValue) {
        toast.success(t("popups.name.updated", { value: trimmedValue }));
      } else {
        toast.success(t("popups.name.deleted"));
      }
    } catch (err) {
      console.error(`Failed to update name:`, err);
      toast.error(t("popups.name.updateError"));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard events for popup
  const handlePopupKeyDown = (event: KeyboardEvent) => {
    const trimmedValue = value.trim();
    // Allow Enter if value has changed (even if empty) and not loading
    if (event.key === "Enter" && trimmedValue !== initialValue && !isLoading) {
      event.preventDefault();
      if (analyticsEnabled) {
        trackPopupSubmit('name', trimmedValue, 'keyboard');
      }
      handleUpdate();
    }
  };

  // Value is valid if it's different from initial value (allows deletion by clearing)
  const hasChanged = value.trim() !== initialValue;

  return (
    <BasePopup
      onClose={handleCancel}
      onKeyDown={handlePopupKeyDown}
    >
      <div className="flex flex-col gap-2">
        {/* Input and Update Button */}
        <div className="flex gap-0 group focus-within:ring-[3px] focus-within:ring-ring/50 focus-within:ring-offset-0 focus-within:border-ring rounded-md transition-all duration-200 border border-ring ring-[3px] ring-ring/50 ring-offset-0">
          <Input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (analyticsEnabled) {
                trackNamePopupType(e.target.value);
              }
            }}
            placeholder={t("popups.name.placeholder")}
            spellCheck={false}
            className="text-black rounded-r-none border-r-0 popup-button-responsive-height responsive-text-font-size focus-visible:ring-0 focus-visible:border-transparent focus-visible:outline-none touch-manipulation text-center px-1"
            disabled={isLoading}
          />
          <Button
            onClick={() => {
              if (analyticsEnabled) {
                trackPopupSubmit('name', value.trim());
              }
              handleUpdate();
            }}
            disabled={!hasChanged || isLoading}
            className="px-2 rounded-l-none popup-button-responsive-height responsive-text-font-size !text-primary-foreground focus-visible:ring-0 focus-visible:border-transparent focus-visible:outline-none touch-manipulation flex-shrink-0"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full responsive-smaller-text-font-size border-b-2 border-white" />
            ) : (
              <ArrowRight className="responsive-smaller-icon-font-size"/>
            )}
          </Button>
        </div>
      </div>
    </BasePopup>
  );
};

