import { Camera } from "lucide-react";

interface SessionAnalyticsDisplayProps {
  sessionId: string | null;
  isCapturingScreenshot?: boolean;
}

export function SessionAnalyticsDisplay({ sessionId, isCapturingScreenshot = false }: SessionAnalyticsDisplayProps) {
  if (!sessionId) return null;

  return (
    <div className="fixed bottom-0 right-0 z-50 bg-gray-100/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 px-2 py-1 responsive-smaller-text-font-size font-mono flex items-center gap-2">
      {isCapturingScreenshot && (
        <span className="flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded animate-in fade-in-0 duration-200">
          <Camera className="h-3 w-3 animate-pulse" />
          <span className="font-medium">Capturing</span>
        </span>
      )}
      <span>{sessionId}</span>
    </div>
  );
}

