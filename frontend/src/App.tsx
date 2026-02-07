import "./App.css";
import { HighlightingProvider } from "@/contexts/HighlightingContext";
import { DSLProvider } from "@/contexts/DSLContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/views/AppLayout";

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <HighlightingProvider>
          <DSLProvider>
            <AppLayout />
          </DSLProvider>
        </HighlightingProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
