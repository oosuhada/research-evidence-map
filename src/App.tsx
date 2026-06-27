import { AppRouter } from './app/AppRouter';
import { LocaleProvider } from './i18n/LocaleContext';

export function App() {
  return <LocaleProvider><AppRouter /></LocaleProvider>;
}
