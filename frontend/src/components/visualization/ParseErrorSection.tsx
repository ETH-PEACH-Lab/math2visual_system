import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ParseErrorSectionProps {
  message?: string;
}

export const ParseErrorSection = ({ message }: ParseErrorSectionProps) => {
  const { t } = useTranslation();
  const defaultMessage = message || t("visualization.parseErrorMessage");
  
  return (
    <div className="w-full space-y-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
      <div className="flex items-center gap-3">
        <AlertCircle className="responsive-icon-font-size text-destructive" />
        <h3 className="font-semibold text-destructive responsive-text-font-size">{t("visualization.parseError")}</h3>
      </div>
      <div className="responsive-text-font-size text-destructive">
        {defaultMessage}
      </div>
    </div>
  );
};
