import { app } from 'electron';

export type SupportedLanguage = 'en' | 'de';

export function appLanguage(): SupportedLanguage {
  // Feeding the locale to `changeLanguage` or extracting the language causes problems.
  if (['de', 'de-AT', 'de-CH', 'de-DE', 'de-LI', 'de-LU'].includes(app.getLocale())) {
    return 'de';
  } else {
    return 'en';
  }
}
