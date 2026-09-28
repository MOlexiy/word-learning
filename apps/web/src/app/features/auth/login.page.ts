import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorTranslator } from '../../core/i18n/error-translator.service';
import { NotifyService } from '../../core/notify/notify.service';
import { CardStorageService } from '../cards/data/card-storage.service';

@Component({
  selector: 'wl-login-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel panel--narrow">
      <h1>{{ 'auth.login.title' | transloco }}</h1>
      <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
        <label class="field">
          <span class="field__label">{{ 'auth.login.login' | transloco }}</span>
          <input
            class="input"
            id="login-login"
            name="login"
            formControlName="login"
            autocomplete="username"
          />
        </label>
        <label class="field">
          <span class="field__label">{{ 'auth.login.password' | transloco }}</span>
          <input
            class="input"
            type="password"
            id="login-password"
            name="password"
            formControlName="password"
            autocomplete="current-password"
          />
        </label>
        @if (errorText()) {
          <p class="alert alert--error">{{ errorText() }}</p>
        }
        <button class="btn btn--primary" type="submit" [disabled]="busy() || form.invalid">
          {{ 'auth.login.submit' | transloco }}
        </button>
      </form>
      <p class="muted">
        {{ 'auth.login.noAccount' | transloco }}
        <a routerLink="/register">{{ 'auth.login.register' | transloco }}</a> ·
        {{ 'auth.login.or' | transloco }}
        <a routerLink="/">{{ 'auth.login.continueAsGuest' | transloco }}</a>
      </p>
    </section>
  `,
})
export class LoginPage {
  /** ?returnUrl=… (withComponentInputBinding прокидає і query-параметри). */
  readonly returnUrl = input<string>();

  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #notify = inject(NotifyService);
  readonly #storage = inject(CardStorageService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);

  protected readonly busy = signal(false);
  /** Сама помилка; текст рахується реактивно, тож перекладається при зміні мови. */
  protected readonly error = signal<unknown>(null);
  protected readonly errorText = computed(() => this.#errors.message(this.error()));
  protected readonly form = inject(NonNullableFormBuilder).group({
    login: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const user = await this.#auth.login(this.form.getRawValue());
      this.#notify.success(this.#transloco.translate('auth.login.welcome', { username: user.username }));
      if (this.#storage.guestCardCount() || this.#storage.guestDraftCount()) {
        this.#notify.info(this.#transloco.translate('auth.login.guestCardsHint'));
      }
      const target = this.returnUrl();
      await this.#router.navigateByUrl(target?.startsWith('/') && !target.startsWith('//') ? target : '/');
    } catch (error: unknown) {
      this.error.set(error);
    } finally {
      this.busy.set(false);
    }
  }
}
