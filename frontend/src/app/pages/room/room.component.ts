import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { StateService } from '../../core/services/state.service';
import { ToastService } from '../../core/services/toast.service';
import { ThemeService } from '../../core/services/theme.service';
import { VotingCardsComponent } from '../../components/voting-cards/voting-cards.component';
import { ParticipantsPanelComponent } from '../../components/participants-panel/participants-panel.component';
import { ActivityLogComponent } from '../../components/activity-log/activity-log.component';
import { NON_NUMERIC_CARDS, Priority, Story, User } from '../../core/models/models';

interface PendingModal {
  kind: 'delete-story' | 'remove-user' | 'leave' | 'end-session';
  story?: Story;
  user?: User;
}

/**
 * The live planning room. Provides its own top bar (the global navbar is hidden
 * here), the story backlog with manual + CSV import, the voting deck or results,
 * admin controls (reveal/reset/finalize), admin-only timer controls, the
 * participant panel with removal, and the real-time activity log.
 */
@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, FormsModule, VotingCardsComponent, ParticipantsPanelComponent, ActivityLogComponent],
  templateUrl: './room.component.html',
  styleUrl: './room.component.css',
})
export class RoomComponent implements OnInit {
  private api = inject(ApiService);
  private state = inject(StateService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  theme = inject(ThemeService);

  loading = signal(true);
  showAdd = signal(false);
  pending = signal<PendingModal | null>(null);

  timerDuration = 60;
  finalChoice = '';
  newStory: { title: string; jiraId: string; priority: Priority; description: string; acceptanceCriteria: string } = {
    title: '', jiraId: '', priority: 'Medium', description: '', acceptanceCriteria: '',
  };

  // state passthroughs
  room = this.state.room;
  me = this.state.me;
  connection = this.state.connection;
  isAdmin = this.state.isAdmin;
  canVote = this.state.canVote;
  activeStory = this.state.activeStory;
  myVote = this.state.myVote;
  votedCount = this.state.votedCount;
  votableCount = this.state.votableCount;
  results = this.state.results;
  activity = this.state.activity;
  pendingStories = this.state.pendingStories;

  cfg = computed(() => this.room()?.config ?? null);
  timer = this.state.timer;
  displayRemaining = this.state.displayRemaining;
  ended = this.state.ended;
  roleLabel = computed(() => (this.me()?.isAdmin ? 'Admin' : 'Participant'));

  constructor() {
    effect(() => {
      if (this.state.kicked()) {
        this.toast.error('You were removed from the session by the Admin.');
        this.router.navigate(['/']);
      }
    });
    // When the admin ends the session, send everyone to the summary.
    effect(() => {
      if (this.ended() && !this.loading()) {
        const id = this.room()?.id;
        this.toast.info('This session has been ended by the Admin.');
        this.router.navigate(id ? ['/summary', id] : ['/']);
      }
    });
  }

  // ----- lifecycle -------------------------------------------------------- //
  ngOnInit(): void {
    const roomId = this.route.snapshot.paramMap.get('roomId') ?? '';
    const me = this.state.me();
    const persisted = this.state.getPersisted();

    if (me && this.room()?.id === roomId) {
      this.loading.set(false);
      return;
    }
    if (persisted && persisted.roomId === roomId) {
      this.api.getRoom(roomId).subscribe({
        next: (res) => {
          this.state.enter(res.room, persisted.user);
          this.loading.set(false);
        },
        error: () => this.router.navigate(['/join', roomId]),
      });
      return;
    }
    this.router.navigate(['/join', roomId]);
  }

  // ----- voting ----------------------------------------------------------- //
  vote(card: string): void {
    const r = this.room(); const me = this.me();
    if (!r || !me) return;
    this.state.setLocalVote(card);
    this.api.vote(r.id, me.id, card).subscribe({ error: () => this.toast.error('Could not record vote.') });
  }

  reveal(): void {
    const r = this.room(); const me = this.me();
    if (!r || !me) return;
    this.api.reveal(r.id, me.id).subscribe({ error: () => this.toast.error('Could not reveal.') });
  }

  reset(): void {
    const r = this.room(); const me = this.me();
    if (!r || !me) return;
    this.api.reset(r.id, me.id).subscribe({ error: () => this.toast.error('Could not reset.') });
  }

  finalize(): void {
    const r = this.room(); const me = this.me();
    if (!r || !me || !this.finalChoice) return;
    this.api.finalize(r.id, me.id, this.finalChoice).subscribe({
      next: () => { this.toast.success('Estimate finalized.'); this.finalChoice = ''; },
      error: () => this.toast.error('Could not finalize.'),
    });
  }

  selectStory(s: Story): void {
    const r = this.room(); const me = this.me();
    if (!r || !me || !this.isAdmin()) return;
    this.api.setActiveStory(r.id, me.id, s.id).subscribe({ error: () => this.toast.error('Could not switch story.') });
  }

  // ----- stories ---------------------------------------------------------- //
  addStory(): void {
    const r = this.room(); const me = this.me();
    if (!r || !me || !this.newStory.title.trim()) return;
    this.api.addStory(r.id, me.id, {
      title: this.newStory.title.trim(),
      jiraId: this.newStory.jiraId.trim(),
      priority: this.newStory.priority,
      description: this.newStory.description.trim(),
      acceptanceCriteria: this.newStory.acceptanceCriteria.trim(),
    }).subscribe({
      next: () => {
        this.toast.success('Story added.');
        this.showAdd.set(false);
        this.newStory = { title: '', jiraId: '', priority: 'Medium', description: '', acceptanceCriteria: '' };
      },
      error: () => this.toast.error('Could not add story.'),
    });
  }

  onCsv(ev: Event, input: HTMLInputElement): void {
    const r = this.room(); const me = this.me();
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file || !r || !me) return;
    this.api.importStoriesCsv(r.id, me.id, file).subscribe({
      next: (res) => {
        this.toast.success(`${res.imported} stories imported.`);
        if (res.errors?.length) this.toast.info(`${res.errors.length} row(s) skipped.`);
        input.value = '';
      },
      error: (err) => {
        this.toast.error(err?.error?.detail ?? 'CSV import failed.');
        input.value = '';
      },
    });
  }

