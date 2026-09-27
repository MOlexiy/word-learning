import { HttpClient, HttpContext } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { LoginRequest, RegisterRequest, UserProfile } from '@wl/shared';
import { BrowserStorage } from '../browser/browser-storage';
import { NotifyService } from '../notify/notify.service';
import { isServerDown, QUIET_REQUEST } from '../server/server-wake.interceptor';
import { SKIP_AUTH_REFRESH } from './token-refresh.service';

/**
 * Підказка «у цьому браузері є сесія»: true / false / немає (ще не перевіряли).
 * Самі куки HttpOnly, тож без неї довелося б на кожному старті чекати `/api/auth/me` —
 * а на безкоштовному хостингу це до хвилини, навіть для гостя.
 */
const SESSION_HINT_KEY = 'wl.session';

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
  readonly #storage = inject(BrowserStorage);

  readonly #user = signal<UserProfile | null>(null);
  readonly user = this.#user.asReadonly();
  readonly isAuthenticated = computed(() => this.#user() !== null);
  readonly role = computed(() => this.#user()?.role ?? null);

  /**
   * Викликається в provideAppInitializer.
   *  - Гість (підказка `false`): стартуємо одразу, сервер лише прогріваємо у фоні — поки людина дійде до входу, він прокинеться.
   *  - Інакше чекаємо `/api/auth/me` (index.html тим часом показує заставку): 401 → інтерцептор спробує refresh → гість.
   *  - Сервер так і не відповів: тимчасово гість, підказку не чіпаємо — наступного разу перевіримо знову.
   */
  async restoreSession(): Promise<void> {
    const hint = this.#storage.read(SESSION_HINT_KEY);
    if (hint === false) {
      this.#warmUpServer();
      return;
    }
    try {
      this.#apply(await firstValueFrom(this.#http.get<UserProfile>('/api/auth/me')));
    } catch (error) {
      this.#user.set(null);
      if (!isServerDown(error)) {
        this.#storage.write(SESSION_HINT_KEY, false);
      } else if (hint === true) {
        this.#notify.error(this.#transloco.translate('auth.restoreFailed'));
      }
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
      this.#storage.write(SESSION_HINT_KEY, false);
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
    this.#storage.write(SESSION_HINT_KEY, false);
    if (!wasAuthenticated) return;
    this.#notify.info(this.#transloco.translate('auth.sessionExpired'));
    void this.#router.navigate(['/login'], { queryParams: { returnUrl: this.#router.url } });
  }

  #apply(profile: UserProfile): UserProfile {
    this.#user.set(profile);
    this.#storage.write(SESSION_HINT_KEY, true);
    return profile;
  }

  /** Фоновий «будильник» для бекенда: без банера й без обробки помилок. */
  #warmUpServer(): void {
    const context = new HttpContext().set(QUIET_REQUEST, true).set(SKIP_AUTH_REFRESH, true);
    this.#http.get('/api/health', { context }).subscribe({ error: () => undefined });
  }
}
