import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Download, FileImage, File, FileText } from "lucide-react";
import { downloadSvg, downloadPng, downloadPdf, generateVisualizationFilename } from "@/utils/download";
import { trackDownloadStart, trackDownloadComplete, trackError, isAnalyticsEnabled } from "@/services/analyticsTracker";
import { toast } from "sonner";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DownloadFormat } from "@/types";

const downloadOptions = [
  { 
    format: "svg" as DownloadFormat, 
    label: "SVG", 
    icon: FileImage,
    handler: (svgContent: string, type: "formal" | "intuitive") => {
      const filename = generateVisualizationFilename(type, "svg");
      downloadSvg(svgContent, filename);
    }
  },
  { 
    format: "png" as DownloadFormat, 
    label: "PNG", 
    icon: File,
    handler: (svgContent: string, type: "formal" | "intuitive") => {
      const filename = generateVisualizationFilename(type, "png");
      downloadPng(svgContent, filename);
    }
  },
  { 
    format: "pdf" as DownloadFormat, 
    label: "PDF", 
    icon: FileText,
    handler: async (svgContent: string, type: "formal" | "intuitive") => {
      const filename = generateVisualizationFilename(type, "pdf");
      await downloadPdf(svgContent, filename);
    }
  },
];

interface DownloadButtonProps {
  svgContent: string | null;
  type: "formal" | "intuitive";
  title: string;
  disabled?: boolean;
}

export const DownloadButton = ({
  svgContent,
  type,
  title,
  disabled = false,
}: DownloadButtonProps) => {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const analyticsEnabled = isAnalyticsEnabled();

  const handleDownload = async (
    handler: (svgContent: string,
    type: "formal" | "intuitive") => void | Promise<void>,
    format: DownloadFormat,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    if (!svgContent || disabled || isDownloading) return;

    setIsDownloading(true);
    const toastId = toast.loading(
      t("download.preparing", { format: format.toUpperCase() })
    );

    // Track download start
    if (analyticsEnabled) {
      trackDownloadStart(format, `${type}_${format}`);
    }

    try {
      await handler(svgContent, type);
      
      // Track successful download completion
      if (analyticsEnabled) {
        trackDownloadComplete(format, `${type}_${format}`);
      }
      
      toast.success(t("download.success", { format: format.toUpperCase() }), {
        id: toastId,
        description: t("download.savedToFolder", { title }),
      });
    } catch (error) {
      console.error("Download failed:", error);
      
      // Track download error
      if (analyticsEnabled) {
        trackError(`${type}_download_${format}_failed`, error instanceof Error ? error.message : "Download failed");
      }
      
      toast.error(t("download.error", { format: format.toUpperCase() }), {
        id: toastId,
        description:
          error instanceof Error
            ? error.message
            : t("download.unexpectedError"),
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!svgContent) return null;

  const isDisabled = disabled || isDownloading;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="p-2 h-auto w-10 sm:w-12 md:w-14 lg:w-16 xl:w-18 2xl:w-20 3xl:w-22 4xl:w-24 5xl:w-26 6xl:w-28 7xl:w-30 rounded-md"
          size="content"
          disabled={isDisabled}
          onClick={(e) => e.stopPropagation()}
          aria-label={t("common.download")}
        >
          <Download className="responsive-smaller-icon-font-size" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={10} className="w-fit min-w-0 px-1 py-1 md:px-2 md:py-2 lg:px-3 lg:py-3">
        <DropdownMenuLabel className="px-2 py-1.5 cursor-default select-none">
          <span className="responsive-text-font-size text-muted-foreground">{t("common.download")}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {downloadOptions.map((option) => (
          <DropdownMenuItem
            key={option.format}
            onClick={(e) => handleDownload(option.handler, option.format, e)}
            className="cursor-pointer responsive-text-font-size flex items-center gap-1"
            disabled={isDisabled}
          >
            <option.icon className="responsive-smaller-icon-font-size flex-shrink-0" aria-hidden="true" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
