import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, debounceTime, distinctUntilChanged, firstValueFrom, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorTranslator } from '../../core/i18n/error-translator.service';
import { NotifyService } from '../../core/notify/notify.service';
import { ProfileApi } from './profile.api';
import { StatusBadgeComponent } from './status-badge.component';

@Component({
  selector: 'wl-student-panel',
  imports: [StatusBadgeComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2 class="section-title">{{ 'profile.student.myTeacher' | transloco }}</h2>
      @if (auth.user()?.teacher; as teacher) {
        <div class="row">
          <strong>{{ teacher.username }}</strong>
          <wl-status-badge [status]="teacher.status" />
          <span class="spacer"></span>
          @if (teacher.status === 'rejected') {
            <button class="btn btn--sm" type="button" [disabled]="busy()" (click)="request(teacher.username)">
              {{ 'profile.student.resend' | transloco }}
            </button>
          }
          <button class="btn btn--ghost btn--sm" type="button" [disabled]="busy()" (click)="leave()">
            {{ 'profile.student.leave' | transloco }}
          </button>
        </div>
      } @else {
        <p class="muted">{{ 'profile.student.noTeacher' | transloco }}</p>
      }

      <label class="field">
        <span class="field__label">
          {{
            (auth.user()?.teacher ? 'profile.student.changeTeacher' : 'profile.student.findTeacher')
              | transloco
          }}
        </span>
        <input
          class="input"
          type="search"
          [placeholder]="'profile.student.searchPlaceholder' | transloco"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      </label>
      @if (results().length) {
        <ul class="list">
          @for (teacher of results(); track teacher.username) {
            <li class="list__item">
              <span>{{ teacher.username }}</span>
              <button
                class="btn btn--sm btn--primary"
                type="button"
                [disabled]="busy()"
                (click)="request(teacher.username)"
              >
                {{ 'profile.student.sendRequest' | transloco }}
              </button>
            </li>
          }
        </ul>
      } @else if (query().trim()) {
        <p class="muted">{{ 'profile.student.noResults' | transloco }}</p>
      }
    </section>
  `,
})
export class StudentPanelComponent {
  protected readonly auth = inject(AuthService);
  readonly #api = inject(ProfileApi);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);

  protected readonly busy = signal(false);
  protected readonly query = signal('');
  protected readonly results = toSignal(
    toObservable(this.query).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((q) =>
        q.trim() ? this.#api.searchTeachers(q.trim()).pipe(catchError(() => of([]))) : of([]),
      ),
    ),
    { initialValue: [] },
  );

  protected async request(teacherUsername: string): Promise<void> {
    await this.#run(async () => {
      this.auth.setProfile(await firstValueFrom(this.#api.requestTeacher(teacherUsername)));
      this.query.set('');
      this.#notify.success(
        this.#transloco.translate('profile.student.requestSent', { username: teacherUsername }),
      );
    });
  }

  protected async leave(): Promise<void> {
    await this.#run(async () => this.auth.setProfile(await firstValueFrom(this.#api.leaveTeacher())));
  }

  async #run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.busy.set(false);
    }
  }
}
