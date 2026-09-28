import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AddDraftsResult,
  DraftInput,
  StudentSummary,
  TeacherSummary,
  UserProfile,
  WordCard,
  WordCardSummary,
  WordDraft,
} from '@wl/shared';
import { searchParams } from '../cards/data/api-cards.repository';

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  readonly #http = inject(HttpClient);

  searchTeachers(query: string): Observable<TeacherSummary[]> {
    return this.#http.get<TeacherSummary[]>('/api/teachers', { params: { query } });
  }

  requestTeacher(teacherUsername: string): Observable<UserProfile> {
    return this.#http.put<UserProfile>('/api/profile/teacher', { teacherUsername });
  }

  leaveTeacher(): Observable<UserProfile> {
    return this.#http.delete<UserProfile>('/api/profile/teacher');
  }

  requests(): Observable<StudentSummary[]> {
    return this.#http.get<StudentSummary[]>('/api/teacher/requests');
  }

  students(): Observable<StudentSummary[]> {
    return this.#http.get<StudentSummary[]>('/api/teacher/students');
  }

  accept(username: string): Observable<void> {
    return this.#http.post<void>(`/api/teacher/requests/${encodeURIComponent(username)}/accept`, null);
  }

  reject(username: string): Observable<void> {
    return this.#http.post<void>(`/api/teacher/requests/${encodeURIComponent(username)}/reject`, null);
  }

  removeStudent(username: string): Observable<void> {
    return this.#http.delete<void>(`/api/teacher/students/${encodeURIComponent(username)}`);
  }

  studentCards(username: string, q?: string): Observable<WordCardSummary[]> {
    return this.#http.get<WordCardSummary[]>(`/api/teacher/students/${encodeURIComponent(username)}/cards`, {
      params: searchParams(q),
    });
  }

  studentDrafts(username: string): Observable<WordDraft[]> {
    return this.#http.get<WordDraft[]>(`/api/teacher/students/${encodeURIComponent(username)}/drafts`);
  }

  /** «Швидке слово» для учня: з'явиться в його чернетці з позначкою «від вчителя». */
  addStudentDrafts(username: string, items: DraftInput[]): Observable<AddDraftsResult> {
    return this.#http.post<AddDraftsResult>(`/api/teacher/students/${encodeURIComponent(username)}/drafts`, {
      items,
    });
  }

  /** Лише слова, які додав сам вчитель. */
  removeStudentDraft(username: string, id: string): Observable<void> {
    return this.#http.delete<void>(
      `/api/teacher/students/${encodeURIComponent(username)}/drafts/${encodeURIComponent(id)}`,
    );
  }

  studentCard(username: string, id: string): Observable<WordCard> {
    return this.#http.get<WordCard>(`/api/teacher/students/${encodeURIComponent(username)}/cards/${id}`);
  }
}
