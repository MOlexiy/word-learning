import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CardsService } from './application/cards.service';
import { RandomCardService } from './application/random-card.service';
import { CardsRepository } from './domain/cards.repository';
import { PrismaCardsRepository } from './infrastructure/prisma-cards.repository';
import { CardsController } from './presentation/cards.controller';
import { StudentCardsController } from './presentation/student-cards.controller';

@Module({
  imports: [UsersModule],
  controllers: [CardsController, StudentCardsController],
  providers: [CardsService, RandomCardService, { provide: CardsRepository, useClass: PrismaCardsRepository }],
})
export class CardsModule {}
