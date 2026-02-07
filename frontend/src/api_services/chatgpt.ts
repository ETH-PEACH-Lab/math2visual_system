import { BACKEND_API_URL as API_BASE_URL } from "@/config/api";
import { getHeadersWithLanguage } from "@/utils/apiHelpers";
import { ApiError } from "@/api_services/generation";
import i18n from "@/i18n/config";

export type ChatGPTMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  files?: Array<{ name: string; url: string; type: string }>;
  streaming?: boolean;
};

export type ChatGPTStartResponse = {
  session_id: string;
};

export type ChatGPTMessageResponse = {
  session_id: string;
  message: string;
  images?: string[];
  files?: Array<{ name: string; url: string; type: string }>;
};

type StreamCallbacks = {
  onChunk: (delta: string) => void;
  onDone: (data: ChatGPTMessageResponse) => void;
  onError?: (error: Error) => void;
};

type StreamDonePayload = {
  type: "done";
  session_id: string;
  message: string;
  images?: string[];
  files?: Array<{ name: string; url: string; type: string }>;
};

type StreamChunkPayload = {
  type: "chunk";
  delta: string;
};

type StreamErrorPayload = {
  type: "error";
  error: string;
};

type StreamPayload = StreamChunkPayload | StreamDonePayload | StreamErrorPayload;

/**
 * Generic streaming function for ChatGPT endpoints.
 * Handles SSE parsing and event dispatching.
 */
function createChatGPTStream(
  endpoint: string,
  body: Record<string, any>,
  callbacks: StreamCallbacks
) {
  const controller = new AbortController();

  const startStream = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: getHeadersWithLanguage(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const errorBody = contentType.includes("application/json")
          ? await response.json().catch(() => null)
          : null;
        throw new ApiError(
          errorBody?.error || i18n.t("chatgpt.failedToStreamResponse"),
          response.status
        );
      }

      if (!response.body) {
        throw new Error(i18n.t("chatgpt.streamingNotSupported"));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          if (!rawEvent) continue;

          const payloadStr = rawEvent.replace(/^data:\s*/, "");
          if (!payloadStr) continue;

          let data: StreamPayload;
          try {
            data = JSON.parse(payloadStr) as StreamPayload;
          } catch (parseError) {
            callbacks.onError?.(
              parseError instanceof Error ? parseError : new Error(String(parseError))
            );
            finished = true;
            break;
          }

          if (data.type === "chunk") {
            callbacks.onChunk(data.delta);
          } else if (data.type === "done") {
            callbacks.onDone({
              session_id: data.session_id,
              message: data.message,
              images: data.images,
              files: data.files,
            });
            finished = true;
            break;
          } else if (data.type === "error") {
            callbacks.onError?.(new Error(data.error));
            finished = true;
            break;
          }
        }

        if (done) {
          break;
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  void startStream();

  return () => controller.abort();
}

const chatgptService = {
  async startSession(): Promise<ChatGPTStartResponse> {
    const response = await fetch(`${API_BASE_URL}/chatgpt/start`, {
      method: "POST",
      headers: getHeadersWithLanguage(),
      body: JSON.stringify({}),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new ApiError(result.error || i18n.t("chatgpt.failedToStartSession"), response.status);
    }
    return result as ChatGPTStartResponse;
  },

  sendMessageStream(
    sessionId: string,
    message: string,
    callbacks: StreamCallbacks,
    images?: string[],
    files?: Array<{ name: string; url: string; type: string }>
  ) {
    return createChatGPTStream(
      "/chatgpt/message/stream",
      { session_id: sessionId, message, images, files },
      callbacks
    );
  },

  /**
   * Get a proxied image URL for downloading images that may have CORS restrictions.
   * Returns a blob URL that can be used for downloading.
   */
  async getProxiedImageBlob(imageUrl: string): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/chatgpt/proxy-image?url=${encodeURIComponent(imageUrl)}`,
      {
        method: "GET",
        headers: getHeadersWithLanguage(),
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(
        errorBody?.error || i18n.t("chatgpt.failedToFetchImageViaProxy")
      );
    }

    return await response.blob();
  },
};

export { chatgptService };
export default chatgptService;

