import { createZodDto } from 'nestjs-zod';
import { addTopicSchema, cardInputSchema, importCardsSchema, removeTopicSchema } from '@wl/shared';

export class CardInputDto extends createZodDto(cardInputSchema) {}
export class AddTopicDto extends createZodDto(addTopicSchema) {}
export class RemoveTopicDto extends createZodDto(removeTopicSchema) {}
export class ImportCardsDto extends createZodDto(importCardsSchema) {}
