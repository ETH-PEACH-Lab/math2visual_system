import { memo, useMemo } from "react";
import type { RefObject } from "react";
import { User } from "lucide-react";
import { FlyingChatbotIcon } from "@/components/ui/flying-chatbot-icon";
import { ChatVisual } from "./ChatVisual";
import type { Message } from "@/hooks/useTutorSession";

type ChatMessagesProps = {
  messages: Message[];
  chatEndRef: RefObject<HTMLDivElement | null>;
  tutorSpeaking: boolean;
  tutorSpeakingIndex: number | null;
};

type ChatMessageItemProps = {
  msg: Message;
  idx: number;
  tutorSpeaking: boolean;
  tutorSpeakingIndex: number | null;
};

const ChatMessageItem = memo(
  ({ msg, idx, tutorSpeaking, tutorSpeakingIndex }: ChatMessageItemProps) => {
  const isStudent = msg.role === "student";
  const alignment = isStudent ? "justify-end" : "justify-start";
  const slide = isStudent ? "slide-in-from-right-4" : "slide-in-from-left-4";
  const contentAlign = isStudent ? "items-end" : "items-start";
  const isTutorSpeaking = tutorSpeaking && tutorSpeakingIndex === idx;
    const botAnimated = Boolean(isTutorSpeaking);
  const visual = useMemo(
    () =>
      msg.visual && msg.visual.svg?.trim()
        ? { ...msg.visual, svg: msg.visual.svg.trim() }
        : null,
    [msg.visual]
  );

  return (
    <div className={`w-full flex ${alignment} gap-2 sm:gap-2.5 md:gap-3 lg:gap-3.5 xl:gap-4 2xl:gap-5 3xl:gap-6 4xl:gap-7 5xl:gap-8 6xl:gap-9 7xl:gap-10 8xl:gap-12`}>
      {!isStudent && (
        <div className="flex items-start select-none">
          <FlyingChatbotIcon
            className="text-muted-foreground"
            animated={botAnimated}
            mouthAnimated={isTutorSpeaking}
            responsive
            minSize={26}
            maxSize={120}
          />
        </div>
      )}
      <div className={`flex flex-col ${contentAlign} space-y-2 sm:space-y-2.5 md:space-y-3 lg:space-y-3.5 xl:space-y-4 2xl:space-y-5 3xl:space-y-6 4xl:space-y-7 5xl:space-y-8 6xl:space-y-9 7xl:space-y-10 8xl:space-y-12`}>
        <div
          className={`responsive-text-font-size inline-block rounded-lg px-3 py-2 sm:px-3.5 sm:py-2.5 md:px-4 md:py-3 lg:px-4.5 lg:py-3.5 xl:px-5 xl:py-4 2xl:px-6 2xl:py-5 3xl:px-7 3xl:py-6 4xl:px-8 4xl:py-7 5xl:px-9 5xl:py-8 6xl:px-10 6xl:py-9 7xl:px-11 7xl:py-10 8xl:px-12 8xl:py-11 max-w-[85%] ${
            isStudent ? "bg-primary text-primary-foreground min-w-[16ch]" : "bg-muted text-foreground"
          } animate-in fade-in-0 ${slide} duration-200`}
        >
          <div 
            className={`${!visual ? 'whitespace-pre-line' : ''}`}
            style={{ 
              overflowWrap: 'normal', 
              wordBreak: 'normal',
              hyphens: 'none'
            }}
          >
            {msg.content}
          </div>
            {msg.streaming && (
              <div className="flex items-center justify-start gap-1 sm:gap-1.5 md:gap-2 lg:gap-2.5 xl:gap-3 2xl:gap-3.5 3xl:gap-4 4xl:gap-5 5xl:gap-6 6xl:gap-7 7xl:gap-8 8xl:gap-9 mt-2 sm:mt-2.5 md:mt-3 lg:mt-3.5 xl:mt-4 2xl:mt-5 3xl:mt-6 4xl:mt-7 5xl:mt-8 6xl:mt-9 7xl:mt-10 8xl:mt-11 pr-1 sm:pr-1.5 md:pr-2 lg:pr-2.5 xl:pr-3 2xl:pr-3.5 3xl:pr-4 4xl:pr-5 5xl:pr-6 6xl:pr-7 7xl:pr-8 8xl:pr-9">
                <span
                  className="h-1 w-1 sm:h-1.5 sm:w-1.5 md:h-2 md:w-2 lg:h-2.5 lg:w-2.5 xl:h-3 xl:w-3 2xl:h-3.5 2xl:w-3.5 3xl:h-4 3xl:w-4 4xl:h-5 4xl:w-5 5xl:h-6 5xl:w-6 6xl:h-7 6xl:w-7 7xl:h-8 7xl:w-8 8xl:h-9 8xl:w-9 aspect-square rounded-full bg-current animate-bounce flex-shrink-0 block"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-1 w-1 sm:h-1.5 sm:w-1.5 md:h-2 md:w-2 lg:h-2.5 lg:w-2.5 xl:h-3 xl:w-3 2xl:h-3.5 2xl:w-3.5 3xl:h-4 3xl:w-4 4xl:h-5 4xl:w-5 5xl:h-6 5xl:w-6 6xl:h-7 6xl:w-7 7xl:h-8 7xl:w-8 8xl:h-9 8xl:w-9 aspect-square rounded-full bg-current animate-bounce flex-shrink-0 block"
                  style={{ animationDelay: "120ms" }}
                />
                <span
                  className="h-1 w-1 sm:h-1.5 sm:w-1.5 md:h-2 md:w-2 lg:h-2.5 lg:w-2.5 xl:h-3 xl:w-3 2xl:h-3.5 2xl:w-3.5 3xl:h-4 3xl:w-4 4xl:h-5 4xl:w-5 5xl:h-6 5xl:w-6 6xl:h-7 6xl:w-7 7xl:h-8 7xl:w-8 8xl:h-9 8xl:w-9 aspect-square rounded-full bg-current animate-bounce flex-shrink-0 block"
                  style={{ animationDelay: "240ms" }}
                />
              </div>
            )}
          </div>
        {visual && (
          <div className="w-full">
            <ChatVisual visual={visual} />
          </div>
        )}
      </div>
      {isStudent && (
        <div className="flex items-start select-none">
          <User className="responsive-icon-font-size text-primary" />
        </div>
      )}
    </div>
  );
});

ChatMessageItem.displayName = "ChatMessageItem";

export const ChatMessages = memo(({
  messages,
  chatEndRef,
  tutorSpeaking,
  tutorSpeakingIndex,
}: ChatMessagesProps) => {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-1 sm:px-1.5 md:px-2 lg:px-3 xl:px-4 2xl:px-5 3xl:px-6 4xl:px-8 5xl:px-10 8xl:px-12 pt-4 pb-2">
      {messages.map((msg, idx) => (
        <ChatMessageItem
          key={idx}
          msg={msg}
          idx={idx}
          tutorSpeaking={tutorSpeaking}
          tutorSpeakingIndex={tutorSpeakingIndex}
        />
      ))}
      <div ref={chatEndRef} />
    </div>
  );
});

ChatMessages.displayName = "ChatMessages";
