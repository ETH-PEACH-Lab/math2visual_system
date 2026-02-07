import React from "react";
import { HighlightableTextarea } from "./highlightable-textarea";
import { cn } from "@/lib/utils";

type MWPTextEntryProps = {
  value: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  onSubmit?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  errorText?: string | null;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  highlightRanges?: Array<[number, number]>;
  containerClassName?: string;
  textareaClassName?: string;
  trailingContent?: React.ReactNode;
} & Omit<
  React.ComponentProps<typeof HighlightableTextarea>,
  | "value"
  | "onChange"
  | "rows"
  | "placeholder"
  | "disabled"
  | "onKeyDown"
  | "className"
  | "highlightRanges"
>;

export const MWPTextEntry = React.forwardRef<HTMLTextAreaElement, MWPTextEntryProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      onKeyDown,
      errorText,
      placeholder,
      rows = 5,
      disabled = false,
      highlightRanges,
      containerClassName,
      textareaClassName,
      trailingContent,
      ...textareaProps
    },
    ref
  ) => {
    const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
      if (onSubmit && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
        return;
      }
      if (onKeyDown) {
        onKeyDown(e);
      }
    };

    const hasTrailingContent = Boolean(trailingContent);

    return (
      <div className={cn("space-y-1", containerClassName)}>
        <div className="relative">
          <HighlightableTextarea
            ref={ref}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            spellCheck={false}
            disabled={disabled}
            highlightRanges={highlightRanges}
            className={cn(
              "w-full responsive-text-font-size",
              hasTrailingContent ? "pr-16" : undefined,
              textareaClassName
            )}
            onKeyDown={handleKeyDown}
            {...textareaProps}
          />

          {hasTrailingContent ? (
            <div className="absolute bottom-3 3xl:bottom-10 4xl:bottom-12 5xl:bottom-14 6xl:bottom-16 right-3 3xl:right-7 4xl:right-8 5xl:right-10 6xl:right-12 z-10 flex items-center gap-2">
              {trailingContent}
            </div>
          ) : null}
        </div>
        {errorText ? (
          <p className="text-destructive responsive-text-font-size">{errorText}</p>
        ) : null}
      </div>
    );
  }
);

MWPTextEntry.displayName = "MWPTextEntry";


