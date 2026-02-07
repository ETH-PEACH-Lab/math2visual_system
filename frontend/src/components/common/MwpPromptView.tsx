import { type ReactNode, useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MWPTextEntry } from "@/components/ui/mwp-text-entry";
import { HeroShell } from "@/components/common/HeroShell";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { STRING_SIZE_LIMITS } from "@/utils/validation";

type MwpPromptViewProps = {
  mwp: string;
  onMwpChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  loading?: boolean;
  errorText?: string | null;
  placeholder?: string;
  rows?: number;
  floatingContent?: ReactNode;
  footerContent?: ReactNode;
  showLanguageSelector?: boolean;
  fullScreen?: boolean;
  hideSubmit?: boolean;
  disableSubmit?: boolean;
  title?: string;
  subtitle?: string;
};

export const MwpPromptView = ({
  mwp,
  onMwpChange,
  onSubmit,
  submitLabel,
  loading = false,
  errorText,
  placeholder,
  rows = 5,
  floatingContent,
  footerContent,
  showLanguageSelector = true,
  fullScreen = false,
  hideSubmit = false,
  disableSubmit = false,
  title = "Math2Visual",
  subtitle,
}: MwpPromptViewProps) => {
  const { t } = useTranslation();
  const mwpRef = useRef(mwp);

  useEffect(() => {
    mwpRef.current = mwp;
  }, [mwp]);

  const { listening, voiceSupported, toggleVoice } = useVoiceInput({
    t,
    context: 'mwp',
    onTranscript: (transcript) => {
      const currentValue = mwpRef.current || "";
      const newlineLength = currentValue ? 1 : 0; // '\n' if appending to existing text
      const remainingSpace = STRING_SIZE_LIMITS.MWP_MAX_LENGTH - currentValue.length - newlineLength;
      
      // Slice transcript to fit remaining space, then concatenate
      const truncatedTranscript = transcript.slice(0, Math.max(0, remainingSpace));
      const nextValue = currentValue ? `${currentValue}\n${truncatedTranscript}` : truncatedTranscript;
      onMwpChange(nextValue);
    },
  });

  const micButton = voiceSupported ? (
    <Button
      type="button"
      variant="ghost"
      onClick={toggleVoice}
      disabled={loading || disableSubmit}
      className="h-11 w-11 sm:h-12 sm:w-12 lg:h-13 lg:w-13 xl:h-15 xl:w-15 p-0 flex items-center justify-center rounded-full"
      aria-label={listening ? t("tutor.voiceStop") : t("tutor.voiceStart")}
    >
      {listening ? (
        <Square className="responsive-icon-font-size" />
      ) : (
        <Mic className="responsive-icon-font-size" />
      )}
    </Button>
  ) : undefined;

  const content = (
    <HeroShell
      title={title}
      subtitle={subtitle ?? t("app.subtitle")}
      floatingContent={floatingContent}
      showLanguageSelector={showLanguageSelector}
    >
      <div className="space-y-6">
        <MWPTextEntry
          value={mwp}
          onChange={(e) => onMwpChange(e.target.value)}
          onSubmit={onSubmit}
          placeholder={placeholder ?? t("forms.mwpPlaceholder")}
          errorText={errorText}
          disabled={loading}
          rows={rows}
          trailingContent={micButton}
          maxLength={STRING_SIZE_LIMITS.MWP_MAX_LENGTH}
        />

        <div className="flex flex-col items-center gap-5 sm:gap-6 md:gap-8 lg:gap-10 xl:gap-12 2xl:gap-14 3xl:gap-16 4xl:gap-20 5xl:gap-24 6xl:gap-28 8xl:gap-32">
          {!hideSubmit && (
            <Button
              onClick={onSubmit}
              disabled={loading || disableSubmit}
              className="min-w-[200px] !responsive-text-font-size button-responsive-size px-6 py-3 md:px-8 md:py-4 lg:px-10 lg:py-5 xl:px-12 xl:py-6"
            >
              {submitLabel}
            </Button>
          )}

          {footerContent}
        </div>
      </div>
    </HeroShell>
  );

  if (fullScreen) {
    return <div className="fixed inset-0 overflow-auto bg-background">{content}</div>;
  }

  return content;
};


