import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { generationService as service } from "@/api_services/generation";
import { trackFormSubmit, trackError, isAnalyticsEnabled } from "@/services/analyticsTracker";
import { formSchema, type FormData } from "@/schemas/validation";
import type { ComponentMapping } from "@/types/visualInteraction";
import type { ParsedOperation } from "@/utils/dsl-parser";
import { useHighlightingContext } from "@/contexts/HighlightingContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";

interface UseMathProblemFormProps {
  onSuccess: (vl: string, svgFormal: string | null, svgIntuitive: string | null, parsedDSL: ParsedOperation | null, formalError?: string, intuitiveError?: string, missingSvgEntities?: string[], mwp?: string, formula?: string, hint?: string, componentMappings?: ComponentMapping, hasParseError?: boolean) => void;
  onLoadingChange: (loading: boolean, abortFn?: () => void) => void;
  mwp?: string;
  formula?: string;
  hint?: string;
  saveInitialValues: (mwp: string, formula: string, hint: string) => void;
}

export const useMathProblemForm = ({
  onSuccess,
  onLoadingChange,
  mwp = "",
  formula = "",
  hint = "",
  saveInitialValues,
}: UseMathProblemFormProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { clearHighlightingState } = useHighlightingContext();
  const { language } = useLanguage();
  const schema = useMemo(() => formSchema(t), [t]);
  
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      mwp: mwp,
      formula: formula,
      hint: hint,
    },
  });

  // Update form values when initial values change (only for the two-column layout)
  useEffect(() => {
    form.reset({
      mwp: mwp,
      formula: formula,
      hint: hint,
    }, {
      keepDirty: false,
      keepTouched: false,
    });
  }, [mwp, formula, hint]);


  const handleSubmit = async (data: FormData) => {
    clearHighlightingState();
    setLoading(true);
    
    // Track form submission
    if (isAnalyticsEnabled()) {
      trackFormSubmit('math_problem_form_submit', 'mwp: ' + data.mwp + '\nformula: ' + (data.formula || '') + '\nhint: ' + (data.hint || ''));
    }
    
    // Save the form values before generating (so they're preserved on abort)
    await saveInitialValues(data.mwp, data.formula || "", data.hint || "");

    // Create abort controller for this request
    const controller = new AbortController();
    const abort = () => {
      controller.abort();
      setLoading(false);
    };
    
    onLoadingChange(true, abort);

    try {
      const result = await service.generateFromMathProblem(
        data.mwp, 
        data.formula,
        data.hint,
        language,
        controller.signal
      );
      onSuccess(
        result.visual_language,
        result.svg_formal,
        result.svg_intuitive,
        result.parsedDSL,
        result.formal_error || undefined,
        result.intuitive_error || undefined,
        result.missing_svg_entities,
        data.mwp,
        data.formula || "",
        data.hint || "",
        result.componentMappings,
        result.is_parse_error
      );
    } catch (error) {
      console.error('Generation failed:', error);
      
      if (error instanceof Error && error.name !== 'AbortError') {
        // Track error
        if (isAnalyticsEnabled()) {
          trackError('generation_failed', error instanceof Error ? error.message : "An error occurred");
        }
        
        toast.error(error instanceof Error ? error.message : t("errors.unexpectedError"));
      }
    } finally {
      setLoading(false);
      onLoadingChange(false);
    }
  };

  return {
    form,
    loading,
    handleSubmit: form.handleSubmit(handleSubmit),
  };
}; 