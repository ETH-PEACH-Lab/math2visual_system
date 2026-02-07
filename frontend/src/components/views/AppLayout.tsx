import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useAppState } from "@/hooks/useAppState";
import { startCursorTracking, stopCursorTracking, isAnalyticsEnabled, trackOutermostScroll } from "@/services/analyticsTracker";
import { LandingPage } from "./LandingPage";
import { ChatView } from "./ChatView";
import { InitialView } from "./InitialView";
import { TwoColumnView } from "./TwoColumnView";
import { ChatGPTView } from "./ChatGPTView";

export function AppLayout() {
  const appState = useAppState();
  const analyticsEnabled = isAnalyticsEnabled();
  const [selectedRole, setSelectedRole] = useState<"teacher" | "student" | "chatgpt" | null>(null);

  // Initialize analytics cursor tracking and body scroll tracking
  useEffect(() => {
    if (analyticsEnabled) {
      startCursorTracking();

      // Add scroll listener to body element
      const handleBodyScroll = (event: Event) => {
        trackOutermostScroll(event);
      };

      document.body.addEventListener('scroll', handleBodyScroll);

      return () => {
        stopCursorTracking();
        document.body.removeEventListener('scroll', handleBodyScroll);
      };
    }
  }, [analyticsEnabled]);

  const handleRoleSelect = (role: "teacher" | "student" | "chatgpt") => {
    setSelectedRole(role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/30">
      {!selectedRole && <LandingPage onRoleSelect={handleRoleSelect} />}
      {selectedRole === "student" && <ChatView />}
      {selectedRole === "chatgpt" && <ChatGPTView />}
      {selectedRole === "teacher" && (
        appState.hasCompletedGeneration ? (
          <TwoColumnView appState={appState} />
        ) : (
          <InitialView appState={appState} />
        )
      )}
      <Toaster />
    </div>
  );
}


