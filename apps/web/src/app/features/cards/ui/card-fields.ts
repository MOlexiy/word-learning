import type { CardInput } from '@wl/shared';

export type CardTextField = Exclude<keyof CardInput, 'name' | 'topic'>;

export interface CardFieldMeta {
  key: CardTextField;
  /** i18n-ключ підпису. */
  labelKey: `cards.fields.${CardTextField}`;
  multiline: boolean;
  /** Англійський текст, який має сенс озвучувати (переклад `means` — ні). */
  speakable: boolean;
}

const field = (key: CardTextField, multiline: boolean, speakable = true): CardFieldMeta => ({
  key,
  labelKey: `cards.fields.${key}`,
  multiline,
  speakable,
});

export const CARD_TEXT_FIELDS: readonly CardFieldMeta[] = [
  field('means', true, false),
  field('used', true),
  field('n', false),
  field('v', false),
  field('adj', false),
  field('adv', false),
  field('collocations', true),
];
