import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CardsService } from './application/cards.service';
import { DraftsService } from './application/drafts.service';
import { RandomCardService } from './application/random-card.service';
import { CardsRepository } from './domain/cards.repository';
import { DraftsRepository } from './domain/drafts.repository';
import { PrismaCardsRepository } from './infrastructure/prisma-cards.repository';
import { PrismaDraftsRepository } from './infrastructure/prisma-drafts.repository';
import { CardsController } from './presentation/cards.controller';
import { DraftsController } from './presentation/drafts.controller';
import { StudentCardsController } from './presentation/student-cards.controller';
import { StudentDraftsController } from './presentation/student-drafts.controller';

@Module({
  imports: [UsersModule],
  controllers: [CardsController, StudentCardsController, DraftsController, StudentDraftsController],
  providers: [
    CardsService,
    RandomCardService,
    DraftsService,
    { provide: CardsRepository, useClass: PrismaCardsRepository },
    { provide: DraftsRepository, useClass: PrismaDraftsRepository },
  ],
})
export class CardsModule {}
