import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useChatGPTSession } from "@/hooks/useChatGPTSession";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { ChatInputBar } from "./chat/ChatInputBar";
import { STRING_SIZE_LIMITS } from "@/utils/validation";
import { trackChatGPTImageDownloadStart, trackChatGPTImageDownloadComplete, trackError, isAnalyticsEnabled } from "@/services/analyticsTracker";
import { User, Download } from "lucide-react";
import { memo } from "react";
import type { RefObject } from "react";
import type { ChatGPTMessage } from "@/hooks/useChatGPTSession";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import chatgptService from "@/api_services/chatgpt";

// ChatGPT Messages Component
type ChatGPTMessagesProps = {
  messages: ChatGPTMessage[];
  chatEndRef: RefObject<HTMLDivElement | null>;
};

type ChatGPTMessageItemProps = {
  msg: ChatGPTMessage;
};

/**
 * Download an image from a URL
 * Handles CORS issues by proxying through the backend for external URLs
 */
const downloadImage = async (imageUrl: string, alt: string = "image", t: (key: string, params?: any) => string) => {
  let toastId: string | number | undefined;
  const analyticsEnabled = isAnalyticsEnabled();
  
  try {
    // Show loading toast
    toastId = toast.loading(t("download.preparing", { format: "Image" }));
    
    let blob: Blob;
    let contentType = "image/png";
    
    // Check if this is an external URL (not data URI and not from same origin)
    const isExternalUrl = imageUrl.startsWith("http://") || imageUrl.startsWith("https://");
    const isDataUri = imageUrl.startsWith("data:");
    
    if (isExternalUrl && !isDataUri) {
      // Use backend proxy for external URLs to avoid CORS issues
      try {
        blob = await chatgptService.getProxiedImageBlob(imageUrl);
        contentType = blob.type || "image/png";
      } catch (proxyError) {
        console.error("Proxy download failed, trying direct fetch:", proxyError);
        // Fallback to direct fetch (might still fail due to CORS)
        const response = await fetch(imageUrl, { mode: "cors" });
        if (!response.ok) {
          throw new Error(t("chatgpt.failedToFetchImage"));
        }
        blob = await response.blob();
        contentType = response.headers.get("content-type") || "image/png";
      }
    } else if (isDataUri) {
      // Handle data URIs
      const response = await fetch(imageUrl);
      blob = await response.blob();
      contentType = blob.type || "image/png";
    } else {
      // Try direct fetch for same-origin URLs
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) {
        throw new Error(t("chatgpt.failedToFetchImage"));
      }
      blob = await response.blob();
      contentType = response.headers.get("content-type") || "image/png";
    }
    
    // Determine file extension from content type
    const mimeToExt: Record<string, 'jpg' | 'png' | 'gif' | 'webp'> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const extension: 'jpg' | 'png' | 'gif' | 'webp' = mimeToExt[contentType.toLowerCase()] || 'png';
    
    // Generate filename
    const filename = alt !== "Image" 
      ? `${alt.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${extension}`
      : `chatgpt-image-${Date.now()}.${extension}`;
    
    // Track download start (before actual download)
    if (analyticsEnabled) {
      trackChatGPTImageDownloadStart(extension, filename);
    }
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    // Track successful download completion (after download completes)
    if (analyticsEnabled) {
      trackChatGPTImageDownloadComplete(extension, filename);
    }
    
    // Show success toast
    toast.success(t("download.success", { format: "Image" }), {
      id: toastId,
      description: t("download.savedToFolder", { title: filename }),
    });
  } catch (error) {
    console.error("Error downloading image:", error);
    
    // Track download error
    if (analyticsEnabled) {
      trackError('chatgpt_image_download_failed', error instanceof Error ? error.message : "Download failed");
    }
    
    toast.error(t("download.error", { format: "Image" }), {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : t("download.unexpectedError"),
    });
  }
};

