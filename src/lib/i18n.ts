export type HomeLanguage = 'en' | 'zh';
export const languageStorageKey = 'pagewise.home.language';

export function currentLanguage(): HomeLanguage {
  return typeof document !== 'undefined' &&
    document.documentElement.dataset.homeLanguage !== 'en'
    ? 'zh'
    : 'en';
}

export function translate(en: string, zh: string): string {
  return currentLanguage() === 'en' ? en : zh;
}

export function applyHomeLanguage(language: HomeLanguage, persist = false) {
  const root = document.documentElement;
  if (!root.hasAttribute('data-home-language')) return;
  root.dataset.homeLanguage = language;
  root.lang = language === 'en' ? 'en' : 'zh-CN';
  document
    .querySelectorAll<HTMLElement>('[data-en][data-zh]')
    .forEach((element) => {
      element.textContent = element.getAttribute(`data-${language}`);
    });
  for (const attribute of ['aria-label', 'placeholder', 'content', 'title']) {
    document
      .querySelectorAll(`[data-en-${attribute}][data-zh-${attribute}]`)
      .forEach((element) => {
        const value = element.getAttribute(`data-${language}-${attribute}`);
        if (value !== null) element.setAttribute(attribute, value);
      });
  }
  if (persist) {
    try {
      localStorage.setItem(languageStorageKey, language);
    } catch {
      /* Language switching still works when storage is unavailable. */
    }
  }
  document.dispatchEvent(new Event('pagewise:language-change'));
}
