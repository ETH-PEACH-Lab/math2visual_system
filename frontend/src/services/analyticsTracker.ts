/**
 * Analytics tracker service for tracking user actions with debouncing.
 * This is a module-level service (not a React hook) to ensure shared state
 * across all components for proper debouncing/throttling.
 */
import type { UIEvent } from 'react';
import { toPng } from 'html-to-image';
import { analyticsService } from '@/api_services/analytics';

// Module-level state for debouncing/throttling (shared across all components)
let _isCapturingScreenshot = false;
const screenshotListeners: Set<(value: boolean) => void> = new Set();

// Event emitter pattern for reactive updates
function setCapturingScreenshot(value: boolean): void {
  if (_isCapturingScreenshot !== value) {
    _isCapturingScreenshot = value;
    // Notify all listeners
    screenshotListeners.forEach(listener => listener(value));
  }
}

// Subscribe to screenshot capture state changes
export function subscribeToScreenshotState(callback: (value: boolean) => void): () => void {
  screenshotListeners.add(callback);
  // Immediately call with current value
  callback(_isCapturingScreenshot);
  // Return unsubscribe function
  return () => {
    screenshotListeners.delete(callback);
  };
}

// Get current screenshot capture state (for useSyncExternalStore)
export function getIsCapturingScreenshot(): boolean {
  return _isCapturingScreenshot;
}

let mwpTimeout: ReturnType<typeof setTimeout> | null = null;
let formulaTimeout: ReturnType<typeof setTimeout> | null = null;
let hintTimeout: ReturnType<typeof setTimeout> | null = null;
let dslTimeout: ReturnType<typeof setTimeout> | null = null;
let leftScrollTop = 0;
let rightScrollTop = 0;
let outermostScrollTop = 0;
let dslScrollTimeout: ReturnType<typeof setTimeout> | null = null;
let columnScrollTimeout: ReturnType<typeof setTimeout> | null = null;
let outermostScrollTimeout: ReturnType<typeof setTimeout> | null = null;
let panelResizeTimeout: ReturnType<typeof setTimeout> | null = null;
let isFirstRender = true;
let lastMouseMoveTime = 0;
let mouseMoveHandler: ((event: MouseEvent) => void) | null = null;

// Capture screenshot function
async function captureScreenshot(): Promise<void> {
  if (_isCapturingScreenshot) {
    return;
  }

  const startTime = Date.now();
  const MIN_DISPLAY_DURATION = 500; // Minimum time to show "Capturing..." indicator (500ms)

  setCapturingScreenshot(true);

  try {
    // Capture the viewport (what user actually sees) using html-to-image
    const dataURL = await toPng(document.body, {
      // Capture the viewport dimensions (what user sees)
      width: window.innerWidth,
      height: window.innerHeight,
      // Use the device's pixel ratio for better quality
      pixelRatio: window.devicePixelRatio || 1,
      // Quality and rendering settings
      backgroundColor: '#ffffff', // Ensure white background
      quality: 1.0, // Maximum quality
    });

    // Use the viewport dimensions we specified
    const width = window.innerWidth * (window.devicePixelRatio || 1);
    const height = window.innerHeight * (window.devicePixelRatio || 1);

    await analyticsService.uploadScreenshot(dataURL, width, height);
  } catch (error) {
    console.error('Failed to capture screenshot:', error);
  } finally {
    // Ensure the "Capturing..." indicator is visible for at least MIN_DISPLAY_DURATION
    const elapsed = Date.now() - startTime;
    const remainingTime = Math.max(0, MIN_DISPLAY_DURATION - elapsed);

    if (remainingTime > 0) {
      setTimeout(() => {
        setCapturingScreenshot(false);
      }, remainingTime);
    } else {
      setCapturingScreenshot(false);
    }
  }
}

// Input typing tracking with debouncing
export function trackMWPType(): void {
  if (mwpTimeout) {
    clearTimeout(mwpTimeout);
  }
  mwpTimeout = setTimeout(() => {
    analyticsService.recordAction({
      type: 'mwp_input_type'
    });
  }, 500);
}

export function trackFormulaType(): void {
  if (formulaTimeout) {
    clearTimeout(formulaTimeout);
  }
  formulaTimeout = setTimeout(() => {
    analyticsService.recordAction({
      type: 'formula_input_type'
    });
  }, 500);
}

export function trackHintType(): void {
  if (hintTimeout) {
    clearTimeout(hintTimeout);
  }
  hintTimeout = setTimeout(() => {
    analyticsService.recordAction({
      type: 'hint_input_type'
    });
  }, 500);
}

