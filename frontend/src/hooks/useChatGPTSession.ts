import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { TFunction } from "i18next";
import chatgptService from "@/api_services/chatgpt";
import { trackChatGPTMessage, isAnalyticsEnabled } from "@/services/analyticsTracker";

export type ChatGPTMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  files?: Array<{ name: string; url: string; type: string }>;
  streaming?: boolean;
};

type UseChatGPTSessionParams = {
  t: TFunction;
};

/**
 * Remove markdown image syntax from text while streaming.
 * This hides ![alt](url) syntax during streaming but keeps it for final rendering.
 * Handles partial matches that might occur when markdown is split across chunks.
 */
function removeMarkdownImages(text: string): string {
  if (!text) return text;
  
  let result = '';
  let i = 0;
  const len = text.length;
  
  while (i < len) {
    // Look for the start of markdown image: ![
    if (text[i] === '!' && i + 1 < len && text[i + 1] === '[') {
      // We found ![ - now we need to find the matching ](url)
      let j = i + 2;
      let foundClosing = false;
      let foundUrlStart = false;
      let foundUrlEnd = false;
      
      // Look for the closing ] of the alt text
      while (j < len && text[j] !== '\n') {
        if (text[j] === ']' && j + 1 < len && text[j + 1] === '(') {
          foundClosing = true;
          foundUrlStart = true;
          j += 2; // Skip ](
          
          // Now look for the closing ) of the URL
          while (j < len) {
            if (text[j] === ')') {
              foundUrlEnd = true;
              j++; // Skip )
              break;
            }
            // Handle escaped characters in URL
            if (text[j] === '\\' && j + 1 < len) {
              j += 2;
              continue;
            }
            j++;
          }
          break;
        }
        j++;
      }
      
      if (foundClosing && foundUrlStart && foundUrlEnd) {
        // Complete markdown image - skip it entirely
        i = j;
        continue;
      } else {
        // Incomplete markdown image - skip from ![ onwards
        // Don't include anything from this point
        break;
      }
    }
    
    // Not part of markdown image - include the character
    result += text[i];
    i++;
  }
  
  // Also remove any orphaned ](url) patterns that might remain
  result = result.replace(/\]\([^)]*\)/g, '');
  
  // Clean up extra whitespace
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

export function useChatGPTSession({ t }: UseChatGPTSessionParams) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatGPTMessage[]>([]);
  const [starting, setStarting] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const streamCloserRef = useRef<null | (() => void)>(null);
  const streamingBufferRef = useRef<string>("");

  const isSessionActive = useMemo(() => !!sessionId, [sessionId]);

  const startSession = useCallback(async () => {
    try {
      setStarting(true);
      streamingBufferRef.current = "";
      const response = await chatgptService.startSession();
      setSessionId(response.session_id);
      // Start with an empty session - user can start chatting immediately
      setMessages([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("errors.unexpectedError");
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }, [t]);

  /**
   * Creates streaming callbacks for ChatGPT responses.
   * Handles chunk processing, message updates, and completion.
   */
  const createStreamingCallbacks = () => {
    return {
      onChunk: (delta: string) => {
        streamingBufferRef.current += delta;
        
        // Remove markdown images from displayed content during streaming
        const cleaned = removeMarkdownImages(streamingBufferRef.current);

        setMessages((prev) => {
          const next = [...prev];
          const idx = next.length - 1;
          if (idx >= 0) {
            // Show cleaned content (without markdown images) while streaming
            next[idx] = { ...next[idx], content: cleaned, streaming: true };
          }
          return next;
        });
      },
      onDone: (data: { session_id: string; message: string; images?: string[]; files?: Array<{ name: string; url: string; type: string }> }) => {
        // Use full content (with markdown images) for final rendering
        const fullText = streamingBufferRef.current || data.message;

        setMessages((prev) => {
          const next = [...prev];
          const idx = next.length - 1;
          if (idx >= 0) {
            next[idx] = {
              role: "assistant",
              content: fullText, // Full markdown with images for proper rendering
              images: data.images,
              files: data.files,
              streaming: false,
            };
          }
          return next;
        });
        setStreaming(false);
        streamingBufferRef.current = "";
      },
      onError: (err: Error) => {
        console.error(err);
        toast.error(t("errors.unexpectedError"));
        setStreaming(false);
        streamingBufferRef.current = "";
        setMessages((prev) => prev.slice(0, -1));
      },
    };
  };

  const sendMessage = useCallback(async (
    userMessage: string,
    images?: string[],
    files?: Array<{ name: string; url: string; type: string }>
  ) => {
    if (!sessionId) {
      toast.error(t("tutor.sessionNotFound"));
      return;
    }
    if (!userMessage.trim() || streaming) {
      return;
    }

    const messageText = userMessage.trim();

    // Track ChatGPT message submission with analytics
    if (isAnalyticsEnabled()) {
      trackChatGPTMessage(messageText);
    }

    setMessages((prev) => [...prev, { role: "user", content: messageText, images, files }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    setStreaming(true);
    streamingBufferRef.current = "";

    streamCloserRef.current = chatgptService.sendMessageStream(
      sessionId,
      messageText,
      createStreamingCallbacks(),
      images,
      files
    );
  }, [sessionId, streaming, t]);

  return {
    sessionId,
    messages,
    starting,
    streaming,
    isSessionActive,
    startSession,
    sendMessage,
  };
}

