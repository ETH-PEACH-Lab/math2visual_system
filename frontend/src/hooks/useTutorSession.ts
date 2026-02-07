import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { TFunction } from "i18next";
import tutorService from "@/api_services/tutor";
import type { TutorVisual } from "@/api_services/tutor";
import { trackStudentMessage, isAnalyticsEnabled } from "@/services/analyticsTracker";

export type Message = {
  role: "student" | "tutor";
  content: string;
  visual?: TutorVisual | null;
  streaming?: boolean;
  accumulated?: string;
};

type UseTutorSessionParams = {
  t: TFunction;
};

export function useTutorSession({ t }: UseTutorSessionParams) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [starting, setStarting] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [hasDsl, setHasDsl] = useState(false); // Track if session has visual_language (DSL)
  const streamCloserRef = useRef<null | (() => void)>(null);
  const streamingBufferRef = useRef<{ raw: string; clean: string }>({ raw: "", clean: "" });

  const isSessionActive = useMemo(() => !!sessionId, [sessionId]);

  const startSession = useCallback(async (mwp: string | null = null) => {
    let started = false;
    try {
      setStarting(true);
      // Reset streaming buffer
      streamingBufferRef.current = { raw: "", clean: "" };
      const response = await tutorService.startSession(mwp ? mwp.trim() : null);
      setSessionId(response.session_id);
      // Track if DSL exists (visual_language is non-empty)
      setHasDsl(!!response.visual_language && response.visual_language.trim().length > 0);
      if (mwp && response.tutor_message) {
        // Track initial MWP message submission with analytics
        if (isAnalyticsEnabled()) {
          trackStudentMessage(mwp.trim());
        }
        // If MWP provided, show both student and tutor messages
        setMessages([
          { role: "student", content: mwp.trim() },
          { role: "tutor", content: response.tutor_message, visual: response.visual },
        ]);
      } else {
        // Autostart mode - show initial tutor message
        setMessages([
          { role: "tutor", content: t("tutor.initialMessage") },
        ]);
      }
      started = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("errors.unexpectedError");
      toast.error(message);
    } finally {
      setStarting(false);
    }
    return started;
  }, [t]);

  const stripVisualLanguage = (text: string): string => {
    // Remove visual_language lines
    let cleaned = text.replace(/visual_language[\s\S]*/i, "");
    
    // Remove VISUAL_REQUEST line - match from VISUAL_REQUEST to end of line (including newline)
    // This preserves text on other lines (like text after VISUAL_REQUEST)
    cleaned = cleaned.replace(/VISUAL_REQUEST[^\n]*\n?/g, '');
    
    return cleaned.trimEnd();
  };

  /**
   * Creates streaming callbacks for tutor responses.
   * Handles chunk processing, message updates, and completion.
   */
  const createStreamingCallbacks = (
    options: {
      setSessionIdOnDone?: (sessionId: string) => void;
    } = {}
  ) => {
    const { setSessionIdOnDone } = options;

    return {
      onChunk: (delta: string) => {
        streamingBufferRef.current.raw += delta || "";

        const cleaned = stripVisualLanguage(streamingBufferRef.current.raw);
        streamingBufferRef.current.clean = cleaned;
        
        setMessages((prev) => {
          const next = [...prev];
          const idx = next.length - 1;
          if (idx >= 0 && next[idx]) {
            next[idx] = { ...next[idx], content: cleaned, streaming: true };
          }
          return next;
        });
      },
      onDone: (data: { session_id: string; tutor_message: string; visual?: TutorVisual | null; suppress_message?: boolean }) => {
        const bufferedClean = streamingBufferRef.current.clean;

        if (data.suppress_message) {
          // Backend decided not to emit a tutor message (e.g., hallucinated NEW_MWP).
          setMessages((prev) => prev.slice(0, -1));
          setStreaming(false);
          streamingBufferRef.current = { raw: "", clean: "" };
          return;
        }

        const safeText = bufferedClean || stripVisualLanguage(data.tutor_message || "");
        const safeVisual =
          data.visual && data.visual.dsl_scope
            ? { ...data.visual, dsl_scope: undefined }
            : data.visual;

        // Set session ID if callback provided (for new sessions)
        if (setSessionIdOnDone) {
          setSessionIdOnDone(data.session_id);
        }

        setMessages((prev) => {
          const next = [...prev];
          const idx = next.length - 1;
          if (idx >= 0 && next[idx]) {
            next[idx] = {
              role: "tutor",
              content: safeText,
              visual: safeVisual,
              streaming: false,
            };
          }
          return next;
        });
        setStreaming(false);
        streamingBufferRef.current = { raw: "", clean: "" };
      },
      onError: (err: Error) => {
        console.error(err);
        toast.error(t("tutor.streamingError"));
        setStreaming(false);
        streamingBufferRef.current = { raw: "", clean: "" };
        setMessages((prev) => prev.slice(0, -1));
      },
    };
  };

  const resetSession = useCallback(() => {
    // Stop any ongoing stream
    if (streamCloserRef.current) {
      streamCloserRef.current();
      streamCloserRef.current = null;
    }
    // Reset all state
    setSessionId(null);
    setMessages([]);
    setStarting(false);
    setStreaming(false);
    setHasDsl(false);
    streamingBufferRef.current = { raw: "", clean: "" };
  }, []);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!sessionId) {
      toast.error(t("tutor.sessionNotFound"));
      return;
    }
    if (!userMessage.trim() || streaming) {
      return;
    }

    const messageText = userMessage.trim();
    
    // Track student message submission with analytics
    if (isAnalyticsEnabled()) {
      trackStudentMessage(messageText);
    }
    
    setMessages((prev) => [...prev, { role: "student" as const, content: messageText }]);
    setMessages((prev) => [...prev, { role: "tutor" as const, content: "", streaming: true }]);

    setStreaming(true);

    streamingBufferRef.current = { raw: "", clean: "" };

    streamCloserRef.current = tutorService.sendMessageStream(
      sessionId,
      messageText,
      createStreamingCallbacks({
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, streaming, t]);

  return {
    sessionId,
    messages,
    starting,
    streaming,
    isSessionActive,
    hasDsl,
    startSession,
    sendMessage,
    resetSession,
  };
}

