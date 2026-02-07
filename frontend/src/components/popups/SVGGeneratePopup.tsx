import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { SVGDatasetService } from '@/api_services/svgDataset';
import { BasePopup } from './BasePopup.tsx';
import { trackPopupSubmit, trackPopupCancel, isAnalyticsEnabled } from '@/services/analyticsTracker';
import { useTranslation } from 'react-i18next';

interface SVGGeneratePopupProps {
  onClose: () => void;
  onGenerate: (filename: string) => Promise<void>;
  sanitizedEntityType: string;
}

export const SVGGeneratePopup: React.FC<SVGGeneratePopupProps> = ({
  onClose,
  onGenerate,
  sanitizedEntityType,
}) => {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(true);
  const [generatedSVG, setGeneratedSVG] = useState<string | null>(null);
  const [tempFilename, setTempFilename] = useState<string | null>(null);
  const analyticsEnabled = isAnalyticsEnabled();
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate SVG on mount
  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const generateSVG = async () => {
      try {
        const result = await SVGDatasetService.generateSVG(sanitizedEntityType, controller.signal);
        
        if (!result.success || !result.svg_content || !result.temp_filename) {
          throw new Error(result.error || 'Generation failed');
        }

        setGeneratedSVG(result.svg_content);
        setTempFilename(result.temp_filename);
        setIsGenerating(false);
      } catch (err) {
        // Don't show error if request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('SVG generation failed:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to generate SVG';
        toast.error(errorMsg);
        onClose();
      }
    };

    generateSVG();
  }, [sanitizedEntityType, onClose]);

  // Handle confirmation (double-click or Enter)
  const handleConfirm = async () => {
    if (!tempFilename || isGenerating) return;

    try {
      if (analyticsEnabled) {
        trackPopupSubmit('svg_generate', tempFilename);
      }

      // Move temp file to dataset
      const result = await SVGDatasetService.confirmGeneratedSVG(tempFilename);
      
      if (!result.success || !result.filename) {
        throw new Error(result.error || 'Failed to confirm SVG');
      }

      // Extract the name without extension
      const svgName = result.filename.replace(/\.svg$/i, '');
      
      // Trigger visual regeneration
      await onGenerate(svgName);
      onClose();
    } catch (err) {
      console.error('Failed to confirm generated SVG:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to confirm SVG');
    }
  };

  // Handle cancellation (click outside)
  const handleCancel = useCallback(async () => {
    // Track cancellation
    if (analyticsEnabled) {
      trackPopupCancel('svg_generate', 'click_outside');
    }

    // Abort ongoing generation
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort('SVG generation cancelled by user');
    }

    onClose();
  }, [analyticsEnabled, isGenerating, onClose]);

  // Handle keyboard events
  const handlePopupKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && generatedSVG && !isGenerating) {
      event.preventDefault();
      if (analyticsEnabled) {
        trackPopupSubmit('svg_generate', tempFilename || '', 'keyboard');
      }
      handleConfirm();
    }
  };

  return (
    <BasePopup 
      onClose={handleCancel} 
      onKeyDown={handlePopupKeyDown}
      className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-[18rem] lg:h-[18rem] xl:w-[20rem] xl:h-[20rem] 2xl:w-[22rem] 2xl:h-[22rem] 3xl:w-[24rem] 3xl:h-[24rem] 4xl:w-[26rem] 4xl:h-[26rem] 5xl:w-[28rem] 5xl:h-[28rem] flex items-center justify-center overflow-hidden"
    >
      {isGenerating ? (
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative">
            <Loader2 className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-16 lg:h-16 xl:w-18 xl:h-18 2xl:w-20 2xl:h-20 3xl:w-24 3xl:h-24 4xl:w-28 4xl:h-28 5xl:w-32 5xl:h-32 text-blue-500 animate-spin" />
            <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-8 lg:h-8 xl:w-9 xl:h-9 2xl:w-10 2xl:h-10 3xl:w-12 3xl:h-12 4xl:w-14 4xl:h-14 5xl:w-16 5xl:h-16 text-yellow-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="responsive-text-font-size text-gray-600 text-center">
            {t("svg.generatePopup.generating", { entityType: sanitizedEntityType })}
          </p>
        </div>
      ) : generatedSVG ? (
        <div 
          ref={containerRef}
          className="w-full h-full cursor-pointer hover:bg-gray-50 transition-colors rounded-lg p-3 sm:p-3 md:p-4 lg:p-4 xl:p-4 2xl:p-5 3xl:p-5 4xl:p-6 5xl:p-6"
          onDoubleClick={handleConfirm}
        >
          <div 
            className="svg-preview-container w-full flex items-center justify-center"
            style={{ height: 'calc(100% - 3rem)' }}
            dangerouslySetInnerHTML={{ __html: generatedSVG }}
          />
          <p className="responsive-smaller-text-font-size text-gray-500 text-center flex items-center justify-center" style={{ height: '3rem' }}>
            {t("svg.generatePopup.confirmInstruction")}
          </p>
        </div>
      ) : null}
    </BasePopup>
  );
};

