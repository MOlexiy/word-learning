import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'info' | 'success' | 'error';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotifyService {
  readonly #items = signal<AppNotification[]>([]);
  readonly items = this.#items.asReadonly();
  #nextId = 1;

  info(message: string): void {
    this.#push('info', message);
  }

  success(message: string): void {
    this.#push('success', message);
  }

  error(message: string): void {
    this.#push('error', message, 6000);
  }

  dismiss(id: number): void {
    this.#items.update((items) => items.filter((item) => item.id !== id));
  }

  #push(kind: NotificationKind, message: string, ttl = 4000): void {
    const id = this.#nextId++;
    this.#items.update((items) => [...items.slice(-3), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), ttl);
  }
}
