import { Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TextCancelButton } from "@/components/ui/text-cancel-button";

interface SparklesLoadingProps {
  onAbort?: () => void;
  showAbortButton?: boolean;
}

export const SparklesLoading = ({ 
  onAbort,
  showAbortButton = true
}: SparklesLoadingProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center p-2">
      <div className="flex flex-col items-center gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3 2xl:gap-3">
        {/* Sparkles animation */}
        <div className="relative">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 xl:w-18 xl:h-18 2xl:w-20 2xl:h-20 3xl:w-28 3xl:h-28 4xl:w-36 4xl:h-36 5xl:w-48 5xl:h-48 text-blue-500 animate-spin" />
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 2xl:w-10 2xl:h-10 3xl:w-14 3xl:h-14 4xl:w-18 4xl:h-18 5xl:w-24 5xl:h-24 text-yellow-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Cancel button - text */}
        {showAbortButton && onAbort && (
          <TextCancelButton
            onClick={onAbort}
            label={t("common.cancel")}
            ariaLabel={t("common.cancelGeneration")}
          />
        )}
      </div>
    </div>
  );
};

