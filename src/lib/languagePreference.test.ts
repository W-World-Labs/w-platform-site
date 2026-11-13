import { describe, expect, it } from 'vitest';
import { languageCookieValue, persistLanguage, readLanguage } from './languagePreference';

describe('language preference cookie', () => {
  it('writes a secure site-wide long-lived cookie', () => {
    expect(languageCookieValue('zh')).toBe(
      'w_platform_language=zh; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
    );
  });

  it('persists only the explicit URL language without navigation', () => {
    const target = { cookie: '' };
    persistLanguage('en', target);
    expect(target.cookie).toContain('w_platform_language=en');
  });

  it('reads only supported language values', () => {
    expect(readLanguage('theme=dark; w_platform_language=zh')).toBe('zh');
    expect(readLanguage('w_platform_language=fr')).toBeNull();
    expect(readLanguage('')).toBeNull();
  });
});
