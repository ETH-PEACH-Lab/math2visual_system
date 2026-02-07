import { SyntaxEditor } from "@/components/ui/syntax-editor";
import { useCallback, useMemo } from "react";
import { findDSLPathAtPosition } from "@/utils/dsl-cursor-mapping";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useVisualLanguageForm } from "@/hooks/useVisualLanguageForm";
import { trackDSLEditorClick, trackDSLType, trackDSLScroll, isAnalyticsEnabled } from "@/services/analyticsTracker";
import type { ComponentMapping } from "@/types/visualInteraction";
import type { ParsedOperation } from "@/utils/dsl-parser";
import { useHighlightingContext } from "@/contexts/HighlightingContext";
import { useDSLContext } from "@/contexts/DSLContext";
import { useTranslation } from "react-i18next";

interface VisualLanguageFormProps {
  onResult: (vl: string, svgFormal: string | null, svgIntuitive: string | null, parsedDSL: ParsedOperation | null, formalError?: string, intuitiveError?: string, missingSvgEntities?: string[], mwp?: string, formula?: string, componentMappings?: ComponentMapping) => void;
  onLoadingChange: (loading: boolean, abortFn?: () => void) => void;
  mwp: string;
  formula: string | null;
  isDisabled?: boolean;
}

export const VisualLanguageForm = ({
  onResult,
  onLoadingChange,
  mwp,
  formula,
  isDisabled = false,
}: VisualLanguageFormProps) => {
  const { t } = useTranslation();
  const { dslHighlightRanges, currentDSLPath, setCurrentDSLPath, clearHighlightingState } = useHighlightingContext();
  const { componentMappings: contextMappings, formattedDSL } = useDSLContext();
  const effectiveMappings = useMemo(() => (contextMappings ?? {}) as ComponentMapping, [contextMappings, formattedDSL]);
  const analyticsEnabled = isAnalyticsEnabled();
  
  const handleCursorPositionChange = useCallback((position: number) => {
    if (isDisabled) return;
    const dslPath = findDSLPathAtPosition(effectiveMappings, position);
    if (dslPath) {
      setCurrentDSLPath(dslPath);
    } else if (currentDSLPath) {
      clearHighlightingState();
    }
    
    // Track DSL editor click with analytics
    if (analyticsEnabled) {
      trackDSLEditorClick(dslPath);
    }
  }, [effectiveMappings, currentDSLPath, setCurrentDSLPath, isDisabled, analyticsEnabled, clearHighlightingState]);

  const { 
    form, 
    handleDebouncedChange,
  } = useVisualLanguageForm({
    onResult,
    onLoadingChange,
    mwp,
    formula,
  });

  

  return (
    <div className="flex flex-col visual-language-form">
      <h2 className="responsive-text-font-size font-semibold mb-3 flex-shrink-0">
        {t("forms.visualLanguageTitle")}
      </h2>
      
      <Form {...form}>
        <div className={`flex flex-col ${isDisabled ? 'pointer-events-none overflow-hidden' : ''}`}>
          <FormField
            control={form.control}
            name="dsl"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormControl>
                  <SyntaxEditor
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      // Only track analytics and trigger debounced change for user-initiated changes
                      // If value matches formattedDSL, it's a programmatic update from popups
                      const isUserInput = value !== formattedDSL;
                      if (isUserInput) {
                        if (analyticsEnabled) {
                          trackDSLType();
                        }
                        handleDebouncedChange(value);
                      }
                    }}
                    className="w-full"
                    highlightRanges={dslHighlightRanges}
                    onCursorPositionChange={handleCursorPositionChange}
                    {...(analyticsEnabled ? {onScroll: (direction: 'up' | 'down') => trackDSLScroll(direction)} : {})}
                  />
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}
          />
        </div>
      </Form>
    </div>
  );
}; 