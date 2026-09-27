import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import type { ImportCardsResult, RandomPickResult, WordCard, WordCardSummary } from '@wl/shared';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser } from '../../../common/auth/decorators';
import { CardsService } from '../application/cards.service';
import { RandomCardService } from '../application/random-card.service';
import { AddTopicDto, CardInputDto, ImportCardsDto, RemoveTopicDto } from './cards.dto';

const CardId = () => Param('id', new ParseUUIDPipe({ version: '4' }));

@Controller('cards')
export class CardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly random: RandomCardService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<WordCardSummary[]> {
    return this.cards.list(user.username);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CardInputDto): Promise<WordCard> {
    return this.cards.create(user.username, dto);
  }

  /** Обирає випадкову доступну картку та ставить її на таймер. Далі фронт відкриває /cards/:id. */
  @Post('random')
  @HttpCode(HttpStatus.OK)
  drawRandom(@CurrentUser() user: AuthUser): Promise<RandomPickResult> {
    return this.random.draw(user.username);
  }

  /** Перенесення гостьових карток з LocalStorage в акаунт. */
  @Post('import')
  import(@CurrentUser() user: AuthUser, @Body() dto: ImportCardsDto): Promise<ImportCardsResult> {
    return this.cards.import(user.username, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @CardId() id: string): Promise<WordCard> {
    return this.cards.get(user.username, id);
  }

  /** Відкриття детальної сторінки (k + 1). Окремий POST, бо GET має бути ідемпотентним. */
  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  view(@CurrentUser() user: AuthUser, @CardId() id: string): Promise<WordCard> {
    return this.cards.view(user.username, id);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthUser, @CardId() id: string, @Body() dto: CardInputDto): Promise<WordCard> {
    return this.cards.update(user.username, id, dto);
  }

  @Post(':id/topics')
  addTopic(@CurrentUser() user: AuthUser, @CardId() id: string, @Body() dto: AddTopicDto): Promise<WordCard> {
    return this.cards.addTopic(user.username, id, dto.text);
  }

  /** Тіло `{ text }` — очікуваний вміст параграфа (захист від видалення не того після змін). */
  @Delete(':id/topics/:index')
  removeTopic(
    @CurrentUser() user: AuthUser,
    @CardId() id: string,
    @Param('index', new ParseIntPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) index: number,
    @Body() dto: RemoveTopicDto,
  ): Promise<WordCard> {
    return this.cards.removeTopic(user.username, id, index, dto.text);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @CardId() id: string): Promise<void> {
    return this.cards.remove(user.username, id);
  }
}
