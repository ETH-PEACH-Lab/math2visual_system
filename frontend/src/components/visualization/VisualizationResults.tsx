import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useCallback, memo } from "react";
import { VisualizationSection } from "./VisualizationSection";
import { MissingSVGSection } from "./MissingSVGSection";
import { ParseErrorSection } from "./ParseErrorSection";
import { AlertCircle, TriangleAlert } from "lucide-react";
import { trackElementClick, isAnalyticsEnabled } from "@/services/analyticsTracker";
import { useTranslation } from "react-i18next";

interface VisualizationResultsProps {
  svgFormal: string | null;
  formalError: string | null;
  svgIntuitive: string | null;
  intuitiveError: string | null;
  hasParseError?: boolean;
  missingSVGEntities?: string[];
  mwpValue?: string;
  formulaValue?: string;
  onRegenerateAfterUpload?: (toastId: string | undefined) => Promise<void>;
  onAllFilesUploaded?: () => void;
  onEmbeddedSVGClick: (event: MouseEvent) => void;
  onEntityQuantityClick: (event: MouseEvent) => void;
  onNameClick: (event: MouseEvent) => void;
  isPopupOpen?: boolean;
  isDisabled?: boolean;
}

export const VisualizationResults = memo(({
  svgFormal,
  formalError,
  svgIntuitive,
  intuitiveError,
  hasParseError = false,
  missingSVGEntities = [],
  mwpValue = '',
  formulaValue = '',
  onRegenerateAfterUpload,
  onAllFilesUploaded,
  onEmbeddedSVGClick,
  onEntityQuantityClick,
  onNameClick,
  isPopupOpen = false,
  isDisabled = false,
}: VisualizationResultsProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("");
  const analyticsEnabled = isAnalyticsEnabled();

  // Suppress generic missing-SVG errors in the tabs; these are shown
  // more helpfully in the dedicated MissingSVGSection below
  const filterMissingSvgError = (error: string | null): string | null => {
    if (!error) return error;
    // Backend raises FileNotFoundError as: "SVG file not found: <path>"
    return /SVG file not found/i.test(error) ? null : error;
  };

  const filteredFormalError = filterMissingSvgError(formalError);
  const filteredIntuitiveError = filterMissingSvgError(intuitiveError);
    
  // Check if at least one visual variant is available
  const hasAtLeastOneVariant = !!(svgFormal || svgIntuitive);

  // Auto-select appropriate tab when content changes
  const getDefaultTab = useCallback(() => {
    // Check for parse errors first
    if (hasParseError) return "parse-error";
    if (formalError && intuitiveError && missingSVGEntities.length > 0) return "missing-svg";
    return "formal";
  }, [hasParseError, formalError, intuitiveError, missingSVGEntities]);

  // Update active tab only when:
  // 1. No tab is selected (initial state)
  // 2. Current tab becomes invalid (e.g., parse error tab but no parse error anymore)
  useEffect(() => {    
    // Only set default tab if:
    // - No tab is currently active (initial state)
    // - Current tab is invalid (e.g., parse-error tab but no parse error, or vice versa)
    const isCurrentTabInvalid = 
      (activeTab === "parse-error" && !hasParseError) ||
      (activeTab === "missing-svg" && missingSVGEntities.length === 0) ||
      (activeTab === "formal" && hasParseError) ||
      (activeTab === "intuitive" && hasParseError);
    
    if (!activeTab || isCurrentTabInvalid) {
      const defaultTab = getDefaultTab();
      setActiveTab(defaultTab);
    }
  }, [getDefaultTab, activeTab, hasParseError, missingSVGEntities.length]);
  
  // Don't render if no content or errors at all
  if (!svgFormal && !formalError && !svgIntuitive && !intuitiveError && missingSVGEntities.length === 0) {
    return null;
  }

  return (
    <div className="h-full w-full">
      <Tabs 
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="w-full flex h-auto gap-0 relative overflow-hidden">
          {(
            [
              // Show parse error tab when parse error exists
              ...(hasParseError
                ? ([
                    {
                      key: "parse-error",
                      value: "parse-error" as const,
                      onClick:
                        analyticsEnabled ? () => trackElementClick("tab_parse_error_click") : undefined,
                      className: "data-[state=active]:bg-destructive/10",
                      icon: (
                        <AlertCircle className="responsive-smaller-icon-font-size mr-2 text-destructive" />
                      ),
                      label: t("visualization.parseError"),
                    },
                  ] as const)
                : []),

              // Hide visualization tabs if parse error exists
              ...(!hasParseError
                ? ([
                    {
                      key: "formal",
                      value: "formal" as const,
                      onClick:
                        analyticsEnabled ? () => trackElementClick("tab_formal_click") : undefined,
                      className: "",
                      icon: null,
                      label: t("visualization.tabs.formalVisual"),
                    },
                    {
                      key: "intuitive",
                      value: "intuitive" as const,
                      onClick:
                        analyticsEnabled ? () => trackElementClick("tab_intuitive_click") : undefined,
                      className: "",
                      icon: null,
                      label: t("visualization.tabs.intuitiveVisual"),
                    },
                  ] as const)
                : []),

              ...(missingSVGEntities.length > 0
                ? ([
                    {
                      key: "missing-svg",
                      value: "missing-svg" as const,
                      onClick:
                        analyticsEnabled ? () => trackElementClick("tab_missing_svg_click") : undefined,
                      className: hasAtLeastOneVariant
                        ? "data-[state=active]:bg-amber-500/10" 
                        : "data-[state=active]:bg-destructive/10",
                      icon: hasAtLeastOneVariant ? (
                        <TriangleAlert className="responsive-smaller-icon-font-size mr-2 text-amber-500" />
                      ) : (
                        <AlertCircle className="responsive-smaller-icon-font-size mr-2 text-destructive" />
                      ),
                      label: t("visualization.tabs.missingSVG"),
                    },
                  ] as const)
                : []),
            ] as const
          ).map((tab, idx) => (
            <TabsTrigger
              // Later tabs stack above earlier tabs so if things get cramped,
              // the earlier label visually disappears "behind" the next tab.
              style={{ zIndex: idx + 1 }}
              key={tab.key}
              value={tab.value}
              className={`
                responsive-text-font-size
                relative min-w-0 overflow-hidden
                flex-1
                -ml-2 first:ml-0
                ${tab.className}
              `}
              disabled={isDisabled}
              {...(tab.onClick ? { onClick: tab.onClick } : {})}
            >
              {tab.icon}
              <span className="min-w-0 block whitespace-nowrap">
                {tab.label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Parse error content */}
        {hasParseError && (
          <TabsContent value="parse-error" className="mt-4">
            <ParseErrorSection message="Could not parse Visual Language." />
          </TabsContent>
        )}

        {/* Visualization contents */}
        {!hasParseError && (
          <>
            <TabsContent value="formal" className="mt-4">
              <VisualizationSection
                type="formal"
                title={t("visualization.formalVisualization")}
                svgContent={svgFormal}
                error={filteredFormalError}
                isOpen={activeTab === "formal"}
                mwpValue={mwpValue}
                formulaValue={formulaValue}
                onEmbeddedSVGClick={onEmbeddedSVGClick}
                onEntityQuantityClick={onEntityQuantityClick}
                onNameClick={onNameClick}
                isPopupOpen={isPopupOpen}
                isDisabled={isDisabled}
              />
            </TabsContent>

            <TabsContent value="intuitive" className="mt-4">
              <VisualizationSection
                type="intuitive"
                title={t("visualization.intuitiveVisualization")}
                svgContent={svgIntuitive}
                error={filteredIntuitiveError}
                isOpen={activeTab === "intuitive"}
                mwpValue={mwpValue}
                formulaValue={formulaValue}
                onEmbeddedSVGClick={onEmbeddedSVGClick}
                onEntityQuantityClick={onEntityQuantityClick}
                onNameClick={onNameClick}
                isPopupOpen={isPopupOpen}
                isDisabled={isDisabled}
              />
            </TabsContent>
          </>
        )}

        {/* Missing SVG content */}
        {missingSVGEntities.length > 0 && (
          <TabsContent value="missing-svg" className="mt-4">
            <MissingSVGSection
              missingSVGEntities={missingSVGEntities}
              onRegenerateAfterUpload={onRegenerateAfterUpload}
              onAllFilesUploaded={onAllFilesUploaded}
              hasAtLeastOneVariant={hasAtLeastOneVariant}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
});
