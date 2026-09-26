import en from './en.js';
import fr from './fr.js';

export const TRANSLATIONS = { en, fr };

export function getText(key, lang = 'en') {
  return TRANSLATIONS[lang]?.[key] || key;
}
