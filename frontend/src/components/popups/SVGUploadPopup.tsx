import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, ArrowRight, AlertCircle, Image } from 'lucide-react';
import { validateFormatAsync } from '@/utils/validation';
import { SVGDatasetService } from '@/api_services/svgDataset';
import { BasePopup } from './BasePopup.tsx';
import { 
  InputGroup, 
  InputGroupAddon, 
  InputGroupButton, 
  InputGroupInput 
} from '@/components/ui/input-group';
import { trackSVGUploadPopupType, trackPopupSubmit, trackPopupCancel, trackElementClick, isAnalyticsEnabled } from '@/services/analyticsTracker';
import { useTranslation } from 'react-i18next';

interface SVGUploadPopupProps {
  onClose: () => void;
  onUpload: (filename: string) => Promise<void>;
}

export const SVGUploadPopup: React.FC<SVGUploadPopupProps> = ({
  onClose,
  onUpload,
}) => {
  const { t } = useTranslation();
  const [filename, setFilename] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filenameInputRef = useRef<HTMLInputElement>(null);
  const analyticsEnabled = isAnalyticsEnabled();

  // Handle cancel (click outside)
  const handleCancel = useCallback(() => {
    if (analyticsEnabled) {
      trackPopupCancel('svg_upload', 'click_outside');
    }
    onClose();
  }, [analyticsEnabled, onClose]);

  // Real-time validation for filename
  useEffect(() => {
    const validateName = async () => {
      if (filename.trim()) {
        const validation = await validateFormatAsync(filename.trim());
        setValidationError(validation.valid ? null : validation.error || null);
      } else {
        setValidationError(null);
      }
    };

    const timeoutId = setTimeout(validateName, 500);
    return () => clearTimeout(timeoutId);
  }, [filename]);

  // Handle file input change
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      // Auto-fill name if not already set
      if (!filename.trim()) {
        const nameWithoutExt = file.name.replace(/\.svg$/i, '');
        setFilename(nameWithoutExt);
      }
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!uploadFile || !filename.trim()) {
      setError(t("svg.uploadPopup.selectFileAndName"));
      return;
    }

    // Frontend validation for the file name
    const validation = await validateFormatAsync(filename.trim());
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const result = await SVGDatasetService.uploadSVG(uploadFile, `${filename.trim()}.svg`);

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Trigger callback with the uploaded filename
      await onUpload(filename.trim());
      onClose();
      
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle keyboard events for popup
  const handlePopupKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && isValidSelection && !isUploading) {
      event.preventDefault();
      if (analyticsEnabled) {
        trackPopupSubmit('svg_upload', filename.trim(), 'keyboard');
      }
      handleUpload();
    }
  };

  // Auto-focus filename input when popup opens and reset state when popup closes
  useEffect(() => {
    filenameInputRef.current?.focus();
    
    // Cleanup on unmount
    const inputEl = fileInputRef.current;
    return () => {
      setFilename('');
      setUploadFile(null);
      setIsUploading(false);
      setValidationError(null);
      setError(null);
      if (inputEl) {
        inputEl.value = '';
      }
    };
  }, []);

  const isValidSelection = uploadFile && filename.trim() && !validationError;

  return (
    <BasePopup onClose={handleCancel} onKeyDown={handlePopupKeyDown} className="popup-upload-width max-h-[90vh]">
      {/* Upload Form */}
      <InputGroup className="popup-button-responsive-height overflow-hidden border-ring ring-ring/50 ring-[3px]">
        <InputGroupAddon className="pl-2">
          <button
            onClick={() => {
              if (analyticsEnabled) {
                trackElementClick('svg_upload_file_select_click');
              }
              fileInputRef.current?.click();
            }}
            className="h-full flex items-center justify-center px-3 3xl:px-6 text-muted-foreground hover:text-foreground transition-colors touch-manipulation text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded duration-200 popup-button-responsive-height"
            title={t("svg.uploadPopup.chooseFile")}
            disabled={isUploading}
          >
            <Upload className="responsive-smaller-icon-font-size" />
          </button>
        </InputGroupAddon>
        <InputGroupInput
          ref={filenameInputRef}
          value={filename}
          onChange={(e) => {
            setFilename(e.target.value);
            if (analyticsEnabled) {
              trackSVGUploadPopupType(e.target.value);
            }
          }}
          placeholder={t("svg.uploadPopup.enterName")}
          spellCheck={false}
          className="text-black responsive-text-font-size touch-manipulation !px-3"
          disabled={isUploading}
        />
        <InputGroupAddon align="inline-end" className="pr-1.5 gap-0">
          {uploadFile && (
            <InputGroupButton
              size="sm"
              variant="ghost"
              onClick={() => {
                if (analyticsEnabled) {
                  trackElementClick(`svg_upload_preview_click`, uploadFile.name);
                }
                const url = URL.createObjectURL(uploadFile);
                window.open(url, '_blank');
                // Clean up the object URL after a short delay
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
              disabled={isUploading}
              title={t("svg.uploadPopup.viewInNewTab", { filename: uploadFile.name })}
              className="popup-button-responsive-height touch-manipulation rounded-l-none"
            >
              <Image className="responsive-smaller-icon-font-size" />
            </InputGroupButton>
          )}
          <InputGroupButton
            onClick={() => {
              if (analyticsEnabled) {
                trackPopupSubmit('svg_upload', filename.trim());
              }
              handleUpload();
            }}
            disabled={!isValidSelection || isUploading}
            size="sm"
            variant="default"
            className="!text-primary-foreground popup-button-responsive-height touch-manipulation rounded-l-none rounded-r-md"
          >
            {isUploading ? (
              <div className="animate-spin rounded-full responsive-smaller-icon-font-size border-b-2 border-white" />
            ) : (
              <ArrowRight className="responsive-smaller-icon-font-size" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Validation error message (real-time) */}
      {validationError && (
        <div className="flex items-center gap-2 text-red-600 responsive-text-font-size mt-1">
          <AlertCircle className="responsive-smaller-icon-font-size" />
          {validationError}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 responsive-text-font-size mt-1">
          <AlertCircle className="responsive-smaller-icon-font-size" />
          {error}
        </div>
      )}

      {/* Upload status */}
      {isUploading && (
        <div className="responsive-text-font-size text-blue-600 mt-1">{t("svg.uploading")}</div>
      )}
    </BasePopup>
  );
};
