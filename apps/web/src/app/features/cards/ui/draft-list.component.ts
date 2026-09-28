import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { WordDraft } from '@wl/shared';

/**
 * Компактний список чернетки: зліва слово і коротке значення, справа — «Заповнити →»
 * (стане повною карткою) та видалення. Великі плитки тут не потрібні: це черга на потім.
 */
@Component({
  selector: 'wl-draft-list',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="draft-list">
      @for (draft of drafts(); track draft.id) {
        <li
          #item
          class="draft"
          [class.is-highlighted]="draft.id === highlightId()"
          [attr.data-draft-id]="draft.id"
        >
          <div class="draft__text">
            <span class="draft__word" lang="en">{{ draft.word }}</span>
            @if (draft.meaning) {
              <span class="draft__meaning">{{ draft.meaning }}</span>
            }
            @if (draft.addedBy) {
              <span class="draft__from">{{
                'drafts.fromTeacher' | transloco: { username: draft.addedBy }
              }}</span>
            }
          </div>
          <div class="draft__actions">
            @if (canShare()) {
              <button
                type="button"
                class="icon-btn"
                [title]="'drafts.share' | transloco"
                [attr.aria-label]="'drafts.share' | transloco"
                (click)="share.emit(draft)"
              >
                <span aria-hidden="true">↗</span>
              </button>
            }
            @if (canDelete()(draft)) {
              <button
                type="button"
                class="icon-btn icon-btn--danger"
                [title]="'drafts.delete' | transloco"
                [attr.aria-label]="'drafts.deleteAria' | transloco: { word: draft.word }"
                [disabled]="busyId() === draft.id"
                (click)="remove.emit(draft)"
              >
                <span aria-hidden="true">🗑</span>
              </button>
            }
            @if (canFill()) {
              <button
                type="button"
                class="btn btn--primary btn--sm"
                [attr.aria-label]="'drafts.fillAria' | transloco: { word: draft.word }"
                (click)="fill.emit(draft)"
              >
                {{ 'drafts.fill' | transloco }}
              </button>
            }
          </div>
        </li>
      }
    </ul>
  `,
})
export class DraftListComponent {
  readonly drafts = input.required<readonly WordDraft[]>();
  /** Власник: перетворення на картку. У вчителя — ні. */
  readonly canFill = input(true);
  readonly canShare = input(false);
  readonly canDelete = input<(draft: WordDraft) => boolean>(() => true);
  /** Підсвітити і прокрутити до слова (посилання «Поділитися» веде сюди з `?draft=`). */
  readonly highlightId = input<string | null>(null);
  readonly busyId = input<string | null>(null);

  readonly fill = output<WordDraft>();
  readonly remove = output<WordDraft>();
  readonly share = output<WordDraft>();

  private readonly items = viewChildren<ElementRef<HTMLElement>>('item');
  #scrolledTo: string | null = null;

  constructor() {
    afterRenderEffect(() => {
      const id = this.highlightId();
      if (!id || id === this.#scrolledTo) return;
      const el = this.items().find((item) => item.nativeElement.dataset['draftId'] === id);
      if (!el) return;
      this.#scrolledTo = id;
      el.nativeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }
}
