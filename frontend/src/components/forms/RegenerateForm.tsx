import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { HighlightableInput } from "@/components/ui/highlightable-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useMathProblemForm } from "@/hooks/useMathProblemForm";
import { trackMWPType, trackFormulaType, trackHintType, isAnalyticsEnabled } from "@/services/analyticsTracker";
import type { ParsedOperation } from "@/utils/dsl-parser";
import type { ComponentMapping } from "@/types/visualInteraction";
import { useHighlightingContext } from "@/contexts/HighlightingContext";
import { MWPTextEntry } from "@/components/ui/mwp-text-entry";

interface RegenerateFormProps {
  onSuccess: (vl: string, svgFormal: string | null, svgIntuitive: string | null, parsedDSL: ParsedOperation | null, formalError?: string, intuitiveError?: string, missingSvgEntities?: string[], mwp?: string, formula?: string, hint?: string, componentMappings?: ComponentMapping, hasParseError?: boolean) => void;
  onLoadingChange: (loading: boolean, abortFn?: () => void) => void;
  mwp?: string;
  formula?: string;
  hint?: string;
  saveInitialValues: (mwp: string, formula: string, hint: string) => void;
  rows?: number;
  isDisabled?: boolean;
  showHintInput?: boolean;
}

export const RegenerateForm = ({ 
  onSuccess, 
  onLoadingChange, 
  mwp = "",
  formula = "",
  hint = "",
  saveInitialValues,
  rows = 8,
  isDisabled = false,
  showHintInput = false,
}: RegenerateFormProps) => {
  const { t } = useTranslation();
  const { mwpHighlightRanges, formulaHighlightRanges, clearHighlightingState } = useHighlightingContext();
  const analyticsEnabled = isAnalyticsEnabled();

  const handleFormClick = useCallback(() => {
    clearHighlightingState();
  }, [clearHighlightingState]);

  const { 
    form, 
    loading,
    handleSubmit,
  } = useMathProblemForm({
    onSuccess,
    onLoadingChange,
    mwp,
    formula,
    hint,
    saveInitialValues,
  });

  const mwpChangeHandler = useCallback((onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void) => 
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e);
      trackMWPType();
    }, []);

  const formulaChangeHandler = useCallback((onChange: (e: React.ChangeEvent<HTMLInputElement>) => void) => 
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e);
      trackFormulaType();
    }, []);

  const handleHintChange = useCallback((onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void) => 
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e);
      trackHintType();
    }, []);

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4 xl:space-y-5 2xl:space-y-6 3xl:space-y-7 4xl:space-y-8 5xl:space-y-9 6xl:space-y-10 7xl:space-y-11" onClick={handleFormClick}>
        <FormField
          control={form.control}
          name="mwp"
          render={({ field }) => (
            <FormItem>
              <div className="relative">
                <label className="absolute -top-2 3xl:-top-4 6xl:-top-6 left-3 bg-background px-1 responsive-smaller-text-font-size text-muted-foreground z-10">
                  {t("forms.mwpLabel")}
                </label>
                <FormControl>
                  <MWPTextEntry
                    {...field}
                    value={field.value}
                    onChange={analyticsEnabled ? mwpChangeHandler(field.onChange) : field.onChange}
                    disabled={isDisabled}
                    placeholder={t("forms.mwpPlaceholder")}
                    rows={rows}
                    highlightRanges={mwpHighlightRanges}
                    textareaClassName="w-full responsive-text-font-size"
                    onSubmit={() => handleSubmit()}
                  />
                </FormControl>
                <FormMessage className="responsive-text-font-size" />
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="formula"
          render={({ field }) => (
            <FormItem>
              <div className="relative">
                <label className="absolute -top-2 3xl:-top-4 6xl:-top-6 left-3 bg-background px-1 responsive-smaller-text-font-size text-muted-foreground z-10">
                  {t("forms.formulaLabel")}
                </label>
                <FormControl>
                  <HighlightableInput
                    className={"w-full responsive-text-font-size"}
                    placeholder={t("forms.formulaPlaceholder")}
                    spellCheck={false}
                    highlightRanges={formulaHighlightRanges}
                    disabled={isDisabled}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    {...field}
                    {...(analyticsEnabled ? {onChange: formulaChangeHandler(field.onChange)} : {})}
                  />
                </FormControl>
                <FormMessage className="responsive-text-font-size" />
              </div>
            </FormItem>
          )}
        />

        {/* Hint input - show when visualizations are present */}
        {showHintInput && (
          <FormField
            control={form.control}
            name="hint"
            render={({ field }) => (
              <FormItem>
                <div className="relative">
                  <label className="absolute -top-2 3xl:-top-4 6xl:-top-6 left-3 bg-background px-1 responsive-smaller-text-font-size text-muted-foreground z-10">
                    {t("forms.hintLabel")}
                  </label>
                  <FormControl>
                    <Textarea
                      className="w-full ring-offset-background responsive-text-font-size"
                      placeholder={t("forms.hintPlaceholder")}
                      rows={6.5}
                      spellCheck={false}
                      disabled={isDisabled}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                      {...field}
                      {...(analyticsEnabled ? {onChange: handleHintChange(field.onChange)} : {})}
                    />
                  </FormControl>
                  <FormMessage className="responsive-text-font-size" />
                </div>
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-center mt-6">
          {!loading && (
            <Button
              type="submit"
              className="min-w-[200px] bg-primary !text-primary-foreground !responsive-text-font-size button-responsive-size px-6 py-3 md:px-8 md:py-4 lg:px-10 lg:py-5 xl:px-12 xl:py-6"
            >
              {t("forms.regenerateButton")}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}; 