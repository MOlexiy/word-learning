import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { type Role, registerSchema } from '@wl/shared';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorTranslator } from '../../core/i18n/error-translator.service';
import { NotifyService } from '../../core/notify/notify.service';

@Component({
  selector: 'wl-register-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel panel--narrow">
      <h1>{{ 'auth.register.title' | transloco }}</h1>
      <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
        <label class="field">
          <span class="field__label">{{ 'auth.register.username' | transloco }}</span>
          <input class="input" formControlName="username" autocomplete="username" />
        </label>
        <label class="field">
          <span class="field__label">{{ 'auth.register.email' | transloco }}</span>
          <input class="input" type="email" formControlName="email" autocomplete="email" />
        </label>
        <label class="field">
          <span class="field__label">{{ 'auth.register.password' | transloco }}</span>
          <input class="input" type="password" formControlName="password" autocomplete="new-password" />
        </label>
        <fieldset class="field">
          <legend class="field__label">{{ 'auth.register.role' | transloco }}</legend>
          <div class="segmented">
            <label
              ><input type="radio" formControlName="role" value="student" />
              {{ 'roles.student' | transloco }}</label
            >
            <label
              ><input type="radio" formControlName="role" value="teacher" />
              {{ 'roles.teacher' | transloco }}</label
            >
          </div>
        </fieldset>
        @if (errorTexts().length) {
          <ul class="alert alert--error">
            @for (error of errorTexts(); track $index) {
              <li>{{ error }}</li>
            }
          </ul>
        }
        <button class="btn btn--primary" type="submit" [disabled]="busy()">
          {{ 'auth.register.submit' | transloco }}
        </button>
      </form>
      <p class="muted">
        {{ 'auth.register.haveAccount' | transloco }}
        <a routerLink="/login">{{ 'auth.register.login' | transloco }}</a>
      </p>
    </section>
  `,
})
export class RegisterPage {
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);

  protected readonly busy = signal(false);
  /** Сирі помилки (i18n-ключі, тексти Zod або помилки API) — перекладаються реактивно. */
  protected readonly errors = signal<unknown[]>([]);
  protected readonly errorTexts = computed(() =>
    this.errors().map((e) => (typeof e === 'string' ? this.#errors.text(e) : this.#errors.message(e))),
  );
  protected readonly form = inject(NonNullableFormBuilder).group({
    username: [''],
    email: [''],
    password: [''],
    role: ['student' as Role],
  });

  protected async submit(): Promise<void> {
    const parsed = registerSchema.safeParse(this.form.getRawValue());
    if (!parsed.success) {
      // Одне повідомлення на поле; ключі validation.* вже містять назву поля.
      const seen = new Set<string>();
      this.errors.set(
        parsed.error.issues
          .filter((issue) => !seen.has(String(issue.path[0])) && seen.add(String(issue.path[0])))
          .map((issue) => issue.message),
      );
      return;
    }
    this.busy.set(true);
    this.errors.set([]);
    try {
      await this.#auth.register(parsed.data);
      this.#notify.success(this.#transloco.translate('auth.register.created'));
      await this.#router.navigateByUrl('/profile');
    } catch (error: unknown) {
      this.errors.set([error]);
    } finally {
      this.busy.set(false);
    }
  }
}
