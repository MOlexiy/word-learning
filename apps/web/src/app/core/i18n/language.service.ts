import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import en from 'zod/v4/locales/en.js';
import uk from 'zod/v4/locales/uk.js';
import { BrowserStorage } from '../browser/browser-storage';
import { type AppLang, DEFAULT_LANG, isAppLang, LANG_META } from './i18n.config';

const STORAGE_KEY = 'wl.lang';
/** Стандартні повідомлення Zod (min/max тощо) теж локалізуємо. Власні — це i18n-ключі `validation.*`. */
const ZOD_LOCALES: Record<AppLang, () => Parameters<typeof z.config>[0]> = { ua: uk, en };

/** Активна мова: вибір користувача (LocalStorage) → DEFAULT_LANG. */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly #transloco = inject(TranslocoService);
  readonly #storage = inject(BrowserStorage);
  readonly #document = inject(DOCUMENT);

  readonly #lang = signal<AppLang>(this.#detect());
  readonly lang = this.#lang.asReadonly();
  /** BCP-47 локаль для Intl (дати, сортування). */
  readonly locale = computed(() => LANG_META[this.#lang()].locale);

  /** До першого рендеру: завантажуємо переклади, щоб не було «миготіння» ключів. */
  async init(): Promise<void> {
    await this.#activate(this.#lang());
  }

  async use(lang: AppLang): Promise<void> {
    if (lang === this.#lang()) return;
    await this.#activate(lang);
    this.#storage.write(STORAGE_KEY, lang);
  }

  async #activate(lang: AppLang): Promise<void> {
    await firstValueFrom(this.#transloco.load(lang));
    this.#transloco.setActiveLang(lang);
    this.#lang.set(lang);
    this.#document.documentElement.lang = LANG_META[lang].htmlLang;
    z.config(ZOD_LOCALES[lang]());
  }

  /** Мову браузера не вгадуємо: без збереженого вибору — завжди DEFAULT_LANG. */
  #detect(): AppLang {
    const stored = this.#storage.read(STORAGE_KEY);
    return isAppLang(stored) ? stored : DEFAULT_LANG;
  }
}