export function trackDSLType(): void {
  if (dslTimeout) {
    clearTimeout(dslTimeout);
  }
  dslTimeout = setTimeout(() => {
    analyticsService.recordAction({
      type: 'dsl_editor_type'
    });
  }, 500);
}

// Voice input tracking
export function trackVoiceInputStart(context: 'mwp' | 'student_message' | 'chatgpt_message'): void {
  analyticsService.recordAction({
    type: 'voice_input_start',
    data: JSON.stringify({ context: context }),
  });
}

export function trackVoiceInputComplete(context: 'mwp' | 'student_message' | 'chatgpt_message', transcript: string): void {
  analyticsService.recordAction({
    type: 'voice_input_complete',
    data: JSON.stringify({ context: context, transcript: transcript, transcript_length: transcript.length }),
  });
}

export function trackVoiceInputError(context: 'mwp' | 'student_message' | 'chatgpt_message', error?: string): void {
  analyticsService.recordAction({
    type: 'voice_input_error',
    data: JSON.stringify({ context: context, error: error || 'unknown' }),
  });
}

// Tutor speech (speaker) tracking
export function trackTutorSpeechToggle(enabled: boolean): void {
  analyticsService.recordAction({
    type: 'tutor_speech_toggle',
    data: JSON.stringify({ enabled: enabled }),
  });
}

// Landing page role selection tracking
export function trackLandingPageRoleSelect(role: 'teacher' | 'student'): void {
  analyticsService.recordAction({
    type: 'landing_page_role_select',
    data: JSON.stringify({ role: role }),
  });
}

// Language change tracking
export function trackLanguageChange(language: string): void {
  analyticsService.recordAction({
    type: 'language_change',
    data: JSON.stringify({ language: language }),
  });
}

// Theme toggle tracking
export function trackThemeToggle(theme: 'light' | 'dark'): void {
  analyticsService.recordAction({
    type: 'theme_toggle',
    data: JSON.stringify({ theme: theme }),
  });
}

export function trackDSLScroll(direction: 'up' | 'down'): void {
  if (dslScrollTimeout) {
    clearTimeout(dslScrollTimeout);
  }
  dslScrollTimeout = setTimeout(() => {
    analyticsService.recordAction({
      type: `dsl_editor_scroll_${direction}`,
    });
    //captureScreenshot();
  }, 1500);
}

export function trackColumnScroll(event: UIEvent<HTMLDivElement>, column: 'left' | 'right'): void {
  const target = event.currentTarget;
  const currentScrollTop = target.scrollTop;
  const previousScrollTop = column === 'left' ? leftScrollTop : rightScrollTop;
  const actionType = column === 'left' ? 'math_problem_column_scroll' : 'visualization_column_scroll';

  const direction = currentScrollTop > previousScrollTop ? 'down' :
    currentScrollTop < previousScrollTop ? 'up' : null;

  // Update scroll position immediately for direction detection
  if (column === 'left') {
    leftScrollTop = currentScrollTop;
  } else {
    rightScrollTop = currentScrollTop;
  }

  // Debounce the analytics recording
  if (direction) {
    if (columnScrollTimeout) {
      clearTimeout(columnScrollTimeout);
    }
    columnScrollTimeout = setTimeout(() => {
      analyticsService.recordAction({
        type: `${actionType}_${direction}`,
      });
      //captureScreenshot();
    }, 1500);
  }
}

export function trackOutermostScroll(event: Event): void {
  const target = event.target as HTMLElement;
  const currentScrollTop = target.scrollTop;
  const previousScrollTop = outermostScrollTop;

  const direction = currentScrollTop > previousScrollTop ? 'down' :
    currentScrollTop < previousScrollTop ? 'up' : null;

  // Update scroll position immediately for direction detection
  outermostScrollTop = currentScrollTop;

  // Debounce the analytics recording
  if (direction) {
    if (outermostScrollTimeout) {
      clearTimeout(outermostScrollTimeout);
    }
    outermostScrollTimeout = setTimeout(() => {
      analyticsService.recordAction({
        type: `outermost_scroll_${direction}`,
      });
      //captureScreenshot();
    }, 1500);
  }
}

// Panel resize tracking with debouncing
export function trackPanelResize(sizes: number[]): void {
  if (panelResizeTimeout) {
    clearTimeout(panelResizeTimeout);
  }
  panelResizeTimeout = setTimeout(() => {
    analyticsService.recordAction({
      type: 'panel_resize',
      data: JSON.stringify({
        sizes: sizes.map(s => Math.round(s * 10) / 10) // Round to 1 decimal place
      }),
    });
  }, 1000); // Debounce for 1 second after user stops resizing
}

