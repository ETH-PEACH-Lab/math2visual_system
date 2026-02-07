import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowRight, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SVGDatasetService } from '@/api_services/svgDataset';
import { BasePopup } from './BasePopup.tsx';
import { 
  InputGroup, 
  InputGroupAddon, 
  InputGroupButton, 
  InputGroupInput 
} from '@/components/ui/input-group';
import { trackSVGSearchPopupType, trackPopupSubmit, trackPopupCancel, isAnalyticsEnabled } from '@/services/analyticsTracker';
import { useTranslation } from 'react-i18next';
import { BACKEND_API_URL } from '@/config/api';

interface SVGFile {
  filename: string;
  name: string;
}

interface SVGSearchPopupProps {
  onClose: () => void;
  onSelect: (filename: string) => Promise<void>;
}

export const SVGSearchPopup: React.FC<SVGSearchPopupProps> = ({
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SVGFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<SVGFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [imagesPerPage, setImagesPerPage] = useState(5);
  const [hasCalculatedInitialLayout, setHasCalculatedInitialLayout] = useState(false);
  
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailsRowRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const analyticsEnabled = isAnalyticsEnabled();

  // Handle cancel (click outside)
  const handleCancel = useCallback(() => {
    if (analyticsEnabled) {
      trackPopupCancel('svg_search', 'click_outside');
    }
    onClose();
  }, [analyticsEnabled, onClose]);

  // Calculate pagination
  const totalPages = Math.ceil(searchResults.length / Math.max(1, imagesPerPage));
  const hasNextPage = currentPage < totalPages - 1;
  const currentPageImages = searchResults.slice(
    currentPage * Math.max(1, imagesPerPage),
    (currentPage + 1) * Math.max(1, imagesPerPage)
  );
  const showPreview = searchResults.length > 0;

  // Calculate how many images fit in a row
  const calculateImagesPerPage = useCallback((isInitialCalculation = false) => {
    const container = previewContainerRef.current;
    const row = thumbnailsRowRef.current;
    if (!container || !row) return;

    const containerWidth = row.clientWidth || container.clientWidth;
    if (containerWidth === 0) return; // Don't calculate if container has no width

    const rowStyles = getComputedStyle(row);
    const gapValue = rowStyles.columnGap || rowStyles.gap || '0px';
    const gap = Number.parseFloat(gapValue) || 0;

    // Try to get actual thumbnail width, fallback to 64px
    const firstChild = row.firstElementChild as HTMLElement | null;
    let thumbWidth = 64; // Default fallback
    
    if (firstChild) {
      const rect = firstChild.getBoundingClientRect();
      if (rect.width > 0) {
        thumbWidth = rect.width;
      }
    }

    const computed = Math.max(1, Math.floor((containerWidth + gap) / (thumbWidth + gap)));
    setImagesPerPage(computed);
    
    if (isInitialCalculation) {
      setHasCalculatedInitialLayout(true);
    }
  }, []);

  // Set up calculation on mount and resize
  useEffect(() => {
    // Calculate immediately
    calculateImagesPerPage();
    
    const handleResize = () => calculateImagesPerPage();
    window.addEventListener('resize', handleResize);

    const container = previewContainerRef.current;
    const row = thumbnailsRowRef.current;
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => calculateImagesPerPage())
      : null;
    if (observer && container) observer.observe(container);
    if (observer && row) observer.observe(row);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, [calculateImagesPerPage]);


  // Clamp current page when results change
  useEffect(() => {
    const pages = Math.max(1, Math.ceil(searchResults.length / Math.max(1, imagesPerPage)));
    setCurrentPage(prev => Math.min(prev, pages - 1));
  }, [imagesPerPage, searchResults.length]);

  // Search for SVG files
  const searchSVGFiles = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasCalculatedInitialLayout(false); // Reset flag for new search results

    try {
      const data = await SVGDatasetService.searchSVGFiles(query, 20);
      setSearchResults(data.files || []);
      setCurrentPage(0);
    } catch (err) {
      console.error('Search error:', err);
      setError(t("svg.searchPopup.searchError"));
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle search input changes with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchSVGFiles(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchSVGFiles]);

  // Handle file selection from dataset
  const handleFileSelect = async (file: SVGFile) => {
    setSelectedFile(file);
    
    try {
      await onSelect(file.name);
      onClose();
    } catch (err) {
      console.error('File selection failed:', err);
      toast.error(t("svg.searchPopup.selectError"));
    }
  };

  // Handle keyboard events for popup
  const handlePopupKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && selectedFile) {
      event.preventDefault();
      if (analyticsEnabled) {
        trackPopupSubmit('svg_search', selectedFile.name, 'keyboard');
      }
      handleFileSelect(selectedFile);
    }
  };

  // Auto-focus search input when popup opens and reset state when popup closes
  useEffect(() => {
    searchInputRef.current?.focus();
    
    // Reset state when popup closes
    return () => {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedFile(null);
      setIsLoading(false);
      setError(null);
      setCurrentPage(0);
    };
  }, []);

  return (
    <BasePopup onClose={handleCancel} onKeyDown={handlePopupKeyDown} className="popup-search-width max-h-[90vh]">
      {/* Search Input */}
      <InputGroup className="popup-button-responsive-height overflow-hidden border-ring ring-ring/50 ring-[3px]">
        <InputGroupInput
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (analyticsEnabled) {
              trackSVGSearchPopupType(e.target.value);
            }
          }}
          placeholder={t("common.search")}
          spellCheck={false}
          className="touch-manipulation text-black responsive-text-font-size"
          disabled={!!selectedFile}
        />
        <InputGroupAddon>
          <Search className="responsive-smaller-icon-font-size" />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end" className="pr-1.5">
          <InputGroupButton
            onClick={() => {
              if (selectedFile) {
                if (analyticsEnabled) {
                  trackPopupSubmit('svg_search', selectedFile.name);
                }
                handleFileSelect(selectedFile);
              }
            }}
            disabled={!selectedFile}
            size="sm"
            variant="default"
            className="!text-primary-foreground popup-button-responsive-height touch-manipulation rounded-l-none rounded-r-md"
          >
            <ArrowRight className="responsive-smaller-icon-font-size" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {/* Image Preview Grid */}
      {showPreview && (
        <div ref={previewContainerRef} className="relative mt-2 overflow-visible">
          {/* Navigation Arrows */}
          {currentPage > 0 && (
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white border border-gray-200 rounded-full p-2 sm:p-1 shadow-md hover:bg-gray-50 transition-colors touch-manipulation"
            >
              <svg className="responsive-smaller-icon-font-size text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          {hasNextPage && (
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white border border-gray-200 rounded-full p-2 sm:p-1 shadow-md hover:bg-gray-50 transition-colors touch-manipulation"
            >
              <svg className="responsive-smaller-icon-font-size text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          
          {/* Image Thumbnails */}
          <div ref={thumbnailsRowRef} className="flex gap-2 overflow-visible justify-center">
            {currentPageImages.map((file, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 lg:w-24 lg:h-24 border border-gray-200 rounded-md cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 relative group touch-manipulation"
                onClick={() => setSelectedFile(file)}
                onDoubleClick={() => handleFileSelect(file)}
              >
                <div className="w-full h-full p-2 flex items-center justify-center">
                  <img
                    src={`${BACKEND_API_URL}/svg-dataset/files/${encodeURIComponent(file.filename)}`}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain"
                    onLoad={() => {
                      // Only recalculate once when we haven't done the initial calculation yet
                      if (!hasCalculatedInitialLayout) {
                        calculateImagesPerPage(true);
                      }
                    }}
                    onError={(e) => {
                      const imageUrl = `${BACKEND_API_URL}/svg-dataset/files/${encodeURIComponent(file.filename)}`;
                      console.error(`Failed to load SVG: ${file.filename}`, `URL: ${imageUrl}`);
                      e.currentTarget.style.display = 'none';
                      const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                      if (nextElement) {
                        nextElement.style.display = 'block';
                      }
                    }}
                  />
                  <ImageIcon className="responsive-smaller-icon-font-size text-gray-400 hidden" />
                </div>
                
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 dark:group-hover:bg-opacity-40 rounded-md transition-all duration-200 pointer-events-none" />
                
                {selectedFile?.name === file.name && (
                  <div className="absolute inset-0 ring-2 ring-blue-500 rounded-md pointer-events-none" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 responsive-text-font-size mt-1">
          <AlertCircle className="responsive-smaller-icon-font-size" />
          {error}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="responsive-text-font-size text-gray-500 mt-1">{t("svg.searchPopup.searching")}</div>
      )}
    </BasePopup>
  );
};
