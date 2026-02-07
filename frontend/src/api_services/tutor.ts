import { BACKEND_API_URL as API_BASE_URL } from "@/config/api";
import { getHeadersWithLanguage } from "@/utils/apiHelpers";
import { ApiError } from "@/api_services/generation";

export type TutorVisual = {
  variant: "formal" | "intuitive";
  svg?: string | null;
  error?: string | null;
  dsl_scope?: string;
  is_parse_error?: boolean;
};

export type TutorStartResponse = {
  session_id: string;
  tutor_message: string;
  visual_language: string;
  visual?: TutorVisual | null;
  suppress_message?: boolean;
};

type StartStreamCallbacks = {
  onChunk: (delta: string) => void;
  onDone: (data: TutorStartResponse) => void;
  onError?: (error: Error) => void;
};

export type TutorMessageResponse = {
  session_id: string;
  tutor_message: string;
  visual?: TutorVisual | null;
  suppress_message?: boolean;
};

type StreamCallbacks = {
  onChunk: (delta: string) => void;
  onDone: (data: TutorMessageResponse) => void;
  onError?: (error: Error) => void;
};

type StreamDonePayload = {
  type: "done";
  session_id: string;
  tutor_message: string;
  visual?: TutorVisual | null;
  visual_language?: string;
  suppress_message?: boolean;
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
 * Generic streaming function for tutor endpoints.
 * Handles SSE parsing and event dispatching.
 */
function createTutorStream<TDone>(
  endpoint: string,
  body: Record<string, string>,
  callbacks: {
    onChunk: (delta: string) => void;
    onDone: (data: TDone) => void;
    onError?: (error: Error) => void;
  },
  transformDone: (data: StreamDonePayload) => TDone
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

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        const errorBody = contentType.includes("application/json")
          ? await response.json().catch(() => null)
          : null;
        throw new ApiError(
          errorBody?.error || "Failed to stream tutor response",
          response.status
        );
      }

      if (!response.body) {
        throw new Error("Streaming not supported in this browser.");
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
            callbacks.onDone(transformDone(data));
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

const tutorService = {
  async startSession(mwp: string | null = null): Promise<TutorStartResponse> {
    const response = await fetch(`${API_BASE_URL}/tutor/start`, {
      method: "POST",
      headers: getHeadersWithLanguage(),
      body: JSON.stringify({ mwp: mwp || null }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new ApiError(result.error || "Failed to start tutor session", response.status);
    }
    return result as TutorStartResponse;
  },

  startSessionStream(mwp: string, callbacks: StartStreamCallbacks) {
    return createTutorStream<TutorStartResponse>(
      "/tutor/start/stream",
      { mwp },
      callbacks,
      (data) => ({
        session_id: data.session_id,
        tutor_message: data.tutor_message,
        visual_language: data.visual_language || "",
        visual: data.visual,
        suppress_message: data.suppress_message,
      })
    );
  },

  sendMessageStream(sessionId: string, message: string, callbacks: StreamCallbacks) {
    return createTutorStream<TutorMessageResponse>(
      "/tutor/message/stream",
      { session_id: sessionId, message },
      callbacks,
      (data) => ({
        session_id: data.session_id,
        tutor_message: data.tutor_message,
        visual: data.visual,
        suppress_message: data.suppress_message,
      })
    );
  },
};

export { tutorService };
export default tutorService;


