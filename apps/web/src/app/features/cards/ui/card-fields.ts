import type { CardInput } from '@wl/shared';

export type CardTextField = Exclude<keyof CardInput, 'name' | 'topic'>;

export interface CardFieldMeta {
  key: CardTextField;
  /** i18n-ключ підпису. */
  labelKey: `cards.fields.${CardTextField}`;
  multiline: boolean;
}

const field = (key: CardTextField, multiline: boolean): CardFieldMeta => ({
  key,
  labelKey: `cards.fields.${key}`,
  multiline,
});

export const CARD_TEXT_FIELDS: readonly CardFieldMeta[] = [
  field('means', true),
  field('used', true),
  field('n', false),
  field('v', false),
  field('adj', false),
  field('adv', false),
  field('collocations', true),
];
