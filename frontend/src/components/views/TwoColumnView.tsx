import { useCallback, useEffect, useState, useRef } from "react";
// import { useSyncExternalStore } from "react";
import { ResponsiveLogo } from "@/components/ui/ResponsiveLogo";
import { RegenerateForm } from "@/components/forms/RegenerateForm";
import { VisualLanguageForm } from "@/components/forms/VisualLanguageForm";
import { VisualizationResults } from "@/components/visualization/VisualizationResults";
import { SparklesLoading } from "@/components/ui/sparkles-loading";
// import { SessionAnalyticsDisplay } from "@/components/ui/SessionAnalyticsDisplay";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { trackColumnScroll, trackTwoColumnLayoutRender, trackElementClick, trackPanelResize, isAnalyticsEnabled } from "@/services/analyticsTracker";
// import { getSessionId, subscribeToScreenshotState, getIsCapturingScreenshot } from "@/services/analyticsTracker";
import { useDSLContext } from "@/contexts/DSLContext";
import { useVisualizationHandlers } from "@/hooks/useVisualizationHandlers";
import { usePopupManagement } from "@/hooks/usePopupManagement";
import { PopupManager } from "@/components/popups/PopupManager";
import type { useAppState } from "@/hooks/useAppState";
import type { ComponentMapping } from "@/types/visualInteraction";
import type { ParsedOperation } from "@/utils/dsl-parser";

type Props = {
  appState: ReturnType<typeof useAppState>;
};

