import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateRoomBody,
  CreateRoomResponse,
  JoinRoomResponse,
  Results,
  Room,
  StoryInput,
} from '../models/models';

/**
 * Thin wrapper around the backend REST API. Admin-only endpoints automatically
 * attach the X-User-Id header so the backend can authorize the caller.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/api`;

  private adminHeaders(userId: string): { headers: HttpHeaders } {
    return { headers: new HttpHeaders({ 'X-User-Id': userId }) };
  }

  createRoom(body: CreateRoomBody): Observable<CreateRoomResponse> {
    return this.http.post<CreateRoomResponse>(`${this.base}/rooms`, body);
  }

  getRoom(roomId: string): Observable<{ room: Room }> {
    return this.http.get<{ room: Room }>(`${this.base}/rooms/${roomId}`);
  }

  joinRoom(
    roomId: string,
    body: { name: string; team?: string; corporateId?: string },
  ): Observable<JoinRoomResponse> {
    return this.http.post<JoinRoomResponse>(`${this.base}/rooms/${roomId}/join`, body);
  }

  leaveRoom(roomId: string, userId: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/rooms/${roomId}/leave`, {}, this.adminHeaders(userId));
  }

  endSession(roomId: string, adminId: string): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/end`, {}, this.adminHeaders(adminId));
  }

  removeUser(roomId: string, adminId: string, userId: string): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/remove-user`, { userId }, this.adminHeaders(adminId));
  }

  addStory(roomId: string, userId: string, body: StoryInput): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/stories`, body, this.adminHeaders(userId));
  }

  importStories(roomId: string, userId: string, stories: StoryInput[]): Observable<{ room: Room; imported: number }> {
    return this.http.post<{ room: Room; imported: number }>(
      `${this.base}/rooms/${roomId}/stories/import`,
      { stories },
      this.adminHeaders(userId),
    );
  }

  importStoriesCsv(roomId: string, userId: string, file: File): Observable<{ room: Room; imported: number; errors: string[] }> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<{ room: Room; imported: number; errors: string[] }>(
      `${this.base}/rooms/${roomId}/stories/import-csv`,
      form,
      this.adminHeaders(userId),
    );
  }

  updateStory(roomId: string, userId: string, storyId: string, body: StoryInput): Observable<{ room: Room }> {
    return this.http.put<{ room: Room }>(`${this.base}/rooms/${roomId}/stories/${storyId}`, body, this.adminHeaders(userId));
  }

  deleteStory(roomId: string, userId: string, storyId: string): Observable<{ room: Room }> {
    return this.http.delete<{ room: Room }>(`${this.base}/rooms/${roomId}/stories/${storyId}`, this.adminHeaders(userId));
  }

  setActiveStory(roomId: string, userId: string, storyId: string): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/active-story?storyId=${storyId}`, {}, this.adminHeaders(userId));
  }

  vote(roomId: string, userId: string, card: string): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/vote`, { userId, card });
  }

  reveal(roomId: string, userId: string): Observable<{ room: Room; results: Results }> {
    return this.http.post<{ room: Room; results: Results }>(`${this.base}/rooms/${roomId}/reveal`, {}, this.adminHeaders(userId));
  }

  reset(roomId: string, userId: string): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/reset`, {}, this.adminHeaders(userId));
  }

  finalize(roomId: string, userId: string, estimate: string): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/finalize`, { estimate }, this.adminHeaders(userId));
  }

  getResults(roomId: string): Observable<{ results: Results }> {
    return this.http.get<{ results: Results }>(`${this.base}/rooms/${roomId}/results`);
  }

  startTimer(roomId: string, userId: string, durationSeconds: number, autoReveal: boolean): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/timer/start`, { durationSeconds, autoReveal }, this.adminHeaders(userId));
  }

  pauseTimer(roomId: string, userId: string): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/timer/pause`, {}, this.adminHeaders(userId));
  }

  resumeTimer(roomId: string, userId: string): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/timer/resume`, {}, this.adminHeaders(userId));
  }

  resetTimer(roomId: string, userId: string): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/timer/reset`, {}, this.adminHeaders(userId));
  }

  stopTimer(roomId: string, userId: string): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.base}/rooms/${roomId}/timer/stop`, {}, this.adminHeaders(userId));
  }

  exportUrl(roomId: string, fmt: 'json' | 'csv'): string {
    return `${this.base}/rooms/${roomId}/export?fmt=${fmt}`;
  }
}
