import type { ErrorDisplayProps } from "@/types";

export const ErrorDisplay = ({ error }: ErrorDisplayProps) => {
  return (
    <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
      <p className="text-destructive font-medium">Error: {error}</p>
    </div>
  );
}; 