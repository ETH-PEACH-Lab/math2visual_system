import type { ApiRequest, ApiResponse } from "@/types";
import { BACKEND_API_URL as API_BASE_URL } from "@/config/api";
import { DSLFormatter } from "@/utils/dsl-formatter";
import { parseWithErrorHandling } from "@/utils/dsl-parser";
import { getHeadersWithLanguage, getCurrentLanguage } from "@/utils/apiHelpers";

export class ApiError extends Error {
  public status?: number;
  
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const generationService = {
  async generateVisualization(request: ApiRequest, abortSignal?: AbortSignal): Promise<ApiResponse> {
    try {
      // Ensure DSL sent to backend is compact to reduce payload and parsing ambiguity
      const requestBody: ApiRequest = request.dsl
        ? { ...request, dsl: DSLFormatter.minify(request.dsl) }
        : request;

      // Set language in request body for GPT generation (also sent via Accept-Language header for error translation)
      requestBody.language = getCurrentLanguage();

      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: getHeadersWithLanguage(),
        body: JSON.stringify(requestBody),
        signal: abortSignal
      });

      const result: ApiResponse = await response.json();

      // Special handling for Visual Language parse errors - return them as successful responses
      // so they can be displayed in the VisualizationResults tabs
      if (!response.ok && result.is_parse_error) {
        return {
          visual_language: request.dsl || "", // Preserve the original DSL input
          svg_formal: null,
          svg_intuitive: null,
          formal_error: result.error,
          intuitive_error: undefined,
          missing_svg_entities: [],
          parsedDSL: null // No valid parsed DSL on parse error
        } as ApiResponse;
      }

      if (!response.ok) {
        throw new ApiError(result.error || "Unknown error", response.status);
      }

      // Frontend service: ensure DSL is formatted and component mappings are computed
      const formatter = new DSLFormatter();
      const parsed = parseWithErrorHandling(result.visual_language || '');
      if (!parsed) {
        // Return original DSL with empty mappings on parse error
        return {
          ...result,
          componentMappings: {},
          parsedDSL: null // Normalize undefined to null
        } as ApiResponse;
      }

      const formattedDSL = formatter.formatWithRanges(parsed);
      return {
        ...result,
        visual_language: formattedDSL,
        componentMappings: { ...formatter.componentRegistry },
        parsedDSL: parsed ?? null // Normalize undefined to null
      } as ApiResponse;
    } catch (error) {
      // Handle abort errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors, JSON parsing errors, etc.
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError("Network error: Could not connect to server");
      }
      
      throw new ApiError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    }
  },

  async generateFromMathProblem(mwp: string, formula?: string, hint?: string, language?: string, abortSignal?: AbortSignal): Promise<ApiResponse> {
    return this.generateVisualization({ mwp, formula, hint, language }, abortSignal);
  },

  async generateFromDSL(dsl: string, abortSignal?: AbortSignal): Promise<ApiResponse> {
    return this.generateVisualization({ dsl }, abortSignal);
  },

};

export { generationService as generationService };
export default generationService; 