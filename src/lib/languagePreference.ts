import type { Lang } from '../i18n';

export const LANGUAGE_COOKIE = 'w_platform_language';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function languageCookieValue(lang: Lang): string {
  return `${LANGUAGE_COOKIE}=${lang}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax; Secure`;
}

export function persistLanguage(lang: Lang, target: Pick<Document, 'cookie'> = document): void {
  target.cookie = languageCookieValue(lang);
}

export function readLanguage(cookieHeader: string): Lang | null {
  const value = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANGUAGE_COOKIE}=`))
    ?.slice(LANGUAGE_COOKIE.length + 1);
  return value === 'en' || value === 'zh' ? value : null;
}
