import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { SVGDatasetService } from "@/api_services/svgDataset";
import { ValidationError } from "@/types";
import { Upload as UploadIcon } from "lucide-react";
import { trackDragOver, trackDrop, trackElementClick, isAnalyticsEnabled } from "@/services/analyticsTracker";
import { useTranslation } from "react-i18next";

interface UseSVGMissingErrorArgs {
  missingSVGEntities: string[];
  onGenerate?: (toastId: string | undefined) => Promise<void>;
  onAllFilesUploaded?: () => void;
}

export const useSVGMissingError = ({
  missingSVGEntities,
  onGenerate,
  onAllFilesUploaded,
}: UseSVGMissingErrorArgs) => {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentEntityIndex, setCurrentEntityIndex] = useState(0);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [isGeneratingSVG, setIsGeneratingSVG] = useState(false);
  const [generatedSVG, setGeneratedSVG] = useState<string | null>(null);
  const [tempFilename, setTempFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generationAbortControllerRef = useRef<AbortController | null>(null);
  const abortedByUserRef = useRef(false);

  const abortGeneration = useCallback(
    (options?: { markUserInitiated?: boolean }) => {
      if (!generationAbortControllerRef.current) return false;

      const { markUserInitiated = true } = options || {};

      if (markUserInitiated) {
        abortedByUserRef.current = true;
      }

      const abortReason = markUserInitiated ? "SVG generation cancelled by user" : "SVG generation aborted";
      generationAbortControllerRef.current.abort(abortReason);
      generationAbortControllerRef.current = null;
      setIsGeneratingSVG(false);
      setGenerateLoading(false);
      setGeneratedSVG(null);
      setTempFilename(null);

      return true;
    },
    []
  );

  useEffect(() => {
    return () => {
      abortGeneration({ markUserInitiated: false });
    };
  }, [abortGeneration]);

  // Clear preview when entity index changes
  useEffect(() => {
    setGeneratedSVG(null);
    setTempFilename(null);
  }, [currentEntityIndex]);

  useEffect(() => {
    setCurrentEntityIndex((prev) => {
      if (missingSVGEntities.length === 0) return 0;
      return Math.min(prev, missingSVGEntities.length - 1);
    });
  }, [missingSVGEntities]);

  const handleUpload = async (file: File): Promise<void> => {
    const uploadToastId = `upload-${Date.now()}`;
    const baseName = missingSVGEntities[currentEntityIndex];
    const filename = `${baseName}.svg`;

    try {
      setUploadLoading(true);

      toast.loading(t("svg.uploading"), { id: uploadToastId });

      const uploadResult = await SVGDatasetService.uploadSVG(file, filename);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Upload failed");
      }

      setCurrentEntityIndex((prev) => prev + 1);

      const hasOtherMissingEntities = missingSVGEntities.length > 1;

      if (!hasOtherMissingEntities && onAllFilesUploaded) {
        toast.success(t("svg.allFilesUploaded"), {
          id: uploadToastId,
        });
        onAllFilesUploaded();
      } else {
        toast.success(t("svg.fileUploadedSuccessfully"), { id: uploadToastId });
      }

      // Regenerate visuals after every upload
      if (onGenerate) {
        try {
          await onGenerate(uploadToastId);
        } catch (error) {
          console.error("Regeneration after upload failed:", error);
          toast.error(t("svg.uploadSucceededRegenerationFailed"), {
            description:
              error instanceof Error
                ? error.message
                : t("svg.failedToRegenerateVisualizations"),
          });
        }
      }
    } catch (uploadError) {
      console.error("Upload failed:", uploadError);

      let errorTitle = t("svg.uploadFailed");
      let errorDescription =
        uploadError instanceof Error
          ? uploadError.message
          : t("errors.unexpectedError");

      // Check if this is a ValidationError with validation details
      if (ValidationError.isValidationError(uploadError)) {
        errorTitle = uploadError.title;
        errorDescription = uploadError.message;
      } else if (uploadError instanceof Error) {
        // Fallback to basic string matching for legacy errors
        if (uploadError.message.includes("Network error")) {
          errorTitle = t("svg.connectionError");
        } else if (uploadError.message.includes("timed out")) {
          errorTitle = t("svg.uploadTimeout");
        } else if (uploadError.message.includes("too large")) {
          errorTitle = t("svg.fileTooLarge");
        } else if (uploadError.message.includes("malicious")) {
          errorTitle = t("svg.securityCheckFailed");
        }
      }

      toast.error(errorTitle, {
        id: uploadToastId,
        description: errorDescription,
      });
    } finally {
      setUploadLoading(false);
      // Clear the file input after each upload attempt (success or failure)
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".svg")) {
      toast.error(t("svg.pleaseSelectSVGFile"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("svg.fileTooLargeMaxSize"));
      return;
    }

    handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Track drop event if analytics is enabled
    if (isAnalyticsEnabled()) {
      trackDrop('svg_upload_drop_zone');
    }

    const file = files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
    
    // Track drag over event if analytics is enabled
    if (isAnalyticsEnabled()) {
      trackDragOver('svg_upload_drop_zone');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    handleFileSelect(file);
    // Clear the input to allow selecting the same file again
    e.currentTarget.value = "";
  };

  const openFileDialog = () => {
    // Track upload button click if analytics is enabled
    if (isAnalyticsEnabled()) {
      trackElementClick('svg_upload_button_click');
    }
    fileInputRef.current?.click();
  };

  const getButtonText = () => {
    if (uploadLoading) return t("svg.processing");
    return t("common.upload");
  };

  const getButtonIcon = () => {
    if (uploadLoading) return null;
    return <UploadIcon className="responsive-icon-font-size mr-2" />;
  };

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (generateLoading || uploadLoading || isGeneratingSVG) return;
    
    const entityName = missingSVGEntities[currentEntityIndex];
    if (!entityName) return;

    // Track generate button click if analytics is enabled
    if (isAnalyticsEnabled()) {
      trackElementClick('svg_generate_button_click');
    }

    try {
      abortGeneration({ markUserInitiated: false });

      const controller = new AbortController();
      generationAbortControllerRef.current = controller;
      abortedByUserRef.current = false;

      setGenerateLoading(true);
      setIsGeneratingSVG(true);

      // Generate SVG
      const generateResult = await SVGDatasetService.generateSVG(entityName, controller.signal);
      
      if (!generateResult.success || !generateResult.svg_content || !generateResult.temp_filename) {
        throw new Error(generateResult.error || "Generation failed");
      }

      // Store the generated SVG for preview
      setGeneratedSVG(generateResult.svg_content);
      setTempFilename(generateResult.temp_filename);
    } catch (error) {
      console.error("Generate failed:", error);
      if (error instanceof Error && error.name === "AbortError") {
        if (!abortedByUserRef.current) {
          toast.info(t("svg.generationCancelled"));
        }
      } else {
        let errorTitle = t("svg.generationFailed");
        let errorDescription =
          error instanceof Error
            ? error.message
            : t("errors.unexpectedError");

        toast.error(errorTitle, {
          description: errorDescription,
        });
      }
    } finally {
      setIsGeneratingSVG(false);
      setGenerateLoading(false);
      generationAbortControllerRef.current = null;
      abortedByUserRef.current = false;
    }
  }, [missingSVGEntities, currentEntityIndex, generateLoading, uploadLoading, isGeneratingSVG, abortGeneration]);

  const handleConfirmGenerated = useCallback(async (): Promise<void> => {
    if (!tempFilename || generateLoading || uploadLoading) return;
    
    const entityName = missingSVGEntities[currentEntityIndex];
    if (!entityName) return;

    const confirmToastId = `confirm-${Date.now()}`;
    
    try {
      setGenerateLoading(true);
      
      toast.loading(t("svg.addingToDataset"), { id: confirmToastId });

      // Ensure the filename is the entity name (with .svg extension)
      const finalFilename = entityName.endsWith('.svg') ? entityName : `${entityName}.svg`;

      // Confirm and add to dataset
      const confirmResult = await SVGDatasetService.confirmGeneratedSVG(
        tempFilename,
        finalFilename
      );

      if (!confirmResult.success || !confirmResult.filename) {
        throw new Error(confirmResult.error || "Failed to add SVG to dataset");
      }

      // Clear preview
      setGeneratedSVG(null);
      setTempFilename(null);

      // Move to next entity
      setCurrentEntityIndex((prev) => prev + 1);

      toast.success(t("svg.generatedAndAddedToDataset"), {
        id: confirmToastId,
      });

      // Regenerate visuals after confirmation
      if (onGenerate) {
        try {
          await onGenerate(confirmToastId);
        } catch (error) {
          console.error("Regeneration after generation failed:", error);
          toast.error(t("svg.generationSucceededRegenerationFailed"), {
            description:
              error instanceof Error
                ? error.message
                : t("svg.failedToRegenerateVisualizations"),
          });
        }
      }

      const hasOtherMissingEntities = missingSVGEntities.length > 1;

      if (!hasOtherMissingEntities && onAllFilesUploaded) {
        onAllFilesUploaded();
      }
    } catch (error) {
      console.error("Confirm generated SVG failed:", error);
      
      let errorTitle = t("svg.failedToAddSVG");
      let errorDescription =
        error instanceof Error
          ? error.message
          : t("errors.unexpectedError");

      toast.error(errorTitle, {
        id: confirmToastId,
        description: errorDescription,
      });
    } finally {
      setGenerateLoading(false);
    }
  }, [tempFilename, missingSVGEntities, currentEntityIndex, generateLoading, uploadLoading, onGenerate, onAllFilesUploaded]);

  const handleDiscardGenerated = useCallback(() => {
    setGeneratedSVG(null);
    setTempFilename(null);
  }, []);

  const handleSelectMissingEntity = useCallback((index: number) => {
    if (
      uploadLoading ||
      index < 0 ||
      index >= missingSVGEntities.length ||
      index === currentEntityIndex
    ) {
      return;
    }

    if (isGeneratingSVG) {
      abortGeneration();
    } else if (generateLoading) {
      return;
    }

    setCurrentEntityIndex(index);
  }, [uploadLoading, missingSVGEntities.length, currentEntityIndex, isGeneratingSVG, abortGeneration, generateLoading]);

  return {
    // state
    isDragOver,
    uploadLoading,
    generateLoading,
    isGeneratingSVG,
    currentEntityIndex,
    generatedSVG,
    tempFilename,
    // refs
    fileInputRef,
    // handlers
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInputChange,
    openFileDialog,
    handleGenerateClick: handleGenerate,
    handleAbortGeneration: abortGeneration,
    handleConfirmGenerated,
    handleDiscardGenerated,
    handleSelectMissingEntity,
    // ui helpers
    getButtonText,
    getButtonIcon,
  } as const;
};


