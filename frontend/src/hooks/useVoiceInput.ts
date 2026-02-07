import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { TFunction } from "i18next";
import { trackVoiceInputStart, trackVoiceInputComplete, trackVoiceInputError, isAnalyticsEnabled } from "@/services/analyticsTracker";

type RecognitionAlternative = {
  transcript?: string;
};

type RecognitionEvent = {
  results?: Array<Array<RecognitionAlternative>>;
};

type RecognitionErrorEvent = {
  error?: string;
  message?: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  __m2vRecognitionInstance?: SpeechRecognitionInstance;
};

type UseVoiceInputParams = {
  t: TFunction;
  onTranscript: (transcript: string) => void;
  context?: 'mwp' | 'student_message' | 'chatgpt_message';
};

export function useVoiceInput({ t, onTranscript, context = 'mwp' }: UseVoiceInputParams) {
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const analyticsEnabled = isAnalyticsEnabled();

  const getSpeechRecognition = (): SpeechRecognitionConstructor | undefined => {
    if (typeof window === "undefined") return undefined;
    const { SpeechRecognition, webkitSpeechRecognition } = window as SpeechRecognitionWindow;
    return SpeechRecognition || webkitSpeechRecognition;
  };

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (SpeechRecognition) {
      setVoiceSupported(true);
    }
  }, []);

  const toggleVoice = () => {
    if (listening) {
      const recognitionInstance = (window as SpeechRecognitionWindow).__m2vRecognitionInstance;
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      return;
    }

    const SpeechRecognition = getSpeechRecognition()!;
    // Button is only shown when voiceSupported is true, so SpeechRecognition exists

    // Track voice input start
    if (analyticsEnabled) {
      trackVoiceInputStart(context);
    }

    try {
      const recognition = new SpeechRecognition();
      (window as SpeechRecognitionWindow).__m2vRecognitionInstance = recognition;
      recognition.continuous = false;
      recognition.lang = navigator.language || "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: RecognitionEvent) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          // Track voice input completion
          if (analyticsEnabled) {
            trackVoiceInputComplete(context, transcript);
          }
          onTranscript(transcript);
        }
      };

      recognition.onerror = (event: RecognitionErrorEvent) => {
        const errorMessage = event.error || event.message || 'unknown';
        // Track voice input error
        if (analyticsEnabled) {
          trackVoiceInputError(context, errorMessage);
        }
        toast.error(t("tutor.voiceError"));
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      setListening(true);
      recognition.start();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown';
      // Track voice input error
      if (analyticsEnabled) {
        trackVoiceInputError(context, errorMessage);
      }
      setListening(false);
      toast.error(t("tutor.voiceError"));
    }
  };

  return {
    listening,
    voiceSupported,
    toggleVoice,
  };
}