export function trackTwoColumnLayoutRender(): void {
  if (isFirstRender) {
    analyticsService.recordAction({
      type: 'two_column_layout_render',
    });
    // Capture screenshot after a brief delay to ensure layout is fully rendered
    setTimeout(() => {
      captureScreenshot();
    }, 3000);
    isFirstRender = false;
  }
}

export function trackInitialViewRender(): void {
  analyticsService.recordAction({
    type: 'initial_view_render'
  });
}

// Element click tracking
export function trackElementClick(action_type: string, action_data?: string): void {
  analyticsService.recordAction({
    type: action_type,
    data: JSON.stringify({ key: action_data }),
  });
}

// Element hover tracking
export function trackSVGElementHover(action_type: string, dslPath?: string): void {
  analyticsService.recordAction({
    type: action_type,
    data: JSON.stringify({ dsl_path: dslPath }),
  });
}

// SVG element click tracking
export function trackSVGElementClick(action_type: string, dslPath?: string): void {
  analyticsService.recordAction({
    type: action_type,
    data: JSON.stringify({ dsl_path: dslPath }),
  });
}

// Popup tracking
export function trackOpenPopup(popupType: 'name' | 'entity_quantity' | 'svg_selector', dslPath: string): void {
  const actionType = `${popupType}_popup_open`;
  analyticsService.recordAction({
    type: actionType,
    data: JSON.stringify({ dsl_path: dslPath }),
  });
}

// Popup typing tracking with debouncing - use objects to track timeouts
const popupTimeouts = {
  name: null as ReturnType<typeof setTimeout> | null,
  entity_quantity: null as ReturnType<typeof setTimeout> | null,
  svg_search: null as ReturnType<typeof setTimeout> | null,
  svg_upload: null as ReturnType<typeof setTimeout> | null,
};

function trackPopupTypeInternal(popupType: 'name' | 'entity_quantity' | 'svg_search' | 'svg_upload', value: string): void {
  const timeoutKey = popupType;
  if (popupTimeouts[timeoutKey]) {
    clearTimeout(popupTimeouts[timeoutKey]!);
  }

  popupTimeouts[timeoutKey] = setTimeout(() => {
    analyticsService.recordAction({
      type: `${popupType}_popup_type`,
      data: JSON.stringify({ value: value }),
    });
    popupTimeouts[timeoutKey] = null;
  }, 500);
}

export function trackNamePopupType(value: string): void {
  trackPopupTypeInternal('name', value);
}

export function trackEntityQuantityPopupType(value: string): void {
  trackPopupTypeInternal('entity_quantity', value);
}

export function trackSVGSearchPopupType(value: string): void {
  trackPopupTypeInternal('svg_search', value);
}

export function trackSVGUploadPopupType(value: string): void {
  trackPopupTypeInternal('svg_upload', value);
}

// Popup submission tracking
export function trackPopupSubmit(popupType: string, value: string, elementType: 'button' | 'keyboard' = 'button'): void {
  const actionType = `${popupType}_popup_${elementType}_submit`;

  analyticsService.recordAction({
    type: actionType,
    data: JSON.stringify({ value: value }),
  });
}

export function trackPopupCancel(popupType: string, reason: 'click_outside' | 'escape_key' = 'click_outside'): void {
  const actionType = `${popupType}_popup_cancel`;

  analyticsService.recordAction({
    type: actionType,
    data: JSON.stringify({ reason: reason }),
  });
}

export function trackDragOver(action_type: string, dslPath?: string): void {
  analyticsService.recordAction({
    type: action_type,
    data: JSON.stringify({ dsl_path: dslPath }),
  });
}

export function trackDrop(action_type: string, dslPath?: string): void {
  analyticsService.recordAction({
    type: action_type,
    data: JSON.stringify({ dsl_path: dslPath }),
  });
}

// Form submission tracking
export function trackFormSubmit(actionType: string, value: string): void {
  analyticsService.recordAction({
    type: actionType,
    data: JSON.stringify({ value: value }),
  });
}

// Student message submission tracking
export function trackStudentMessage(message: string): void {
  analyticsService.recordAction({
    type: 'student_message_submit',
    data: JSON.stringify({ message: message }),
  });
}

// ChatGPT message submission tracking
export function trackChatGPTMessage(message: string): void {
  analyticsService.recordAction({
    type: 'chatgpt_message_submit',
    data: JSON.stringify({ message: message }),
  });
}

