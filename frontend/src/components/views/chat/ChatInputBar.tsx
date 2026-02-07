import type { TFunction } from "i18next";
import { Mic, Square, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STRING_SIZE_LIMITS } from "@/utils/validation";
import { trackMessageButtonClick, trackMessageEnterKey, isAnalyticsEnabled } from "@/services/analyticsTracker";

type ChatInputBarProps = {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onVoiceToggle: () => void;
  voiceSupported: boolean;
  listening: boolean;
  streaming: boolean;
  t: TFunction;
  placeholder?: string;
  context?: 'student' | 'chatgpt';
};

export const ChatInputBar = ({
  input,
  onInputChange,
  onSend,
  onVoiceToggle,
  voiceSupported,
  listening,
  streaming,
  t,
  placeholder,
  context = 'student',
}: ChatInputBarProps) => {
  const analyticsEnabled = isAnalyticsEnabled();

  return (
    <div className="relative rounded-md border border-input bg-background text-foreground shadow-sm">
      <Textarea
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={placeholder ?? t("tutor.sendPlaceholder")}
        spellCheck={false}
        rows={2}
        maxLength={STRING_SIZE_LIMITS.MESSAGE_MAX_LENGTH}
        className="w-full responsive-text-font-size border-0 bg-transparent p-3 pr-24 sm:pr-28 md:pr-32 lg:pr-36 xl:pr-40 2xl:pr-44 3xl:pr-48 4xl:pr-52 5xl:pr-56 6xl:pr-60 8xl:pr-64 shadow-none resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (analyticsEnabled) {
              trackMessageEnterKey(context);
            }
            onSend();
          }
        }}
      />
      <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 md:right-5 flex items-center gap-0.5 sm:gap-0.5 md:gap-0.5 lg:gap-1 xl:gap-2 2xl:gap-4 3xl:gap-6 4xl:gap-8 5xl:gap-12 6xl:gap-14 8xl:gap-16">
        {voiceSupported && (
          <Button
            type="button"
            variant="ghost"
            onClick={onVoiceToggle}
            disabled={streaming}
            className="h-11 w-11 sm:h-12 sm:w-12 lg:h-13 lg:w-13 xl:h-15 xl:w-15 p-0 flex items-center justify-center rounded-full"
            aria-label={listening ? t("tutor.voiceStop") : t("tutor.voiceStart")}
          >
            {listening ? (
              <Square className="responsive-icon-font-size" />
            ) : (
              <Mic className="responsive-icon-font-size" />
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (analyticsEnabled) {
              trackMessageButtonClick(context);
            }
            onSend();
          }}
          disabled={streaming}
          className="p-0 flex items-center justify-center rounded-full bg-black text-white hover:bg-black/90 hover:text-white shadow-sm"
          style={{
            width: "clamp(48px, 2.6vw, 88px)",
            height: "clamp(48px, 2.6vw, 88px)",
          }}
          aria-label={t("tutor.send")}
        >
          <ArrowUp className="responsive-icon-font-size" />
        </Button>
      </div>
    </div>
  );
};

