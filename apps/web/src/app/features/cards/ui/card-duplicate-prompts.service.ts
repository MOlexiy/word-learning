import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { CardDuplicateRelated, CardWordDuplicates } from '@wl/shared';
import { ConfirmService } from '../../../core/confirm/confirm.service';

/** Що саме користувач робить, коли знайшлися схожі картки — від цього залежать підписи кнопок. */
export type DuplicateAction = 'create' | 'save' | 'draft';

/** Маршрут картки: власної (`/cards/:id`) чи учня (`/students/:username/cards/:id`). */
export type CardLink = (cardId: string) => readonly string[];

/** Що робити зі списком слів, частина яких уже є у формах інших карток. */
export type ListDuplicatesChoice = 'all' | 'without' | 'cancel';

const OWN_CARD: CardLink = (id) => ['/cards', id];

const RELATED_BUTTONS: Record<DuplicateAction, { cancelKey: string; confirmKey: string }> = {
  create: { cancelKey: 'cards.duplicates.notCreate', confirmKey: 'cards.duplicates.createAnyway' },
  save: { cancelKey: 'cards.duplicates.notSave', confirmKey: 'cards.duplicates.saveAnyway' },
  draft: { cancelKey: 'cards.duplicates.notAdd', confirmKey: 'cards.duplicates.addAnyway' },
};

/**
 * Однакові вікна про дублікати для нової картки, перейменування картки і швидкого слова / списку:
 *  - та сама назва — друга картка не потрібна, пропонуємо перейти до наявної;
 *  - слово вже є серед n / v / adj / adv інших карток — перепитуємо.
 * Посилання на картки відкриваються в новій вкладці.
 */
@Injectable({ providedIn: 'root' })
export class CardDuplicatePrompts {
  readonly #confirm = inject(ConfirmService);
  readonly #router = inject(Router);

  async offerExisting(cardId: string, name: string): Promise<void> {
    const open = await this.#confirm.ask({
      titleKey: 'cards.duplicates.existsTitle',
      messageKey: 'cards.duplicates.existsText',
      params: { name },
      confirmKey: 'cards.duplicates.openExisting',
      cancelKey: 'common.cancel',
    });
    if (open) await this.#router.navigate(['/cards', cardId]);
  }

  /** true — продовжити попри збіг (створити / зберегти / додати). */
  confirmRelated(
    name: string,
    related: readonly CardDuplicateRelated[],
    action: DuplicateAction,
    cardLink: CardLink = OWN_CARD,
  ): Promise<boolean> {
    const links = related.map((card) => ({
      label: card.name,
      hint: card.fields.join(', '),
      href: this.#href(cardLink, card.id),
    }));
    return this.#confirm.ask({
      titleKey: 'cards.duplicates.relatedTitle',
      messageKey: 'cards.duplicates.relatedText',
      params: { name },
      links,
      ...RELATED_BUTTONS[action],
    });
  }

  /**
   * Список слів (Bulk Add): одне вікно на всі слова, що вже є у формах інших карток.
   * `all` — додати все; `without` — додати решту без цих слів; `cancel` — нічого не додавати.
   */
  async chooseForList(
    items: readonly CardWordDuplicates[],
    cardLink: CardLink = OWN_CARD,
  ): Promise<ListDuplicatesChoice> {
    const links = items.flatMap((item) =>
      item.related.map((card) => ({
        label: `${item.word} → ${card.name}`,
        hint: card.fields.join(', '),
        href: this.#href(cardLink, card.id),
      })),
    );
    const choice = await this.#confirm.choose({
      titleKey: 'cards.duplicates.listTitle',
      messageKey: 'cards.duplicates.listText',
      params: { count: items.length, words: items.map((item) => item.word).join(', ') },
      links,
      cancelKey: 'common.cancel',
      altKey: 'cards.duplicates.listWithout',
      confirmKey: 'cards.duplicates.listAll',
    });
    return choice === 'confirm' ? 'all' : choice === 'alt' ? 'without' : 'cancel';
  }

  #href(cardLink: CardLink, cardId: string): string {
    return this.#router.serializeUrl(this.#router.createUrlTree([...cardLink(cardId)]));
  }
}
