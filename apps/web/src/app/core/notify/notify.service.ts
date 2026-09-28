import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'info' | 'success' | 'error';

/** Кнопка в тості: «Повернути», «Заповнити наступне →» тощо. */
export interface NotificationAction {
  /** Вже перекладений текст кнопки. */
  label: string;
  run: () => void;
}

export interface NotifyOptions {
  action?: NotificationAction;
  /** Скільки мс показувати (тост з дією за замовчуванням живе довше). */
  ttl?: number;
}

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  message: string;
  action?: NotificationAction;
}

@Injectable({ providedIn: 'root' })
export class NotifyService {
  readonly #items = signal<AppNotification[]>([]);
  readonly items = this.#items.asReadonly();
  #nextId = 1;

  info(message: string, options?: NotifyOptions): void {
    this.#push('info', message, options);
  }

  success(message: string, options?: NotifyOptions): void {
    this.#push('success', message, options);
  }

  error(message: string, options?: NotifyOptions): void {
    this.#push('error', message, { ttl: 6000, ...options });
  }

  dismiss(id: number): void {
    this.#items.update((items) => items.filter((item) => item.id !== id));
  }

  /** Натиснули кнопку дії: виконати і закрити тост. */
  runAction(item: AppNotification): void {
    this.dismiss(item.id);
    item.action?.run();
  }

  #push(kind: NotificationKind, message: string, options: NotifyOptions = {}): void {
    const id = this.#nextId++;
    const ttl = options.ttl ?? (options.action ? 8000 : 4000);
    this.#items.update((items) => [...items.slice(-3), { id, kind, message, action: options.action }]);
    setTimeout(() => this.dismiss(id), ttl);
  }
}
