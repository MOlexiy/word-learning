import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CardsService } from './application/cards.service';
import { DraftLinkService } from './application/draft-link.service';
import { DraftsService } from './application/drafts.service';
import { RandomCardService } from './application/random-card.service';
import { CardsRepository } from './domain/cards.repository';
import { DraftLinkRepository } from './domain/draft-link.repository';
import { DraftsRepository } from './domain/drafts.repository';
import { PrismaCardsRepository } from './infrastructure/prisma-cards.repository';
import { PrismaDraftLinkRepository } from './infrastructure/prisma-draft-link.repository';
import { PrismaDraftsRepository } from './infrastructure/prisma-drafts.repository';
import { CardsController } from './presentation/cards.controller';
import { DraftLinkController } from './presentation/draft-link.controller';
import { DraftsController } from './presentation/drafts.controller';
import { StudentCardsController } from './presentation/student-cards.controller';
import { StudentDraftsController } from './presentation/student-drafts.controller';

@Module({
  imports: [UsersModule],
  controllers: [
    CardsController,
    StudentCardsController,
    DraftLinkController,
    DraftsController,
    StudentDraftsController,
  ],
  providers: [
    CardsService,
    RandomCardService,
    DraftsService,
    DraftLinkService,
    { provide: CardsRepository, useClass: PrismaCardsRepository },
    { provide: DraftsRepository, useClass: PrismaDraftsRepository },
    { provide: DraftLinkRepository, useClass: PrismaDraftLinkRepository },
  ],
})
export class CardsModule {}
