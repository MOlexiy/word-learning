import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type {
  CardInput,
  ImportCardsRequest,
  ImportCardsResult,
  RandomPickResult,
  WordCard,
  WordCardSummary,
} from '@wl/shared';
import { CardNotFoundError, type CardsRepository } from './cards.repository';

const BASE = '/api/cards';

/** Авторизований режим: картки та прогрес рандому — у БД через REST API. */
@Injectable({ providedIn: 'root' })
export class ApiCardsRepository implements CardsRepository {
  readonly #http = inject(HttpClient);

  list(): Promise<WordCardSummary[]> {
    return firstValueFrom(this.#http.get<WordCardSummary[]>(BASE));
  }

  get(id: string): Promise<WordCard> {
    return this.#byId(id, this.#http.get<WordCard>(`${BASE}/${id}`));
  }

  view(id: string): Promise<WordCard> {
    return this.#byId(id, this.#http.post<WordCard>(`${BASE}/${id}/view`, null));
  }

  create(input: CardInput): Promise<WordCard> {
    return firstValueFrom(this.#http.post<WordCard>(BASE, input));
  }

  update(id: string, input: CardInput): Promise<WordCard> {
    return this.#byId(id, this.#http.put<WordCard>(`${BASE}/${id}`, input));
  }

  addTopic(id: string, text: string): Promise<WordCard> {
    return this.#byId(id, this.#http.post<WordCard>(`${BASE}/${id}/topics`, { text }));
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