export function TwoColumnView({ appState }: Props) {
  const {
    vlFormLoading,
    mpFormLoading,
    svgFormal,
    svgIntuitive,
    formalError,
    intuitiveError,
    hasParseError,
    missingSVGEntities,
    uploadGenerating,
    mwp,
    formula,
    hint,
    setMpFormLoading,
    setVLFormLoading,
    setResults,
    clearMissingSVGEntities,
    handleRegenerateAfterUpload,
    handleAbort,
  } = appState;

  const { formattedDSL } = useDSLContext();
  const analyticsEnabled = isAnalyticsEnabled();
  // const sessionId = getSessionId();
  const { t } = useTranslation();
  const [isVisualPanelCollapsed, setIsVisualPanelCollapsed] = useState(true);
  const [isMathProblemPanelCollapsed, setIsMathProblemPanelCollapsed] = useState(false);
  const visualLanguagePanelRef = useRef<ImperativePanelHandle>(null);
  const mathProblemPanelRef = useRef<ImperativePanelHandle>(null);
  // const isCapturingScreenshot = useSyncExternalStore(
  //   subscribeToScreenshotState,
  //   getIsCapturingScreenshot,
  //   () => false // Server snapshot (always false on server)
  // );

  const { handleVLResult } =
    useVisualizationHandlers({
      svgFormal,
      svgIntuitive,
      formalError,
      intuitiveError,
      missingSVGEntities,
      mwp,
      formula,
      setResults
    });

  const onVisualsUpdate = useCallback((data: {
    visual_language: string;
    svg_formal: string | null;
    svg_intuitive: string | null;
    formal_error: string | null;
    intuitive_error: string | null;
    missing_svg_entities: string[];
    componentMappings: ComponentMapping;
    parsedDSL: ParsedOperation | null;
    mwp?: string;
    formula?: string | null;
  }) => {
    handleVLResult(
      data.visual_language,
      data.svg_formal,
      data.svg_intuitive,
      data.parsedDSL,
      data.formal_error ?? undefined,
      data.intuitive_error ?? undefined,
      data.missing_svg_entities,
      data.mwp,
      data.formula ?? undefined,
      data.componentMappings,
      undefined // Popup updates shouldn't introduce parse errors
    );
  }, [handleVLResult]);

  const popup = usePopupManagement({
    mwp,
    formula,
    onVisualsUpdate,
  });

  const handleLeftColumnScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    trackColumnScroll(event, 'left');
  }, []);

  const handleRightColumnScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    trackColumnScroll(event, 'right');
  }, []);

  const handleExpandVisualPanel = useCallback(() => {
    if (visualLanguagePanelRef.current) {
      visualLanguagePanelRef.current.expand();
      setIsVisualPanelCollapsed(false);
      if (analyticsEnabled) {
        trackElementClick('visual_language_panel_expand_button');
      }
    }
  }, [analyticsEnabled]);

  const handleCollapseVisualPanel = useCallback(() => {
    if (visualLanguagePanelRef.current) {
      visualLanguagePanelRef.current.collapse();
      setIsVisualPanelCollapsed(true);
      if (analyticsEnabled) {
        trackElementClick('visual_language_panel_collapse_button');
      }
    }
  }, [analyticsEnabled]);

  const handleExpandMathProblemPanel = useCallback(() => {
    if (mathProblemPanelRef.current) {
      mathProblemPanelRef.current.expand();
      setIsMathProblemPanelCollapsed(false);
      if (analyticsEnabled) {
        trackElementClick('math_problem_panel_expand_button');
      }
    }
  }, [analyticsEnabled]);

  // Track two column layout render and capture screenshot
  useEffect(() => {
    if (analyticsEnabled) {
      trackTwoColumnLayoutRender();
    }
  }, [analyticsEnabled]);

  const isFormLoading = mpFormLoading || vlFormLoading || uploadGenerating;

  // Reusable content blocks to avoid duplication
  const logoAndTitle = (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1">
        <ResponsiveLogo className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 2xl:w-12 2xl:h-12 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 5xl:w-22 5xl:h-22" />
        <h1 className="responsive-title-simple font-bold">Math2Visual</h1>
      </div>
    </div>
  );

  const mathProblemForm = (
    <div className="flex flex-col w-full">
      <RegenerateForm
        onSuccess={setResults}
        onLoadingChange={(loading, abortFn) => {
          setMpFormLoading(loading, abortFn);
        }}
        mwp={mwp}
        formula={formula}
        hint={hint}
        saveInitialValues={appState.saveInitialValues}
        rows={6.5}
        isDisabled={isFormLoading}
        showHintInput={!!(svgFormal || svgIntuitive) && !hasParseError}
      />
    </div>
  );

  const visualLanguageForm = formattedDSL && (
    <VisualLanguageForm
      onResult={handleVLResult}
      onLoadingChange={(loading, abortFn) => {
        setVLFormLoading(loading, abortFn);
      }}
      mwp={mwp}
      formula={formula}
      isDisabled={isFormLoading}
    />
  );

  const visualizationResults = (
    <VisualizationResults
      svgFormal={svgFormal}
      formalError={formalError}
      svgIntuitive={svgIntuitive}
      intuitiveError={intuitiveError}
      hasParseError={hasParseError}
      missingSVGEntities={missingSVGEntities}
      mwpValue={mwp}
      formulaValue={formula}
      onRegenerateAfterUpload={handleRegenerateAfterUpload}
      onAllFilesUploaded={clearMissingSVGEntities}
      onEmbeddedSVGClick={popup.handleEmbeddedSVGClick}
      onEntityQuantityClick={popup.handleEntityQuantityClick}
      onNameClick={popup.handleNameClick}
      isPopupOpen={popup.selectorPopupState.isOpen || popup.namePopupState.isOpen || popup.quantityPopupState.isOpen}
      isDisabled={isFormLoading}
    />
  );

  // Math problem content (shared across all layouts)
  const mathProblemContent = (
    <div className="space-y-6 3xl:space-y-8 6xl:space-y-10 flex flex-col w-full">
      {logoAndTitle}
      {mathProblemForm}
    </div>
  );

  // Visual language column content
  const visualLanguageColumn = (
    <div className="flex flex-row h-full w-full">
      <div className="flex flex-col h-full flex-1 min-w-0">
        {visualLanguageForm}
      </div>
      {/* Collapse button positioned to the right */}
      <div 
        className="h-full bg-muted hover:opacity-80 cursor-pointer flex items-center justify-center transition-opacity rounded-r-md flex-shrink-0 responsive-icon-width"
        onClick={(e) => {
          e.stopPropagation();
          handleCollapseVisualPanel();
        }}
        aria-label={t("forms.visualLanguageTitle", "Visual Language")}
        title={t("forms.visualLanguageTitle", "Visual Language - Click to collapse")}
      >
        <ChevronRight className="responsive-icon-font-size text-foreground" />
      </div>
    </div>
  );

  return (
    <div className="w-full px-1 py-4 sm:px-2 lg:px-4 xl:px-6 2xl:px-8 3xl:px-8 4xl:px-8 8xl:px-12">
      {/* Session ID display commented out */}
      {/* {analyticsEnabled && <SessionAnalyticsDisplay sessionId={sessionId} isCapturingScreenshot={isCapturingScreenshot} />} */}
      
      {formattedDSL && (
        <>
          {/* Desktop: Resizable layout with Visual Language editor */}
          <div className="hidden xl:block relative h-[calc(100vh-2rem)]">
            <div className="relative h-full">
              <ResizablePanelGroup 
                direction="horizontal" 
                className="flex gap-4 2xl:gap-6 3xl:gap-8 8xl:gap-12 h-full"
                style={{ overflow: 'visible' }}
                {...(analyticsEnabled ? {onLayout: trackPanelResize} : {})}
              >
                <ResizablePanel
                  ref={mathProblemPanelRef}
                  id="math-problem"
                  defaultSize={31} 
                  minSize={25}
                  maxSize={45}
                  collapsible={true}
                  collapsedSize={3}
                  className="flex flex-col min-w-0"
                  style={{ overflow: 'visible' }}
                  onCollapse={() => setIsMathProblemPanelCollapsed(true)}
                  onExpand={() => setIsMathProblemPanelCollapsed(false)}
                >
                  {isMathProblemPanelCollapsed ? (
                    // Collapsed state: Matching tabs styling with centered chevron
                    <div 
                      className="w-full h-full bg-muted hover:opacity-80 cursor-pointer flex items-center justify-center transition-opacity rounded-r-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExpandMathProblemPanel();
                      }}
                      aria-label={t("forms.mathProblemTitle", "Math Problem")}
                      title={t("forms.mathProblemTitle", "Math Problem - Click to expand")}
                    >
                      <ChevronRight className="responsive-icon-font-size text-foreground" />
                    </div>
                  ) : (
                    // Expanded state: Show the Math Problem form
                    <div 
                      className="flex flex-col"
                      {...(analyticsEnabled ? {onScroll: handleLeftColumnScroll} : {})}
                    >
                      {mathProblemContent}
                    </div>
                  )}
                </ResizablePanel>

                <ResizableHandle 
                  withHandle 
                  className={`w-1 bg-border hover:bg-blue-500 transition-colors ${isMathProblemPanelCollapsed ? 'hidden' : ''}`}
                />

                <ResizablePanel 
                  defaultSize={69}
                  minSize={30}
                  className="flex flex-col min-w-0"
                >
                  <div className="flex flex-col w-full h-full overflow-hidden">
                    <div 
                      className="relative flex flex-col w-full flex-1 overflow-auto pr-1"
                      {...(analyticsEnabled ? {onScroll: handleRightColumnScroll} : {})}
                    >
                      {visualizationResults}
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle 
                  withHandle 
                  className={`w-1 bg-border hover:bg-blue-500 transition-colors ${isVisualPanelCollapsed ? 'hidden' : ''}`}
                />

                <ResizablePanel 
                  ref={visualLanguagePanelRef}
                  id="visual-language"
                  defaultSize={0}
                  minSize={25}
                  maxSize={45}
                  collapsible={true}
                  collapsedSize={3}
                  className="flex flex-col min-w-0"
                  style={{ overflow: 'visible' }}
                  onCollapse={() => setIsVisualPanelCollapsed(true)}
                  onExpand={() => setIsVisualPanelCollapsed(false)}
                >
                  {isVisualPanelCollapsed ? (
                    // Collapsed state: Matching tabs styling with centered chevron
                    <div 
                      className="h-full bg-muted hover:opacity-80 cursor-pointer flex items-center justify-center transition-opacity rounded-l-md responsive-icon-width"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExpandVisualPanel();
                      }}
                      aria-label={t("forms.visualLanguageTitle", "Visual Language")}
                      title={t("forms.visualLanguageTitle", "Visual Language - Click to expand")}
                    >
                      <ChevronLeft className="responsive-icon-font-size text-foreground" />
                    </div>
                  ) : (
                    // Expanded state: Show the Visual Language form
                    <div 
                      className="flex flex-col w-full h-full"
                      {...(analyticsEnabled ? {onScroll: handleLeftColumnScroll} : {})}
                    >
                      {visualLanguageColumn}
                    </div>
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </div>

          {/* Mobile: Stacked layout with Visual Language last */}
          <div className="xl:hidden relative flex flex-col gap-4 xl:gap-6 2xl:gap-8 3xl:gap-10 min-h-[calc(100vh-2rem)]">
            <div 
              className="flex flex-col space-y-4"
              {...(analyticsEnabled ? {onScroll: handleLeftColumnScroll} : {})}
            >
              {mathProblemContent}
            </div>

            <div 
              className="relative flex flex-col w-full"
              {...(analyticsEnabled ? {onScroll: handleRightColumnScroll} : {})}
            >
              {visualizationResults}
            </div>

            <div className="relative flex flex-col w-full">
              {visualLanguageForm}
            </div>
          </div>
        </>
      )}

      {/* Grid layout: shown when DSL doesn't exist (all screen sizes) */}
      {!formattedDSL && (
        <div className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] 3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-4 xl:gap-6 2xl:gap-8 3xl:gap-10 min-h-[calc(100vh-2rem)] items-start">
          <div 
            className="flex flex-col"
            {...(analyticsEnabled ? {onScroll: handleLeftColumnScroll} : {})}
          >
            {mathProblemContent}
          </div>

          <div 
            className="relative flex flex-col w-full"
            {...(analyticsEnabled ? {onScroll: handleRightColumnScroll} : {})}
          >
            {visualizationResults}
          </div>
        </div>
      )}
        
      {/* Loading overlay for Visual Language Form and Visualization Results */}
      {isFormLoading && (
        <>
          <div
            className="absolute inset-0 bg-background/60 dark:bg-black/40 backdrop-blur-[1px] z-40"
            aria-hidden="true"
          />
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="animate-in fade-in-0 duration-300 pointer-events-auto">
              <SparklesLoading
                onAbort={handleAbort}
                showAbortButton={true}
              />
            </div>
          </div>
        </>
      )}

      <PopupManager
        selectorPopupState={popup.selectorPopupState}
        closeSelectorPopup={popup.closeSelectorPopup}
        updateSVG={popup.updateSVG}
        quantityPopupState={popup.quantityPopupState}
        closeQuantityPopup={popup.closeQuantityPopup}
        updateEntityQuantity={popup.updateEntityQuantity}
        namePopupState={popup.namePopupState}
        closeNamePopup={popup.closeNamePopup}
        updateName={popup.updateName}
      />
    </div>
  );
}



