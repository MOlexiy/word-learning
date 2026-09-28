import { HttpClient, HttpErrorResponse, HttpParams, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  type ApiErrorBody,
  type CardDuplicateCheck,
  type CardImage,
  type CardInput,
  type ImportCardsRequest,
  type ImportCardsResult,
  type RandomPickResult,
  type WordCard,
  type WordCardSummary,
} from '@wl/shared';
import {
  CardExistsError,
  CardNotFoundError,
  type CardsRepository,
  type CreateCardOptions,
} from './cards.repository';

const BASE = '/api/cards';

/** `?q=…` для пошуку; без запиту — жодних параметрів (увесь каталог). */
export function searchParams(q?: string): HttpParams {
  const query = q?.trim();
  return query ? new HttpParams().set('q', query) : new HttpParams();
}

/** Авторизований режим: картки та прогрес рандому — у БД через REST API. */
@Injectable({ providedIn: 'root' })
export class ApiCardsRepository implements CardsRepository {
  readonly #http = inject(HttpClient);

  list(q?: string): Promise<WordCardSummary[]> {
    return firstValueFrom(this.#http.get<WordCardSummary[]>(BASE, { params: searchParams(q) }));
  }

  checkDuplicates(name: string): Promise<CardDuplicateCheck> {
    return firstValueFrom(this.#http.get<CardDuplicateCheck>(`${BASE}/duplicates`, { params: { name } }));
  }

  get(id: string): Promise<WordCard> {
    return this.#byId(id, this.#http.get<WordCard>(`${BASE}/${id}`));
  }

  view(id: string): Promise<WordCard> {
    return this.#byId(id, this.#http.post<WordCard>(`${BASE}/${id}/view`, null));
  }

  async create(input: CardInput, options: CreateCardOptions = {}): Promise<WordCard> {
    const params: Record<string, string> = options.fromDraftId ? { fromDraft: options.fromDraftId } : {};
    try {
      return await firstValueFrom(this.#http.post<WordCard>(BASE, input, { params }));
    } catch (error: unknown) {
      const body = error instanceof HttpErrorResponse ? (error.error as Partial<ApiErrorBody> | null) : null;
      if (body?.code === 'CARD_EXISTS' && body.meta?.['cardId']) {
        throw new CardExistsError(body.meta['cardId'], body.meta['name'] ?? input.name);
      }
      throw error;
    }
  }

  update(id: string, input: CardInput): Promise<WordCard> {
    return this.#byId(id, this.#http.put<WordCard>(`${BASE}/${id}`, input));
  }

  addTopic(id: string, text: string): Promise<WordCard> {
    return this.#byId(id, this.#http.post<WordCard>(`${BASE}/${id}/topics`, { text }));
  }

  removeTopic(id: string, index: number, text: string): Promise<WordCard> {
    return this.#byId(id, this.#http.delete<WordCard>(`${BASE}/${id}/topics/${index}`, { body: { text } }));
  }

  setImage(id: string, image: CardImage | null): Promise<WordCard> {
    return this.#byId(id, this.#http.put<WordCard>(`${BASE}/${id}/image`, { image }));
  }

  async remove(id: string): Promise<void> {
    await this.#byId(id, this.#http.delete<void>(`${BASE}/${id}`));
  }

  drawRandom(): Promise<RandomPickResult> {
    return firstValueFrom(this.#http.post<RandomPickResult>(`${BASE}/random`, null));
  }

  import(payload: ImportCardsRequest): Promise<ImportCardsResult> {
    return firstValueFrom(this.#http.post<ImportCardsResult>(`${BASE}/import`, payload));
  }

  async #byId<T>(id: string, request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error: unknown) {
      const notFound =
        error instanceof HttpErrorResponse &&
        (error.status === HttpStatusCode.NotFound || error.status === HttpStatusCode.BadRequest);
      throw notFound ? new CardNotFoundError(id) : error;
    }
  }
}