const ChatGPTMessageItem = memo(({ msg }: ChatGPTMessageItemProps) => {
  const { t } = useTranslation();
  const isUser = msg.role === "user";
  const alignment = isUser ? "justify-end" : "justify-start";
  const slide = isUser ? "slide-in-from-right-4" : "slide-in-from-left-4";
  const contentAlign = isUser ? "items-end" : "items-start";

  // Extract image URLs from markdown and remove markdown image syntax
  const { cleanedContent, extractedImages } = useMemo(() => {
    if (isUser || !msg.content) {
      return { cleanedContent: msg.content, extractedImages: [] };
    }

    // Extract image URLs from markdown: ![alt](url)
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const extractedImages: string[] = [];
    let match;
    while ((match = imageRegex.exec(msg.content)) !== null) {
      const url = match[1];
      if (url.startsWith('http') || url.startsWith('data:')) {
        extractedImages.push(url);
      }
    }

    // Remove markdown image syntax from content
    const cleanedContent = msg.content.replace(imageRegex, '').trim();

    return { cleanedContent, extractedImages };
  }, [msg.content, isUser]);

  // Combine extracted images with msg.images (avoid duplicates)
  const allImages = useMemo(() => {
    const images = new Set<string>();
    msg.images?.forEach(img => images.add(img));
    extractedImages.forEach(img => images.add(img));
    return Array.from(images);
  }, [msg.images, extractedImages]);

  return (
    <div className={`w-full flex ${alignment} gap-2 sm:gap-2.5 md:gap-3 lg:gap-3.5 xl:gap-4 2xl:gap-5 3xl:gap-6 4xl:gap-7 5xl:gap-8 6xl:gap-9 7xl:gap-10 8xl:gap-12`}>
      {!isUser && (
        <div className="flex items-start select-none">
          <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 2xl:w-12 2xl:h-12 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 5xl:w-22 5xl:h-22 6xl:w-24 6xl:h-24 7xl:w-26 7xl:h-26 8xl:w-28 8xl:h-28 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold responsive-text-font-size">
            AI
          </div>
        </div>
      )}
      <div className={`flex flex-col ${contentAlign} space-y-2 sm:space-y-2.5 md:space-y-3 lg:space-y-3.5 xl:space-y-4 2xl:space-y-5 3xl:space-y-6 4xl:space-y-7 5xl:space-y-8 6xl:space-y-9 7xl:space-y-10 8xl:space-y-12`}>
        <div
          className={`responsive-text-font-size inline-block rounded-lg px-3 py-2 sm:px-3.5 sm:py-2.5 md:px-4 md:py-3 lg:px-4.5 lg:py-3.5 xl:px-5 xl:py-4 2xl:px-6 2xl:py-5 3xl:px-7 3xl:py-6 4xl:px-8 4xl:py-7 5xl:px-9 5xl:py-8 6xl:px-10 6xl:py-9 7xl:px-11 7xl:py-10 8xl:px-12 8xl:py-11 max-w-[85%] ${
            isUser ? "bg-primary text-primary-foreground min-w-[12ch]" : "bg-muted text-foreground"
          } animate-in fade-in-0 ${slide} duration-200`}
        >
          <div 
            className={`prose prose-sm dark:prose-invert max-w-none ${
              isUser ? "prose-invert whitespace-pre-line" : ""
            }`}
            style={{ 
              overflowWrap: 'normal', 
              wordBreak: 'normal',
              hyphens: 'none'
            }}
          >
            {isUser ? (
              msg.content
            ) : (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="ml-2">{children}</li>,
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-muted/50 px-1 py-0.5 rounded responsive-text-font-size">{children}</code>
                    ) : (
                      <code className="block bg-muted/50 p-2 rounded responsive-text-font-size overflow-x-auto">{children}</code>
                    );
                  },
                  pre: ({ children }) => <pre className="bg-muted/50 p-2 rounded responsive-text-font-size overflow-x-auto mb-2">{children}</pre>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      {children}
                    </a>
                  ),
                  // Don't render images inline - they'll be shown separately below
                  img: () => null,
                }}
              >
                {cleanedContent}
              </ReactMarkdown>
            )}
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
        {/* Display images if present (extracted from markdown or function calls) */}
        {allImages.length > 0 && (
          <div className="flex flex-col gap-2 sm:gap-2.5 md:gap-3 lg:gap-3.5 xl:gap-4 2xl:gap-5 3xl:gap-6 4xl:gap-7 5xl:gap-8 6xl:gap-9 7xl:gap-10 8xl:gap-12">
            {allImages.map((img, imgIdx) => (
              <div key={imgIdx} className="relative group">
                <img
                  src={img.startsWith("data:") || img.startsWith("http") ? img : `data:image/jpeg;base64,${img}`}
                  alt={t("chatgpt.imageAlt", { number: imgIdx + 1 })}
                  className="max-w-full max-h-96 xl:max-h-[500px] 2xl:max-h-[600px] 3xl:max-h-[700px] 4xl:max-h-[800px] 5xl:max-h-[900px] 6xl:max-h-[1000px] 7xl:max-h-[1100px] 8xl:max-h-[1200px] rounded-lg object-contain border border-border"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 md:top-3 md:right-3 lg:top-3.5 lg:right-3.5 xl:top-4 xl:right-4 2xl:top-5 2xl:right-5 3xl:top-6 3xl:right-6 4xl:top-7 4xl:right-7 5xl:top-8 5xl:right-8 6xl:top-9 6xl:right-9 7xl:top-10 7xl:right-10 8xl:top-11 8xl:right-11 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm shadow-md hover:bg-background"
                  onClick={() => downloadImage(img, t("chatgpt.imageAlt", { number: imgIdx + 1 }), t)}
                  title={t("chatgpt.downloadImage")}
                >
                  <Download className="responsive-icon-font-size" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {/* Display files if present */}
        {msg.files && msg.files.length > 0 && (
          <div className="flex flex-col gap-2 sm:gap-2.5 md:gap-3 lg:gap-3.5 xl:gap-4 2xl:gap-5 3xl:gap-6 4xl:gap-7 5xl:gap-8 6xl:gap-9 7xl:gap-10 8xl:gap-12">
            {msg.files.map((file, fileIdx) => (
              <a
                key={fileIdx}
                href={file.url}
                download={file.name}
                className="flex items-center gap-2 sm:gap-2.5 md:gap-3 lg:gap-3.5 xl:gap-4 2xl:gap-5 3xl:gap-6 4xl:gap-7 5xl:gap-8 6xl:gap-9 7xl:gap-10 8xl:gap-12 p-2 sm:p-2.5 md:p-3 lg:p-3.5 xl:p-4 2xl:p-5 3xl:p-6 4xl:p-7 5xl:p-8 6xl:p-9 7xl:p-10 8xl:p-11 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <span className="responsive-text-font-size">{file.name}</span>
                <span className="responsive-text-font-size text-muted-foreground">({file.type})</span>
              </a>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex items-start select-none">
          <User className="responsive-icon-font-size text-primary" />
        </div>
      )}
    </div>
  );
});

ChatGPTMessageItem.displayName = "ChatGPTMessageItem";

const ChatGPTMessages = memo(({ messages, chatEndRef }: ChatGPTMessagesProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-1 sm:px-1.5 md:px-2 lg:px-3 xl:px-4 2xl:px-5 3xl:px-6 4xl:px-8 5xl:px-10 8xl:px-12 pt-4 pb-2">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground responsive-text-font-size">
            {t("chatgpt.startConversation")}
          </p>
        </div>
      )}
      {messages.map((msg, idx) => (
        <ChatGPTMessageItem key={idx} msg={msg} />
      ))}
      <div ref={chatEndRef} />
    </div>
  );
});

ChatGPTMessages.displayName = "ChatGPTMessages";

// ChatGPT Header Component
const ChatGPTHeader = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between py-1 sm:py-1.5 md:py-2">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 2xl:w-12 2xl:h-12 3xl:w-14 3xl:h-14 4xl:w-16 4xl:h-16 5xl:w-18 5xl:h-18 6xl:w-20 6xl:h-20 7xl:w-22 7xl:h-22 8xl:w-24 8xl:h-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold responsive-text-font-size">
          AI
        </div>
        <h2 className="font-semibold responsive-text-font-size">{t("chatgpt.title")}</h2>
      </div>
    </div>
  );
};