// Unified message submission method tracking (takes context parameter)
export function trackMessageButtonClick(context: 'student' | 'chatgpt'): void {
  analyticsService.recordAction({
    type: context === 'chatgpt' ? 'chatgpt_message_button_click' : 'student_message_button_click',
  });
}

export function trackMessageEnterKey(context: 'student' | 'chatgpt'): void {
  analyticsService.recordAction({
    type: context === 'chatgpt' ? 'chatgpt_message_enter_key' : 'student_message_enter_key',
  });
}

// Download tracking
export function trackDownload(format: 'svg' | 'png' | 'pdf', filename?: string): void {
  analyticsService.recordAction({
    type: `download_${format}_button_click`,
    data: JSON.stringify({ filename: filename }),
  });
}

export function trackDownloadStart(format: 'svg' | 'png' | 'pdf', filename?: string): void {
  analyticsService.recordAction({
    type: `download_${format}_start`,
    data: JSON.stringify({ filename: filename }),
  });
}

export function trackDownloadComplete(format: 'svg' | 'png' | 'pdf', filename?: string): void {
  analyticsService.recordAction({
    type: `download_${format}_complete`,
    data: JSON.stringify({ filename: filename }),
  });
}

// ChatGPT image download tracking
export function trackChatGPTImageDownload(format: 'jpg' | 'png' | 'gif' | 'webp', filename?: string): void {
  analyticsService.recordAction({
    type: 'chatgpt_image_download',
    data: JSON.stringify({ format: format, filename: filename }),
  });
}

export function trackChatGPTImageDownloadStart(format: 'jpg' | 'png' | 'gif' | 'webp', filename?: string): void {
  analyticsService.recordAction({
    type: 'chatgpt_image_download_start',
    data: JSON.stringify({ format: format, filename: filename }),
  });
}

export function trackChatGPTImageDownloadComplete(format: 'jpg' | 'png' | 'gif' | 'webp', filename?: string): void {
  analyticsService.recordAction({
    type: 'chatgpt_image_download_complete',
    data: JSON.stringify({ format: format, filename: filename }),
  });
}

// Error tracking
export function trackError(errorType: string, errorMessage: string): void {
  analyticsService.recordAction({
    type: errorType,
    data: JSON.stringify({ error_message: errorMessage }),
  });
}

// DSL editor click tracking
export function trackDSLEditorClick(dslPath: string | null): void {
  analyticsService.recordAction({
    type: 'dsl_editor_click',
    data: JSON.stringify({ dsl_path: dslPath }),
  });
}

// Generation tracking
export async function trackGenerationStart(mwp: string, formula?: string, hint?: string): Promise<void> {
  analyticsService.recordAction({
    type: 'generation_start',
    data: JSON.stringify({ mwp: mwp, formula: formula, hint: hint }),
  });
}

export function trackGenerationComplete(
  success: boolean,
  errorFormal?: string | null,
  errorIntuitive?: string | null,
  dsl?: string,
  missingEntities?: string[],
): void {
  analyticsService.recordAction({
    type: 'generation_complete',
    data: JSON.stringify({ success: success, error_formal: errorFormal, error_intuitive: errorIntuitive, dsl: dsl, missing_svg_entities: missingEntities }),
  });
}

// Cursor tracking with throttling
function handleMouseMove(event: MouseEvent): void {
  const now = Date.now();
  const throttleInterval = 100; // Throttle to at most once per 100ms

  // Only process if enough time has passed since last execution
  if (now - lastMouseMoveTime >= throttleInterval) {
    const element = event.target as HTMLElement;
    const elementId = element.id || undefined;
    const elementType = element.tagName.toLowerCase() || undefined;

    analyticsService.recordCursorPosition(event.clientX, event.clientY, {
      element_id: elementId,
      element_type: elementType,
    });

    lastMouseMoveTime = now;
  }
}

// Start cursor tracking
export function startCursorTracking(): void {
  if (mouseMoveHandler) {
    // Already tracking
    return;
  }
  mouseMoveHandler = handleMouseMove;
  document.addEventListener('mousemove', mouseMoveHandler);
}

// Stop cursor tracking
export function stopCursorTracking(): void {
  if (mouseMoveHandler) {
    document.removeEventListener('mousemove', mouseMoveHandler);
    mouseMoveHandler = null;
  }
}

// Export analytics service getters
export function isAnalyticsEnabled(): boolean {
  return analyticsService.isAnalyticsEnabled();
}

export function getSessionId(): string | null {
  return analyticsService.getSessionId();
}

