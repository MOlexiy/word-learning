import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { LoginRequest, RegisterRequest, UserProfile } from '@wl/shared';
import { NotifyService } from '../notify/notify.service';

/**
 * Стан сесії. Токени живуть у HttpOnly-куках, тож JS їх не бачить: «залогінений» = `/api/auth/me` відповів 200.
 * `user() === null` — гостьовий режим (дані в LocalStorage).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);

  readonly #user = signal<UserProfile | null>(null);
  readonly user = this.#user.asReadonly();
  readonly isAuthenticated = computed(() => this.#user() !== null);
  readonly role = computed(() => this.#user()?.role ?? null);

  /** Викликається в provideAppInitializer: 401 → інтерцептор спробує refresh → інакше гість. */
  async restoreSession(): Promise<void> {
    try {
      this.#user.set(await firstValueFrom(this.#http.get<UserProfile>('/api/auth/me')));
    } catch {
      this.#user.set(null);
    }
  }

  async login(dto: LoginRequest): Promise<UserProfile> {
    return this.#apply(await firstValueFrom(this.#http.post<UserProfile>('/api/auth/login', dto)));
  }

  async register(dto: RegisterRequest): Promise<UserProfile> {
    return this.#apply(await firstValueFrom(this.#http.post<UserProfile>('/api/auth/register', dto)));
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.#http.post<void>('/api/auth/logout', null));
    } finally {
      this.#user.set(null);
      await this.#router.navigateByUrl('/');
    }
  }

  /** Оновлення профілю після дій (заявка вчителю, refresh). */
  setProfile(profile: UserProfile): void {
    this.#user.set(profile);
  }

  /** Refresh не вдався: переходимо в гостьовий режим; якщо сесія була — ведемо на логін. */
  handleSessionExpired(): void {
    const wasAuthenticated = this.isAuthenticated();
    this.#user.set(null);
    if (!wasAuthenticated) return;
    this.#notify.info(this.#transloco.translate('auth.sessionExpired'));
    void this.#router.navigate(['/login'], { queryParams: { returnUrl: this.#router.url } });
  }

  #apply(profile: UserProfile): UserProfile {
    this.#user.set(profile);
    return profile;
  }
}
