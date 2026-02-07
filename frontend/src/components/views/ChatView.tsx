import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useTutorSession } from "@/hooks/useTutorSession";
import { useTutorSpeech } from "@/hooks/useTutorSpeech";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessages } from "./chat/ChatMessages";
import { ChatInputBar } from "./chat/ChatInputBar";
import { STRING_SIZE_LIMITS } from "@/utils/validation";

export function ChatView() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const {
    sessionId,
    messages,
    starting,
    streaming,
    isSessionActive,
    startSession,
    sendMessage,
  } = useTutorSession({ 
    t
  });

  const {
    speechEnabled,
    speechSupported,
    speaking,
    speakingIndex,
    toggleSpeech,
    stopSpeech,
  } = useTutorSpeech({ t, messages });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { listening, voiceSupported, toggleVoice } = useVoiceInput({
    t,
    context: 'student_message',
    onTranscript: (transcript) => {
      setInput((prev) => {
        const currentValue = prev || "";
        const newlineLength = currentValue ? 1 : 0; // '\n' if appending to existing text
        const remainingSpace = STRING_SIZE_LIMITS.MESSAGE_MAX_LENGTH - currentValue.length - newlineLength;
        
        // Slice transcript to fit remaining space, then concatenate
        const truncatedTranscript = transcript.slice(0, Math.max(0, remainingSpace));
        return currentValue ? `${currentValue}\n${truncatedTranscript}` : truncatedTranscript;
      });
    },
  });

  // Auto-start session with null MWP when component mounts
  useEffect(() => {
    if (!isSessionActive && !starting) {
      startSession(null);
    }
  }, [isSessionActive, starting, startSession]);

  // Interrupt tutor speech when student starts recording
  useEffect(() => {
    if (listening && speaking) {
      stopSpeech();
    }
  }, [listening, speaking, stopSpeech]);

  const handleSend = () => {
    if (!input.trim() || streaming || starting) {
      return;
    }

    if (!sessionId) {
      toast.error(t("tutor.sessionNotFound"));
      return;
    }

    const userMessage = input.trim();
    
    // Validate message length (provide user feedback if limit exceeded)
    if (userMessage.length > STRING_SIZE_LIMITS.MESSAGE_MAX_LENGTH) {
      toast.error(t("forms.messageTooLong", { max: STRING_SIZE_LIMITS.MESSAGE_MAX_LENGTH }));
      return;
    }

    // Interrupt tutor speech if speaking
    if (speaking) {
      stopSpeech();
    }

    setInput("");
    sendMessage(userMessage);
  };

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col px-3 py-1 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 3xl:px-20 4xl:px-24 5xl:px-32 8xl:px-48">
      <ChatHeader
        t={t}
        speechEnabled={speechEnabled}
        speechSupported={speechSupported}
        onToggleSpeech={toggleSpeech}
      />

      <div className="flex-1 overflow-hidden">
        <div className="grid gap-4 h-full">
          <div className="rounded-lg border bg-card pb-1 pl-1 pr-1 shadow-sm min-h-[320px] flex flex-col overflow-hidden h-full">
            <ChatMessages
              messages={messages}
              chatEndRef={chatEndRef}
              tutorSpeaking={speaking}
              tutorSpeakingIndex={speakingIndex}
            />

            <div className="flex-shrink-0">
              <ChatInputBar
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
                onVoiceToggle={toggleVoice}
                voiceSupported={voiceSupported}
                listening={listening}
                streaming={streaming || starting}
                t={t}
                placeholder={t("tutor.sendPlaceholder")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


