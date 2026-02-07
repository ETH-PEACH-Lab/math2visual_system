import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { trackLanguageChange, isAnalyticsEnabled } from '@/services/analyticsTracker';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  availableLanguages: { code: string; name: string }[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<string>(i18n.language);

  const availableLanguages = [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
  ];

  const setLanguage = (lang: string) => {
    // Only track if language is actually changing
    if (lang !== language && isAnalyticsEnabled()) {
      trackLanguageChange(lang);
    }
    i18n.changeLanguage(lang);
    setLanguageState(lang);
    localStorage.setItem('math2visual-language', lang);
  };

  useEffect(() => {
    const savedLang = localStorage.getItem('math2visual-language');
    if (savedLang && savedLang !== language) {
      setLanguage(savedLang);
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, availableLanguages }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};



