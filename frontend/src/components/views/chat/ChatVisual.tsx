import { memo, useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "@/components/visualization/DownloadButton";
import type { TutorVisual } from "@/api_services/tutor";
import { useSVGResponsive } from "@/hooks/useSVGResponsive";
import { ChatVisualPreview } from "./ChatVisualPreview";

type ChatVisualProps = {
  visual: TutorVisual;
};

export const ChatVisual = memo(({ visual }: ChatVisualProps) => {
  const { t } = useTranslation();
  const svgRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { makeResponsive } = useSVGResponsive();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (!svgRef.current || !visual.svg) return;
    svgRef.current.innerHTML = visual.svg;
    // Calculate height based on container's actual available space
    if (containerRef.current) {
      const containerHeight = containerRef.current.clientHeight;
      makeResponsive(svgRef.current, { align: "left", maxHeight: containerHeight });
      // Make SVG fill the container height
      const svg = svgRef.current.firstElementChild;
      if (svg instanceof SVGSVGElement) {
        svg.style.height = '100%';
      }
    }
  }, [visual, makeResponsive]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    
    // Custom resize handler that uses container's actual height
    const handleResize = () => {
      if (svgRef.current && containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        makeResponsive(svgRef.current, { align: "left", maxHeight: containerHeight });
        // Make SVG fill the container height
        const svg = svgRef.current.firstElementChild;
        if (svg instanceof SVGSVGElement) {
          svg.style.height = '100%';
        }
      }
    };
    
    // Setup ResizeObserver for container resize
    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);
    
    // Also listen to window resize
    window.addEventListener('resize', handleResize);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [makeResponsive]);

  return (
    <>
      <div ref={containerRef} className="relative mt-3 w-fit h-[70vh] rounded-lg border bg-card p-2 sm:p-3 md:p-4 shadow-sm overflow-hidden flex flex-col">
        {visual.svg && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
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
              size="content"
              className="p-2 h-auto w-10 sm:w-12 md:w-14 lg:w-16 xl:w-18 2xl:w-20 3xl:w-22 4xl:w-24 5xl:w-26 6xl:w-28 7xl:w-30 rounded-md"
              aria-label={t("tutor.visualOpenLarge")}
              onClick={(event) => {
                event.stopPropagation();
                setIsPreviewOpen(true);
              }}
            >
              <Maximize2 className="responsive-smaller-icon-font-size" aria-hidden="true" />
            </Button>
          </div>
        )}
        <div ref={svgRef} className="w-full h-full flex-1 min-h-0" />
      </div>

      {isPreviewOpen && (
        <ChatVisualPreview visual={visual} onClose={() => setIsPreviewOpen(false)} />
      )}
    </>
  );
});

ChatVisual.displayName = "ChatVisual";

