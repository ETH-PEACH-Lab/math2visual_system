import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, availableLanguages } = useLanguage();
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="content"
          className="gap-1.5 sm:gap-2 h-8 sm:h-8 md:h-9 lg:h-10 xl:h-12 2xl:h-14 3xl:h-16 4xl:h-20 5xl:h-24 6xl:h-28 7xl:h-32 8xl:h-36 px-2 sm:px-2.5 md:px-4 lg:px-6 xl:px-8 2xl:px-10 3xl:px-12 4xl:px-16 5xl:px-20 6xl:px-24 7xl:px-28 8xl:px-32 py-1.5 sm:py-2 md:py-2.5 lg:py-3 xl:py-4 2xl:py-5 3xl:py-6 4xl:py-8 5xl:py-10 6xl:py-12 7xl:py-14 8xl:py-16 rounded-md min-w-[5.5rem] sm:min-w-[6rem] md:min-w-[7rem] lg:min-w-[8rem] !responsive-text-font-size"
          aria-label={t('language.select')}
        >
          <Languages className="responsive-smaller-icon-font-size" />
          <span className="inline !responsive-text-font-size">
            {availableLanguages.find(lang => lang.code === language)?.name || 'English'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={0}
        alignOffset={0}
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] max-w-[var(--radix-dropdown-menu-trigger-width)] max-w-[90vw] overflow-visible p-1 md:p-1.5 lg:p-2"
      >
        {availableLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`cursor-pointer responsive-text-font-size flex items-center gap-1 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] whitespace-nowrap px-2 py-1.5 sm:px-3 sm:py-2 w-full min-w-0 mb-1 last:mb-0 ${
              language === lang.code ? 'bg-accent' : ''
            }`}
          >
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};



