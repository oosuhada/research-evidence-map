import { Languages } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  return <div className="language-toggle" role="group" aria-label={locale === 'ko' ? '언어 선택' : 'Language selection'}>
    <Languages size={13} aria-hidden="true" />
    <button type="button" className={locale === 'ko' ? 'active' : ''} onClick={() => setLocale('ko')} aria-pressed={locale === 'ko'}>한국어</button>
    <span>/</span>
    <button type="button" className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')} aria-pressed={locale === 'en'}>EN</button>
  </div>;
}
