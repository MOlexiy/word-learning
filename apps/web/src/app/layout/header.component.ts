import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../core/auth/auth.service';
import { LanguageSwitcherComponent } from '../core/i18n/language-switcher.component';
import { RandomCardLauncher } from '../features/cards/data/random-card-launcher.service';
import { QuickAddService } from '../features/quick-add/quick-add.service';

@Component({
  selector: 'wl-header',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, LanguageSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <nav class="header__inner container">
        <a
          routerLink="/"
          class="brand"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          {{ 'app.name' | transloco }}
        </a>
        <span class="spacer"></span>
        <button
          class="btn btn--ghost"
          type="button"
          [disabled]="random.busy()"
          [attr.aria-label]="'nav.random' | transloco"
          (click)="random.open()"
        >
          🎲 <span class="hide-sm">{{ 'nav.random' | transloco }}</span>
        </button>
        <button
          class="btn btn--primary"
          type="button"
          [attr.aria-label]="
            (quickAdd.studentContext() ? 'nav.addWordForStudent' : 'nav.addWord')
              | transloco: { username: quickAdd.studentContext() ?? '' }
          "
          (click)="quickAdd.open()"
        >
          + <span class="hide-sm">{{ 'nav.addWord' | transloco }}</span>
        </button>
        <a class="btn btn--ghost" routerLink="/profile" routerLinkActive="is-active">
          👤 <span class="hide-sm">{{ auth.user()?.username ?? ('nav.guest' | transloco) }}</span>
        </a>
        <wl-language-switcher />
      </nav>
    </header>
  `,
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly random = inject(RandomCardLauncher);
  /** «+» відкриває швидке додавання (на сторінці учня у вчителя — слово для учня). */
  protected readonly quickAdd = inject(QuickAddService);
}