export function ChatGPTView() {
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
  } = useChatGPTSession({ t });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { listening, voiceSupported, toggleVoice } = useVoiceInput({
    t,
    context: 'chatgpt_message',
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

  // Auto-start session when component mounts
  useEffect(() => {
    if (!isSessionActive && !starting) {
      startSession();
    }
  }, [isSessionActive, starting, startSession]);

  const handleSend = () => {
    if (!input.trim() || streaming || starting) {
      return;
    }

    if (!sessionId) {
      toast.error(t("tutor.sessionNotFound"));
      return;
    }

    const userMessage = input.trim();

    // Validate message length
    if (userMessage.length > STRING_SIZE_LIMITS.MESSAGE_MAX_LENGTH) {
      toast.error(t("forms.messageTooLong", { max: STRING_SIZE_LIMITS.MESSAGE_MAX_LENGTH }));
      return;
    }

    setInput("");
    sendMessage(userMessage);
  };

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col px-3 py-1 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 3xl:px-20 4xl:px-24 5xl:px-32 8xl:px-48">
      <ChatGPTHeader />

      <div className="flex-1 overflow-hidden">
        <div className="rounded-lg border bg-card pb-1 pl-1 pr-1 shadow-sm min-h-[320px] flex flex-col overflow-hidden h-full">
            <ChatGPTMessages messages={messages} chatEndRef={chatEndRef} />

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
                placeholder={t("chatgpt.inputPlaceholder")}
                context="chatgpt"
              />
            </div>
          </div>
      </div>
    </div>
  );
}

