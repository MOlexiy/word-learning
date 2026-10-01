import { createZodDto } from 'nestjs-zod';
import {
  addDraftsSchema,
  addTopicSchema,
  cardDuplicatesBatchSchema,
  cardDuplicatesQuerySchema,
  cardInputSchema,
  cardSearchQuerySchema,
  createCardQuerySchema,
  importCardsSchema,
  removeTopicSchema,
  setCardImageSchema,
} from '@wl/shared';

export class CardInputDto extends createZodDto(cardInputSchema) {}
export class AddTopicDto extends createZodDto(addTopicSchema) {}
export class RemoveTopicDto extends createZodDto(removeTopicSchema) {}
export class SetCardImageDto extends createZodDto(setCardImageSchema) {}
export class ImportCardsDto extends createZodDto(importCardsSchema) {}
export class CardSearchQueryDto extends createZodDto(cardSearchQuerySchema) {}
export class CardDuplicatesQueryDto extends createZodDto(cardDuplicatesQuerySchema) {}
export class CardDuplicatesBatchDto extends createZodDto(cardDuplicatesBatchSchema) {}
export class CreateCardQueryDto extends createZodDto(createCardQuerySchema) {}
export class AddDraftsDto extends createZodDto(addDraftsSchema) {}