  // ----- timer (admin only) ----------------------------------------------- //
  startTimer(): void {
    const r = this.room(); const me = this.me();
    if (!r || !me) return;
    this.api.startTimer(r.id, me.id, this.timerDuration, !!this.cfg()?.autoReveal).subscribe({ error: () => this.toast.error('Could not start timer.') });
  }
  pauseTimer(): void {
    const r = this.room(); const me = this.me();
    if (r && me) this.api.pauseTimer(r.id, me.id).subscribe({ error: () => {} });
  }
  resumeTimer(): void {
    const r = this.room(); const me = this.me();
    if (r && me) this.api.resumeTimer(r.id, me.id).subscribe({ error: () => {} });
  }
  resetTimer(): void {
    const r = this.room(); const me = this.me();
    if (r && me) this.api.resetTimer(r.id, me.id).subscribe({ error: () => {} });
  }

  // ----- confirmation modal ----------------------------------------------- //
  ask(modal: PendingModal): void { this.pending.set(modal); }

  confirm(): void {
    const p = this.pending();
    if (!p) return;
    const r = this.room(); const me = this.me();
    if (p.kind === 'leave') {
      this.state.leave();
      this.router.navigate(['/']);
    } else if (p.kind === 'end-session' && r && me) {
      this.api.endSession(r.id, me.id).subscribe({
        next: () => this.toast.success('Session ended.'),
        error: () => this.toast.error('Could not end the session.'),
      });
    } else if (p.kind === 'delete-story' && p.story && r && me) {
      this.api.deleteStory(r.id, me.id, p.story.id).subscribe({
        next: () => this.toast.success('Story deleted.'),
        error: () => this.toast.error('Could not delete story.'),
      });
    } else if (p.kind === 'remove-user' && p.user && r && me) {
      this.api.removeUser(r.id, me.id, p.user.id).subscribe({
        next: () => this.toast.success(`${p.user!.name} was removed.`),
        error: () => this.toast.error('Could not remove participant.'),
      });
    }
    this.pending.set(null);
  }

  confirmTitle(p: PendingModal): string {
    if (p.kind === 'leave') return 'Leave this session?';
    if (p.kind === 'end-session') return 'End this session?';
    if (p.kind === 'delete-story') return 'Delete story?';
    return 'Remove participant?';
  }
  confirmBody(p: PendingModal): string {
    if (p.kind === 'leave') return 'The session stays open — you can rejoin later with the room ID.';
    if (p.kind === 'end-session') return 'This permanently closes the session for everyone and opens the summary. This cannot be undone.';
    if (p.kind === 'delete-story') return `"${p.story?.title}" will be permanently removed from the backlog.`;
    return `${p.user?.name} will be disconnected and their estimates cleared.`;
  }

  // ----- misc UI helpers -------------------------------------------------- //
  copyRoomId(): void {
    const id = this.room()?.id ?? '';
    navigator.clipboard?.writeText(id).then(() => this.toast.success('Room ID copied.'), () => {});
  }
  copyInvite(): void {
    const id = this.room()?.id ?? '';
    const link = `${location.origin}/join/${id}`;
    navigator.clipboard?.writeText(link).then(() => this.toast.success('Invite link copied.'), () => {});
  }
  goSummary(): void {
    const id = this.room()?.id;
    if (id) this.router.navigate(['/summary', id]);
  }

  watchReason(): string {
    if (this.me()?.isAdmin && !this.cfg()?.adminVotes) return 'You are managing this session and are not estimating.';
    return 'Estimating is not available to you.';
  }

  numericCards(): string[] {
    return (this.room()?.cardDeck ?? []).filter((c) => !NON_NUMERIC_CARDS.has(c));
  }

  formatTime(secs: number | null | undefined): string {
    if (secs == null) return '0:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  barPct(n: number, total: number): number {
    return total > 0 ? Math.round((n / total) * 100) : 0;
  }

  displayStat(v: number | string | null | undefined): string {
    if (v === null || v === undefined) return '—';
    return String(v);
  }
}
