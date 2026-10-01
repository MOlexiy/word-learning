import { Controller, Get, Header, HttpStatus, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AddDraftsResult, DraftLink } from '@wl/shared';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Public } from '../../../common/auth/decorators';
import { ApiException } from '../../../common/errors/api.exception';
import { AuthThrottlerGuard } from '../../../common/security/auth-throttler.guard';
import { DraftLinkService } from '../application/draft-link.service';

@Controller('drafts')
export class DraftLinkController {
  constructor(private readonly links: DraftLinkService) {}

  /** Токен власного посилання (створюється при першому зверненні). */
  @Get('link')
  get(@CurrentUser() user: AuthUser): Promise<DraftLink> {
    return this.links.get(user.username);
  }

  /** Новий токен; старе посилання перестає працювати. */
  @Post('link')
  regenerate(@CurrentUser() user: AuthUser): Promise<DraftLink> {
    return this.links.regenerate(user.username);
  }

  /**
   * Додати слово за посиланням — без входу. GET, бо читалки просто відкривають URL
   * (як `google.com/search?q=define:{text}`). Відповідь — коротка HTML-сторінка.
   */
  @Get('add/:token')
  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Robots-Tag', 'noindex')
  async add(
    @Param('token') token: string,
    @Query('text') text: unknown,
    @Query('meaning') meaning: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const t = texts(req.acceptsLanguages('uk', 'ua', 'en') || 'en');
    try {
      const result = await this.links.add(token, asString(text), asString(meaning));
      return page(t.title, resultMessage(result, t), true, t);
    } catch (error: unknown) {
      const code = error instanceof ApiException ? (error.getResponse() as { code?: string }).code : null;
      res.status(error instanceof ApiException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR);
      const message =
        code === 'DRAFT_LINK_INVALID'
          ? t.invalidLink
          : code === 'VALIDATION_FAILED'
            ? t.invalidWord
            : t.failed;
      return page(t.title, message, false, t);
    }
  }
}

function asString(value: unknown): string {
  if (Array.isArray(value)) return asString(value[0]);
  return typeof value === 'string' ? value : '';
}

type Texts = ReturnType<typeof texts>;

function texts(lang: string) {
  const ua = lang === 'uk' || lang === 'ua';
  return ua
    ? {
        lang: 'uk',
        title: 'WordLoop — чернетка',
        added: (w: string) => `«${w}» додано в чернетку`,
        addedRelated: (w: string, cards: string) =>
          `«${w}» додано в чернетку, але воно вже є у формах слова: ${cards}. Перевірте під час заповнення — зайве можна прибрати.`,
        inDraft: (w: string) => `«${w}» уже є в чернетці`,
        hasCard: (w: string) => `Картка «${w}» уже існує`,
        invalidLink: 'Посилання недійсне — скопіюйте нове в кабінеті WordLoop.',
        invalidWord: 'Не вдалося розпізнати слово: виділіть слово чи фразу до 200 символів.',
        failed: 'Не вдалося додати слово. Спробуйте ще раз.',
        open: 'Відкрити чернетку →',
      }
    : {
        lang: 'en',
        title: 'WordLoop — inbox',
        added: (w: string) => `“${w}” added to your inbox`,
        addedRelated: (w: string, cards: string) =>
          `“${w}” added to your inbox, but it's already a word form on: ${cards}. Check it when filling in the card — you can remove it then.`,
        inDraft: (w: string) => `“${w}” is already in your inbox`,
        hasCard: (w: string) => `The card “${w}” already exists`,
        invalidLink: 'This link is no longer valid — copy a new one in your WordLoop profile.',
        invalidWord: 'Could not read the word: select a word or phrase up to 200 characters.',
        failed: 'Could not add the word. Please try again.',
        open: 'Open inbox →',
      };
}

function resultMessage(result: AddDraftsResult, t: Texts): string {
  const [created] = result.created;
  const related = result.related.find((r) => r.word === created?.word);
  if (created && related) {
    const cards = related.related.map((card) => `${card.name} (${card.fields.join(', ')})`).join('; ');
    return t.addedRelated(created.word, cards);
  }
  if (created) return t.added(created.word);
  const [skipped] = result.skipped;
  return skipped?.reason === 'card' ? t.hasCard(skipped.word) : t.inDraft(skipped?.word ?? '');
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function page(title: string, message: string, ok: boolean, t: Texts): string {
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box; }
  main { max-width: 420px; text-align: center; }
  .icon { font-size: 48px; line-height: 1; color: ${ok ? '#2e7d32' : '#c62828'}; }
  p { font-size: 18px; margin: 16px 0 24px; }
  a { color: inherit; }
</style>
</head>
<body>
<main>
  <div class="icon" aria-hidden="true">${ok ? '✓' : '!'}</div>
  <p>${escapeHtml(message)}</p>
  <a href="/?view=inbox">${escapeHtml(t.open)}</a>
</main>
</body>
</html>`;
}
