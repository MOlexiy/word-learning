import { inject, Injectable } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { type RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, combineLatest, of, switchMap } from 'rxjs';
import { LanguageService } from './language.service';

/** `title` у маршрутах — це i18n-ключ; заголовок вкладки оновлюється і при зміні мови. */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  readonly #title = inject(Title);
  readonly #transloco = inject(TranslocoService);
  readonly #key$ = new BehaviorSubject<string | undefined>(undefined);

  constructor() {
    super();
    // selectTranslate чекає завантаження словника, тож ключі не «миготять» до готовності перекладів.
    combineLatest([this.#key$, toObservable(inject(LanguageService).lang)])
      .pipe(
        switchMap(([key, lang]) =>
          combineLatest([
            key ? this.#transloco.selectTranslate<string>(key, {}, lang) : of(null),
            this.#transloco.selectTranslate<string>('app.name', {}, lang),
          ]),
        ),
      )
      .subscribe(([page, app]) => this.#title.setTitle(page ? `${page} · ${app}` : app));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.#key$.next(this.buildTitle(snapshot));
  }
}
