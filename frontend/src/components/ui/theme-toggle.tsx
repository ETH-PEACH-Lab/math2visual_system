import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const getAriaLabel = () => {
    return theme === 'light' 
      ? (t('theme.light') || 'Light mode')
      : (t('theme.dark') || 'Dark mode');
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={getAriaLabel()}
      title={getAriaLabel()}
      className="h-8 sm:h-8 md:h-9 lg:h-10 xl:h-12 2xl:h-14 3xl:h-16 4xl:h-20 5xl:h-24 6xl:h-28 7xl:h-32 w-8 sm:w-8 md:w-9 lg:w-10 xl:w-12 2xl:w-14 3xl:w-16 4xl:w-20 5xl:w-24 6xl:w-28 7xl:w-32 p-0 flex items-center justify-center rounded-md"
    >
      {theme === 'dark' ? (
        <Moon className="responsive-smaller-icon-font-size" />
      ) : (
        <Sun className="responsive-smaller-icon-font-size" />
      )}
    </Button>
  );
};

