import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { TranslateParams } from '../../core/i18n/i18n.config';
import { firstValueFrom, type Observable } from 'rxjs';
import type { StudentSummary } from '@wl/shared';
import { ErrorTranslator } from '../../core/i18n/error-translator.service';
import { NotifyService } from '../../core/notify/notify.service';
import { ProfileApi } from './profile.api';

@Component({
  selector: 'wl-teacher-panel',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2 class="section-title">
        {{ 'profile.teacher.requests' | transloco: { count: requests().length } }}
      </h2>
      @if (requests().length) {
        <ul class="list">
          @for (s of requests(); track s.username) {
            <li class="list__item">
              <span
                ><strong>{{ s.username }}</strong> <span class="muted">{{ s.email }}</span></span
              >
              <span class="row">
                <button
                  class="btn btn--sm btn--success"
                  type="button"
                  [title]="'profile.teacher.accept' | transloco"
                  [attr.aria-label]="'profile.teacher.accept' | transloco"
                  [disabled]="busy()"
                  (click)="act(api.accept(s.username), 'profile.teacher.accepted', { username: s.username })"
                >
                  ✓
                </button>
                <button
                  class="btn btn--sm btn--danger"
                  type="button"
                  [title]="'profile.teacher.reject' | transloco"
                  [attr.aria-label]="'profile.teacher.reject' | transloco"
                  [disabled]="busy()"
                  (click)="act(api.reject(s.username), 'profile.teacher.rejected')"
                >
                  ✕
                </button>
              </span>
            </li>
          }
        </ul>
      } @else {
        <p class="muted">{{ 'profile.teacher.noRequests' | transloco }}</p>
      }
    </section>

    <section class="panel">
      <h2 class="section-title">
        {{ 'profile.teacher.students' | transloco: { count: students().length } }}
      </h2>
      @if (students().length) {
        <ul class="list">
          @for (s of students(); track s.username) {
            <li class="list__item">
              <a [routerLink]="['/students', s.username]"
                ><strong>{{ s.username }}</strong></a
              >
              <button
                class="btn btn--sm btn--ghost"
                type="button"
                [disabled]="busy()"
                (click)="
                  act(api.removeStudent(s.username), 'profile.teacher.removed', { username: s.username })
                "
              >
                {{ 'profile.teacher.remove' | transloco }}
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="muted">{{ 'profile.teacher.noStudents' | transloco }}</p>
      }
    </section>
  `,
})
export class TeacherPanelComponent implements OnInit {
  protected readonly api = inject(ProfileApi);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);

  protected readonly requests = signal<StudentSummary[]>([]);
  protected readonly students = signal<StudentSummary[]>([]);
  protected readonly busy = signal(false);

  ngOnInit(): void {
    void this.#reload();
  }

  protected async act(
    request: Observable<void>,
    successKey: string,
    params?: TranslateParams,
  ): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(request, { defaultValue: undefined });
      this.#notify.success(this.#transloco.translate(successKey, params));
      await this.#reload();
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  async #reload(): Promise<void> {
    try {
      const [requests, students] = await Promise.all([
        firstValueFrom(this.api.requests()),
        firstValueFrom(this.api.students()),
      ]);
      this.requests.set(requests);
      this.students.set(students);
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    }
  }
}
