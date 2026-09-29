import { HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { type AddDraftsResult, cleanSelectedText, type DraftLink, draftInputSchema } from '@wl/shared';
import { ApiException } from '../../../common/errors/api.exception';
import { DraftLinkRepository } from '../domain/draft-link.repository';
import { DraftsService } from './drafts.service';

/** Токен: 192 біти випадковості → 32 символи base64url (безпечно в URL без кодування). */
const TOKEN_BYTES = 24;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Персональне посилання «додати в чернетку» без входу: читалка підставляє виділене слово
 * в `…/api/drafts/add/<token>?text={text}`. Токен дає лише право додати слово власнику,
 * нічого не читає і не видаляє; якщо він «витік» — перевипускається в кабінеті.
 */
@Injectable()
export class DraftLinkService {
  constructor(
    private readonly links: DraftLinkRepository,
    private readonly drafts: DraftsService,
  ) {}

  /** Наявний токен або новий (при першому зверненні). */
  async get(userId: string): Promise<DraftLink> {
    const token = await this.links.findToken(userId);
    return token ? { token } : this.regenerate(userId);
  }

  async regenerate(userId: string): Promise<DraftLink> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    await this.links.upsert(userId, token);
    return { token };
  }

  async add(token: string, text: string, meaning: string): Promise<AddDraftsResult> {
    const owner = TOKEN_PATTERN.test(token) ? await this.links.findOwner(token) : null;
    if (!owner) throw new ApiException(HttpStatus.NOT_FOUND, 'DRAFT_LINK_INVALID', 'Draft link is invalid');

    const parsed = draftInputSchema.safeParse({ word: cleanSelectedText(text), meaning: meaning.trim() });
    if (!parsed.success) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid word', {
        errors: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return this.drafts.add(owner, [parsed.data]);
  }
}
