import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { TranslateParams } from './i18n.config';
import { LanguageService } from './language.service';
import type { ApiErrorBody } from '@wl/shared';

/**
 * Перетворює будь-яку помилку на текст активною мовою:
 *  - API: `code` → errors.<code>; VALIDATION_FAILED → перше повідомлення поля;
 *  - мережа / proxy без бекенду → errors.network;
 *  - i18n-ключі (validation.*, errors.*) перекладаються, звичайний текст (Zod-локаль) лишається як є.
 *
 * Методи читають сигнал активної мови, тож у `computed()` текст помилки оновлюється при перемиканні мови.
 */
@Injectable({ providedIn: 'root' })
export class ErrorTranslator {
  readonly #transloco = inject(TranslocoService);
  readonly #language = inject(LanguageService);

  message(error: unknown): string {
    this.#language.lang();
    if (error === null || error === undefined) return '';
    if (error instanceof HttpErrorResponse) return this.#http(error);
    if (error instanceof Error && error.message) return this.text(error.message);
    return this.#transloco.translate('errors.unknown');
  }

  /** i18n-ключ → переклад; інакше повертає рядок без змін. */
  text(keyOrText: string, params?: TranslateParams): string {
    this.#language.lang();
    return this.#has(keyOrText) ? this.#transloco.translate(keyOrText, params) : keyOrText;
  }

  #http(error: HttpErrorResponse): string {
    const body = isApiErrorBody(error.error) ? error.error : null;
    const gatewayDown =
      error.status === 0 ||
      error.status === HttpStatusCode.BadGateway ||
      error.status === HttpStatusCode.ServiceUnavailable ||
      error.status === HttpStatusCode.GatewayTimeout ||
      // Dev-proxy Angular відповідає 500 text/plain, коли API не запущено.
      (error.status >= 500 && !body);
    if (gatewayDown) return this.#transloco.translate('errors.network');
    if (!body) return this.#transloco.translate('errors.unknown');

    const firstFieldError = body.errors?.[0]?.message;
    if (body.code === 'VALIDATION_FAILED' && firstFieldError) return this.text(firstFieldError);
    const byCode = `errors.${body.code}`;
    if (this.#has(byCode)) return this.#transloco.translate(byCode);
    return body.message || this.#transloco.translate('errors.unknown');
  }

  #has(key: string): boolean {
    const translation = this.#transloco.getTranslation(this.#transloco.getActiveLang());
    return Object.prototype.hasOwnProperty.call(translation, key);
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && typeof (value as ApiErrorBody).code === 'string';
}
