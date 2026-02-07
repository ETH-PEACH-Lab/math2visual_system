import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import deTranslations from './locales/de.json';

// Get saved language or default to browser language
const getInitialLanguage = (): string => {
  const saved = localStorage.getItem('math2visual-language');
  if (saved) {
    return saved;
  }
  
  const browserLang = navigator.language.split('-')[0];
  return ['en', 'de'].includes(browserLang) ? browserLang : 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      de: { translation: deTranslations },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;



