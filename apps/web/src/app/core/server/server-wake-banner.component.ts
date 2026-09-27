import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ServerStatusService } from './server-status.service';

/** Неблокувальний банер, поки бекенд прокидається: інтерфейс лишається робочим, запит просто чекає. */
@Component({
  selector: 'wl-server-wake-banner',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status.waking()) {
      <div class="wake-banner" role="status" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <span>
          <strong>{{ 'server.waking.title' | transloco }}</strong>
          {{ 'server.waking.hint' | transloco }}
          @if (elapsed() >= 5) {
            <span class="wake-banner__time">{{
              'server.waking.elapsed' | transloco: { seconds: elapsed() }
            }}</span>
          }
        </span>
      </div>
    }
  `,
})
export class ServerWakeBannerComponent {
  protected readonly status = inject(ServerStatusService);
  readonly #now = signal(Date.now());

  protected readonly elapsed = computed(() => {
    const since = this.status.since();
    return since === null ? 0 : Math.max(0, Math.round((this.#now() - since) / 1000));
  });

  constructor() {
    // Тікаємо лише поки банер видно.
    effect((onCleanup) => {
      if (!this.status.waking()) return;
      this.#now.set(Date.now());
      const id = setInterval(() => this.#now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(id));
    });
  }
}
