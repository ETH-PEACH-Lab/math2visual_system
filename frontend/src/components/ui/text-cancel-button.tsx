import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type TextCancelButtonProps = {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
};

/**
 * Text button with hover-revealed X icon, shared between header close and loading cancel.
 */
export function TextCancelButton({ label, onClick, ariaLabel, className }: TextCancelButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      className={cn(
        "group flex items-center gap-1 sm:gap-1.5 md:gap-2 lg:gap-2.5 xl:gap-3 2xl:gap-3.5 3xl:gap-4 4xl:gap-5 5xl:gap-6 8xl:gap-8",
        "text-gray-300 hover:text-destructive bg-transparent border-none transition-all duration-200",
        "text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl 3xl:text-4xl 4xl:text-5xl 5xl:text-6xl 8xl:text-7xl cursor-pointer",
        className
      )}
    >
      <X className="w-0 h-0 opacity-0 group-hover:w-4 group-hover:h-4 group-hover:opacity-100 sm:group-hover:w-5 sm:group-hover:h-5 md:group-hover:w-6 md:group-hover:h-6 lg:group-hover:w-7 lg:group-hover:h-7 xl:group-hover:w-8 xl:group-hover:h-8 2xl:group-hover:w-10 2xl:group-hover:h-10 3xl:group-hover:w-12 3xl:group-hover:h-12 4xl:group-hover:w-16 4xl:group-hover:h-16 5xl:group-hover:w-20 5xl:group-hover:h-20 8xl:group-hover:w-24 8xl:group-hover:h-24 transition-all duration-200" />
      {label}
    </button>
  );
}

