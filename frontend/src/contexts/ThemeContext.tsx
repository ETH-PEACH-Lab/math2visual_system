import React, { createContext, useContext, useState, useEffect } from 'react';
import { trackThemeToggle, isAnalyticsEnabled } from '@/services/analyticsTracker';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitialTheme = (): Theme => {
    const saved = localStorage.getItem('math2visual-theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Use system preference if no saved preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    // Fallback to light if matchMedia is not available
    return 'light';
  };

  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const updateDocumentClass = (currentTheme: Theme) => {
    const root = document.documentElement;
    if (currentTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  };

  const setTheme = (newTheme: Theme) => {
    if (isAnalyticsEnabled()) {
      trackThemeToggle(newTheme);
    }
    setThemeState(newTheme);
    localStorage.setItem('math2visual-theme', newTheme);
    updateDocumentClass(newTheme);
  };

  // Apply theme on mount and when theme changes
  useEffect(() => {
    updateDocumentClass(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

