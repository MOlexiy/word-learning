import { createZodDto } from 'nestjs-zod';
import { addTopicSchema, cardInputSchema, importCardsSchema } from '@wl/shared';

export class CardInputDto extends createZodDto(cardInputSchema) {}
export class AddTopicDto extends createZodDto(addTopicSchema) {}
export class ImportCardsDto extends createZodDto(importCardsSchema) {}
