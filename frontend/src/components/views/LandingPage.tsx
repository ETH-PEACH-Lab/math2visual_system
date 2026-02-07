import { useTranslation } from "react-i18next";
import { ResponsiveLogo } from "@/components/ui/ResponsiveLogo";
import { LanguageSelector } from "@/components/ui/language-selector";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { trackLandingPageRoleSelect, isAnalyticsEnabled } from "@/services/analyticsTracker";

type Props = {
  onRoleSelect: (role: "teacher" | "student" | "chatgpt") => void;
};

export function LandingPage({ onRoleSelect }: Props) {
  const { t } = useTranslation();
  const analyticsEnabled = isAnalyticsEnabled();

  const handleRoleSelect = (role: "teacher" | "student" | "chatgpt") => {
    if (analyticsEnabled && (role === "teacher" || role === "student")) {
      trackLandingPageRoleSelect(role);
    }
    onRoleSelect(role);
  };

  return (
    <div className="w-full px-3 py-3 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 3xl:px-20 4xl:px-24 5xl:px-32 8xl:px-48">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSelector />
      </div>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-1.5rem)] sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-2rem)] xl:min-h-[calc(100vh-2rem)] 2xl:min-h-[calc(100vh-2rem)] 3xl:min-h-[calc(100vh-2rem)] 4xl:min-h-[calc(100vh-2rem)] 5xl:min-h-[calc(100vh-2rem)] 8xl:min-h-[calc(100vh-2rem)]">
        <div className="w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-6xl 3xl:max-w-6xl 4xl:max-w-7xl 5xl:max-w-8xl 6xl:max-w-[60%] 8xl:max-w-[50%] px-2 sm:px-0">
          <div className="text-center space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-4 xl:space-y-6 2xl:space-y-8 3xl:space-y-10 8xl:space-y-12">
            <div className="animate-in fade-in-0 slide-in-from-top-4 duration-700 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-4 xl:gap-6 2xl:gap-8 3xl:gap-10 8xl:gap-12 mb-2 sm:mb-3 md:mb-4 lg:mb-4 xl:mb-6 2xl:mb-8 3xl:mb-10 8xl:mb-12">
              <ResponsiveLogo className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 2xl:w-20 2xl:h-20 3xl:w-24 3xl:h-24 4xl:w-28 4xl:h-28 5xl:w-32 5xl:h-32 8xl:w-36 8xl:h-36 drop-shadow-lg" />
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl 2xl:text-7xl 3xl:text-8xl 4xl:text-9xl 5xl:text-[10rem] 8xl:text-[12rem] font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                Math2Visual
              </h1>
            </div>
            <p className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-150 text-muted-foreground text-sm sm:text-base md:text-lg lg:text-lg xl:text-xl 2xl:text-2xl 3xl:text-3xl 4xl:text-4xl 5xl:text-5xl 6xl:text-[3.5rem] 8xl:text-[4rem] w-full max-w-full mx-auto leading-relaxed font-medium">
              {t("app.subtitle")}
            </p>
          </div>

          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-300 mt-8 sm:mt-10 md:mt-12 lg:mt-14 xl:mt-16 2xl:mt-20 3xl:mt-24 8xl:mt-28 flex flex-col items-center gap-6 sm:gap-8 md:gap-10 8xl:gap-12">
            <p className="text-sm sm:text-base md:text-lg lg:text-lg xl:text-xl 2xl:text-2xl 3xl:text-3xl 4xl:text-4xl 5xl:text-5xl 6xl:text-[3.5rem] 8xl:text-[4rem] italic text-foreground leading-relaxed font-medium">
              {analyticsEnabled ? t("landing.modeQuestion") : t("landing.roleQuestion")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 w-full sm:w-auto">
              <Button
                onClick={() => handleRoleSelect("student")}
                variant="secondary"
                className="min-w-[200px] bg-secondary !text-secondary-foreground !responsive-text-font-size button-responsive-size px-6 py-3 md:px-8 md:py-4 lg:px-10 lg:py-5 xl:px-12 xl:py-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                {t("landing.student")}
              </Button>
              <Button
                onClick={() => handleRoleSelect("teacher")}
                className="min-w-[200px] bg-primary !text-primary-foreground !responsive-text-font-size button-responsive-size px-6 py-3 md:px-8 md:py-4 lg:px-10 lg:py-5 xl:px-12 xl:py-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                {t("landing.teacher")}
              </Button>
              {analyticsEnabled && (
                <Button
                  onClick={() => handleRoleSelect("chatgpt")}
                  variant="outline"
                  className="min-w-[200px] bg-background !text-foreground !responsive-text-font-size button-responsive-size px-6 py-3 md:px-8 md:py-4 lg:px-10 lg:py-5 xl:px-12 xl:py-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 border-2"
                >
                  ChatGPT
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

