import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AddDraftsResult, DraftInput, WordDraft } from '@wl/shared';
import type { DraftsRepository } from './drafts.repository';

const BASE = '/api/drafts';

@Injectable({ providedIn: 'root' })
export class ApiDraftsRepository implements DraftsRepository {
  readonly #http = inject(HttpClient);

  list(): Promise<WordDraft[]> {
    return firstValueFrom(this.#http.get<WordDraft[]>(BASE));
  }

  add(items: DraftInput[]): Promise<AddDraftsResult> {
    return firstValueFrom(this.#http.post<AddDraftsResult>(BASE, { items }));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.#http.delete<void>(`${BASE}/${encodeURIComponent(id)}`));
  }
}
