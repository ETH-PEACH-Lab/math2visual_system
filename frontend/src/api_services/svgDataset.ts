import { BACKEND_BASE_URL as API_BASE_URL } from '@/config/api';
import type { SVGUploadResponse } from '@/types';
import { getHeadersWithLanguage, getCurrentLanguage } from '@/utils/apiHelpers';

export interface SVGFile {
  filename: string;
  name: string;
}

export interface SVGSearchResponse {
  files: SVGFile[];
  query?: string;
}

export class SVGDatasetService {
  /**
   * Generate SVG using AI
   */
  static async generateSVG(entityType: string, signal?: AbortSignal): Promise<{
    success: boolean;
    svg_content?: string;
    temp_filename?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/svg-dataset/generate`, {
        method: 'POST',
        headers: getHeadersWithLanguage(),
        body: JSON.stringify({ 
          entity_type: entityType
        }),
        signal,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `SVG generation failed with status ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('SVG generation error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to generate SVG'
      );
    }
  }

  /**
   * Confirm generated SVG and move it to the dataset
   */
  static async confirmGeneratedSVG(tempFilename: string, finalFilename?: string): Promise<{
    success: boolean;
    filename?: string;
    error?: string;
  }> {
    try {
      const body: { temp_filename: string; final_filename?: string } = {
        temp_filename: tempFilename,
      };
      
      if (finalFilename) {
        body.final_filename = finalFilename;
      }

      const response = await fetch(`${API_BASE_URL}/api/svg-dataset/confirm-generated`, {
        method: 'POST',
        headers: getHeadersWithLanguage(),
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Confirmation of temporary SVG failed with status ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('SVG confirmation error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to confirm SVG'
      );
    }
  }

  /**
   * Search SVG files in the dataset
   */
  static async searchSVGFiles(query: string, limit: number = 20): Promise<SVGSearchResponse> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/svg-dataset/search?query=${encodeURIComponent(query)}&limit=${limit}`,
        {
          headers: getHeadersWithLanguage(),
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('SVG search error:', error);
      throw new Error('Failed to search SVG files');
    }
  }

  /**
   * Check if an SVG name already exists in the dataset
   */
  static async checkSVGNameExists(name: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/svg-dataset/check-exists?name=${encodeURIComponent(name)}`,
        {
          headers: getHeadersWithLanguage(),
        }
      );

      if (!response.ok) {
        throw new Error(`Check failed with status ${response.status}`);
      }

      const result = await response.json();
      return result.exists;
    } catch (error) {
      console.error('SVG name check error:', error);
      throw new Error('Failed to check SVG name');
    }
  }

  /**
   * Upload SVG file to the dataset
   */
  static async uploadSVG(file: File, expectedFilename: string): Promise<SVGUploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('expected_filename', expectedFilename);

      const response = await fetch(`${API_BASE_URL}/api/svg-dataset/upload`, {
        method: 'POST',
        headers: {
          'Accept-Language': getCurrentLanguage(),
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Upload failed with status ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('SVG upload error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to upload SVG file'
      );
    }
  }



}
