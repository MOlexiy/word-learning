import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ImageSearchResult } from '@wl/shared';

/** Пошук ілюстрацій через бекенд (проксі до Pexels, ключ API на сервері). Доступний і гостю. */
@Injectable({ providedIn: 'root' })
export class ImagesApi {
  readonly #http = inject(HttpClient);

  search(q: string, page: number): Promise<ImageSearchResult> {
    return firstValueFrom(this.#http.get<ImageSearchResult>('/api/images/search', { params: { q, page } }));
  }
}
