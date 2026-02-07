import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SparklesLoading } from "@/components/ui/sparkles-loading";
// import { SessionAnalyticsDisplay } from "@/components/ui/SessionAnalyticsDisplay";
import { MwpPromptView } from "@/components/common/MwpPromptView";
import { trackInitialViewRender, isAnalyticsEnabled, trackMWPType } from "@/services/analyticsTracker";
// import { getSessionId } from "@/services/analyticsTracker";
import { useMathProblemForm } from "@/hooks/useMathProblemForm";
import type { useAppState } from "@/hooks/useAppState";

type Props = {
  appState: ReturnType<typeof useAppState>;
};

export function InitialView({ appState }: Props) {
  const { t } = useTranslation();
  const {
    setResults,
    setMpFormLoading,
    mwp,
    formula,
    hint,
    saveInitialValues,
    mpFormLoading,
    handleAbort,
  } = appState;
  const analyticsEnabled = isAnalyticsEnabled();
  // const sessionId = getSessionId();

   const { form, loading, handleSubmit } = useMathProblemForm({
     onSuccess: setResults,
     onLoadingChange: (loadingState, abortFn) => {
       setMpFormLoading(loadingState, abortFn);
     },
     mwp,
     formula,
     hint,
     saveInitialValues,
   });

  // Track initial view render
  useEffect(() => {
    if (analyticsEnabled) {
      trackInitialViewRender();
    }
  }, [analyticsEnabled]);

  const mwpValue = form.watch("mwp");
  const mwpError = form.formState.errors.mwp?.message;

  const handleMwpChange = (value: string) => {
    form.setValue("mwp", value, { shouldDirty: true });
    if (analyticsEnabled) {
      trackMWPType();
    }
  };

  const handleGenerate = () => {
    handleSubmit();
  };

  const isLoading = mpFormLoading || loading;

  {/* floatingContent={analyticsEnabled ? <SessionAnalyticsDisplay sessionId={sessionId} /> : null} */}
  return (
    <MwpPromptView
      mwp={mwpValue}
      onMwpChange={handleMwpChange}
      onSubmit={handleGenerate}
      submitLabel={t("forms.generateButton")}
      loading={isLoading}
      hideSubmit={mpFormLoading}
      errorText={mwpError}
      placeholder={t("forms.mwpPlaceholder")}
      footerContent={
        mpFormLoading ? (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <SparklesLoading onAbort={handleAbort} showAbortButton={true} />
          </div>
        ) : null
      }
    />
  );
}