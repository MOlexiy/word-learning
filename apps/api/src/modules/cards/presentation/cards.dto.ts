import { createZodDto } from 'nestjs-zod';
import {
  addTopicSchema,
  cardInputSchema,
  importCardsSchema,
  removeTopicSchema,
  setCardImageSchema,
} from '@wl/shared';

export class CardInputDto extends createZodDto(cardInputSchema) {}
export class AddTopicDto extends createZodDto(addTopicSchema) {}
export class RemoveTopicDto extends createZodDto(removeTopicSchema) {}
export class SetCardImageDto extends createZodDto(setCardImageSchema) {}
export class ImportCardsDto extends createZodDto(importCardsSchema) {}
