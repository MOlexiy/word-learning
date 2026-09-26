import { Injectable } from '@angular/core';

/**
 * Безпечна обгортка над localStorage: приватний режим, заборонені cookies/site data
 * або переповнена квота не повинні ламати застосунок.
 */
@Injectable({ providedIn: 'root' })
export class BrowserStorage {
  read(key: string): unknown {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  }

  write(key: string, value: unknown): boolean {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
  }
}
