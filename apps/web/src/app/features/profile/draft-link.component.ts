import { ChangeDetectionStrategy, Component, computed, inject, type OnInit, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { ErrorTranslator } from '../../core/i18n/error-translator.service';
import { NotifyService } from '../../core/notify/notify.service';
import { ProfileApi } from './profile.api';

/** Те, що читалка замінює виділеним словом. */
const TEXT_PLACEHOLDER = '{text}';

/**
 * Персональне посилання «додати в чернетку» без входу: вставляється в читалку як
 * «свій словник» (як `google.com/search?q=define:{text}`), і виділене слово одразу
 * потрапляє в чернетку. Посилання можна перевипустити, якщо воно потрапило до чужих рук.
 */
@Component({
  selector: 'wl-draft-link',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2 class="section-title">{{ 'profile.draftLink.title' | transloco }}</h2>
      <p class="muted">{{ 'profile.draftLink.text' | transloco }}</p>
      @if (url(); as link) {
        <label class="field">
          <span class="field__label">{{ 'profile.draftLink.label' | transloco }}</span>
          <input
            class="input"
            id="draft-link-url"
            name="draftLink"
            type="text"
            readonly
            spellcheck="false"
            [value]="link"
            (focus)="$any($event.target).select()"
          />
        </label>
        <p class="hint muted">{{ 'profile.draftLink.hint' | transloco: { placeholder: placeholder } }}</p>
        <div class="actions">
          <button class="btn btn--primary" type="button" (click)="copy(link)">
            {{ 'profile.draftLink.copy' | transloco }}
          </button>
          <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="regenerate()">
            {{ 'profile.draftLink.regenerate' | transloco }}
          </button>
        </div>
      } @else if (error()) {
        <p class="alert alert--error">{{ error() }}</p>
        <button class="btn" type="button" (click)="load()">
          {{ 'profile.draftLink.retry' | transloco }}
        </button>
      } @else {
        <p class="muted">{{ 'common.loading' | transloco }}</p>
      }
    </section>
  `,
})
export class DraftLinkComponent implements OnInit {
  readonly #api = inject(ProfileApi);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);
  readonly #confirm = inject(ConfirmService);

  protected readonly placeholder = TEXT_PLACEHOLDER;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  readonly #token = signal<string | null>(null);
  protected readonly url = computed(() => {
    const token = this.#token();
    if (!token) return null;
    // Плейсхолдер — як є, без кодування: читалка шукає саме `{text}`.
    const base = new URL(`/api/drafts/add/${encodeURIComponent(token)}`, document.baseURI).toString();
    return `${base}?text=${TEXT_PLACEHOLDER}`;
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.error.set('');
    try {
      this.#token.set((await firstValueFrom(this.#api.draftLink())).token);
    } catch (error: unknown) {
      this.error.set(this.#errors.message(error));
    }
  }

  protected async copy(link: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      this.#notify.success(this.#transloco.translate('profile.draftLink.copied'));
    } catch {
      this.#notify.info(this.#transloco.translate('share.manual', { url: link }), { ttl: 15000 });
    }
  }

  protected async regenerate(): Promise<void> {
    const confirmed = await this.#confirm.ask({
      titleKey: 'profile.draftLink.regenerateTitle',
      messageKey: 'profile.draftLink.regenerateText',
      confirmKey: 'profile.draftLink.regenerateConfirm',
      danger: true,
    });
    if (!confirmed) return;
    this.busy.set(true);
    try {
      this.#token.set((await firstValueFrom(this.#api.regenerateDraftLink())).token);
      this.#notify.success(this.#transloco.translate('profile.draftLink.regenerated'));
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.busy.set(false);
    }
  }
}
