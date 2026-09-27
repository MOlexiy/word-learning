import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type CardImage, cardImageSchema, type ImageSearchResult } from '@wl/shared';
import { ENV, type Env } from '../../config/env';
import { ApiException } from '../../common/errors/api.exception';

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';
const PER_PAGE = 10;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const REQUEST_TIMEOUT_MS = 8_000;

interface PexelsPhoto {
  url: string;
  photographer: string;
  src: { medium: string };
}

/**
 * Пошук фото на Pexels. Ключ API лишається на сервері. Відповіді кешуються в пам'яті на добу:
 * однакові запити (та сама картка, «інша картинка») не витрачають ліміт Pexels.
 */
@Injectable()
export class PexelsImageSearch {
  readonly #logger = new Logger(PexelsImageSearch.name);
  readonly #cache = new Map<string, { expiresAt: number; result: ImageSearchResult }>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  async search(query: string, page: number): Promise<ImageSearchResult> {
    const apiKey = this.env.PEXELS_API_KEY;
    if (!apiKey) throw unavailable('PEXELS_API_KEY is not configured');

    const key = `${query.toLowerCase()}|${page}`;
    const cached = this.#cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const params = new URLSearchParams({
      query,
      page: String(page),
      per_page: String(PER_PAGE),
      orientation: 'landscape',
    });
    let response: Response;
    try {
      response = await fetch(`${PEXELS_SEARCH_URL}?${params}`, {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      this.#logger.warn(`Pexels request failed: ${String(error)}`);
      throw unavailable('Image search is temporarily unavailable');
    }
    if (!response.ok) {
      this.#logger.warn(`Pexels responded ${response.status}`);
      throw unavailable('Image search is temporarily unavailable');
    }

    const body = (await response.json()) as { photos?: PexelsPhoto[] };
    const result: ImageSearchResult = { images: (body.photos ?? []).flatMap(toCardImage) };
    this.#remember(key, result);
    return result;
  }

  #remember(key: string, result: ImageSearchResult): void {
    if (this.#cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.#cache.keys().next().value;
      if (oldest !== undefined) this.#cache.delete(oldest);
    }
    this.#cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  }
}

function toCardImage(photo: PexelsPhoto): CardImage[] {
  const parsed = cardImageSchema.safeParse({
    url: photo.src?.medium,
    author: photo.photographer ?? '',
    pageUrl: photo.url,
  });
  return parsed.success ? [parsed.data] : [];
}

function unavailable(message: string): ApiException {
  return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'IMAGES_UNAVAILABLE', message);
}
