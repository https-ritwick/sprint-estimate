import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ActivityEntry,
  Results,
  Room,
  SavedDefaults,
  Session,
  Story,
  TimerState,
  User,
} from '../models/models';
import { WebSocketService } from './websocket.service';
import { ApiService } from './api.service';

const STORAGE_KEY = 'exl-pp-session';
const DEFAULTS_KEY = 'exl-pp-defaults';

/**
 * Central state for the active room. Holds the current room snapshot and the
 * local user identity as Angular signals, wires up the WebSocket stream, and
 * exposes computed derivations (active story, my vote, who voted, etc.).
 */
@Injectable({ providedIn: 'root' })
export class StateService {
  private ws = inject(WebSocketService);
  private api = inject(ApiService);

  readonly room = signal<Room | null>(null);
  readonly me = signal<User | null>(null);
  readonly results = signal<Results | null>(null);
  readonly connection = signal<'open' | 'closed' | 'error'>('closed');
  /** Set when the current user is removed by an admin. */
  readonly kicked = signal(false);

  /**
   * Canonical timer state, updated by both full room snapshots and the
   * lightweight per-second server ticks. This is the single source the UI
   * reads for the countdown — there is exactly one interval (below) driving
   * smooth display, so no duplicate intervals can accumulate.
   */
  readonly timer = signal<TimerState | null>(null);
  /** Smooth, locally-decremented seconds remaining (re-synced on every server update). */
  readonly displayRemaining = signal<number | null>(null);
  private countdownTimer: any = null;

  // ----- computed views ---------------------------------------------------- //
  readonly isAdmin = computed(() => !!this.me()?.isAdmin);
  readonly config = computed(() => this.room()?.config ?? null);

  /** Whether the current user is allowed to estimate in this session. */
  readonly canVote = computed(() => {
    const me = this.me();
    const cfg = this.config();
    if (!me || !cfg) return false;
    if (me.isAdmin) return cfg.adminVotes;
    return true;
  });

  readonly activeStory = computed<Story | null>(() => {
    const r = this.room();
    if (!r || !r.activeStoryId) return null;
    return r.stories.find((s) => s.id === r.activeStoryId) ?? null;
  });

  readonly myVote = computed<string | null>(() => {
    const story = this.activeStory();
    const me = this.me();
    if (!story || !me) return null;
    if (story.revealed) return story.votes[me.id] ?? this.localVote();
    return story.votedUserIds.includes(me.id) ? this.localVote() : null;
  });

  /** Users eligible to estimate, honouring the admin-votes toggle. */
  readonly votableUsers = computed(() => {
    const cfg = this.config();
    return (this.room()?.users ?? []).filter((u) => (u.isAdmin ? !!cfg?.adminVotes : true));
  });

  readonly votedCount = computed(() => {
    const story = this.activeStory();
    if (!story) return 0;
    const votable = new Set(this.votableUsers().map((u) => u.id));
    return story.votedUserIds.filter((id) => votable.has(id)).length;
  });
  readonly votableCount = computed(() => this.votableUsers().length);

  readonly pendingStories = computed(() =>
    (this.room()?.stories ?? []).filter((s) => s.status !== 'estimated'),
  );
  readonly estimatedStories = computed(() =>
    (this.room()?.stories ?? []).filter((s) => s.status === 'estimated'),
  );

  readonly activity = computed<ActivityEntry[]>(() => {
    const list = this.room()?.activity ?? [];
    // newest first for display
    return [...list].reverse();
  });

  /** True once the admin has explicitly ended the session. */
  readonly ended = computed(() => !!this.room()?.ended);

  // Local memory of this user's current selection (server hides it pre-reveal).
  private localVote = signal<string | null>(null);

  constructor() {
    this.ws.room$.subscribe((room) => {
      this.room.set(room);
      const story = room.activeStoryId ? room.stories.find((s) => s.id === room.activeStoryId) : null;
      const me = this.me();
      if (story && me && !story.votedUserIds.includes(me.id)) {
        this.localVote.set(null);
      }
      // Keep our cached identity fresh (e.g. connection flags).
      if (me) {
        const updated = room.users.find((u) => u.id === me.id);
        if (updated) this.me.set(updated);
      }
    });
    this.ws.status$.subscribe((s) => this.connection.set(s));
    this.ws.event$.subscribe((ev) => {
      if (ev === 'revealed') this.refreshResults();
      if (ev === 'reset') this.results.set(null);
    });
    this.ws.kicked$.subscribe((userId) => {
      if (this.me()?.id === userId) {
        this.kicked.set(true);
        this.ws.disconnect();
        this.clearPersisted();
      }
    });

    // Keep the canonical timer in sync from the server (snapshots + ticks) and
    // re-seed the smooth local countdown each time.
    this.ws.timer$.subscribe((t) => {
      this.timer.set(t);
      this.displayRemaining.set(t.isRunning || t.isPaused ? t.remainingSeconds : null);
    });

    // Exactly ONE interval for the whole app drives the smooth countdown. It
    // only decrements between server ticks; every server message re-syncs it,
    // so display never drifts and intervals never duplicate.
    this.countdownTimer = setInterval(() => {
      const t = this.timer();
      if (!t || !t.isRunning) return;
      const cur = this.displayRemaining();
      if (cur != null && cur > 0) this.displayRemaining.set(cur - 1);
    }, 1000);
  }

  /** Stop the countdown interval (called if the app is torn down). */
  destroy(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  // ----- lifecycle --------------------------------------------------------- //
  enter(room: Room, user: User): void {
    this.kicked.set(false);
    this.room.set(room);
    this.me.set(user);
    this.persist({ roomId: room.id, user });
    this.ws.connect(room.id, user.id);
  }

  setLocalVote(card: string): void {
    this.localVote.set(card);
  }

  refreshResults(): void {
    const r = this.room();
    if (!r) return;
    this.api.getResults(r.id).subscribe({
      next: (res) => this.results.set(res.results),
      error: () => this.results.set(null),
    });
  }

  leave(): void {
    const r = this.room();
    const me = this.me();
    if (r && me) this.api.leaveRoom(r.id, me.id).subscribe({ error: () => {} });
    this.ws.disconnect();
    this.room.set(null);
    this.me.set(null);
    this.results.set(null);
    this.clearPersisted();
  }

  // ----- session persistence (survive refresh) ---------------------------- //
  persist(session: Session): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  getPersisted(): Session | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  }
  clearPersisted(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  // ----- saved default session settings (localStorage) -------------------- //
  saveDefaults(defaults: SavedDefaults): void {
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
  }
  getDefaults(): SavedDefaults | null {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    return raw ? (JSON.parse(raw) as SavedDefaults) : null;
  }
  clearDefaults(): void {
    localStorage.removeItem(DEFAULTS_KEY);
  }
}
