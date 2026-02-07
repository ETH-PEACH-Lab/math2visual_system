import { memo, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "@/components/visualization/DownloadButton";
import type { TutorVisual } from "@/api_services/tutor";
import { useSVGResponsive } from "@/hooks/useSVGResponsive";

type ChatVisualPreviewProps = {
  visual: TutorVisual;
  onClose: () => void;
};

export const ChatVisualPreview = memo(({ visual, onClose }: ChatVisualPreviewProps) => {
  const { t } = useTranslation();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const { makeResponsive, setupResizeListener } = useSVGResponsive();

  useEffect(() => {
    if (!previewRef.current || !visual.svg) return;
    previewRef.current.innerHTML = visual.svg;
    // makeResponsive already uses requestAnimationFrame internally
    makeResponsive(previewRef.current, { align: "center" });
  }, [visual, makeResponsive]);

  useEffect(() => {
    if (!previewRef.current) return;
    return setupResizeListener([previewRef], { align: "center" });
  }, [setupResizeListener]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-1 sm:p-2"
      role="dialog"
      aria-modal="true"
      aria-label={
        visual.variant === "formal"
          ? t("visualization.formalVisualization")
          : t("visualization.intuitiveVisualization")
      }
      onClick={onClose}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-md border border-border bg-card text-foreground shadow-xl flex items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <DownloadButton
            svgContent={visual.svg ?? null}
            type={visual.variant}
            title={
              visual.variant === "formal"
                ? t("visualization.formalVisualization")
                : t("visualization.intuitiveVisualization")
            }
          />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-md text-foreground"
            aria-label={t("tutor.visualClosePreview")}
            onClick={onClose}
          >
            <X className="responsive-smaller-icon-font-size" aria-hidden="true" />
          </Button>
        </div>
        <div
          ref={previewRef}
          className="w-full h-full flex items-center justify-center overflow-hidden"
          style={{ 
            maxHeight: "calc(100vh - 1rem)", 
            maxWidth: "calc(100vw - 1rem)",
            padding: "0.5rem"
          }}
        />
      </div>
    </div>
  );
});

ChatVisualPreview.displayName = "ChatVisualPreview";

