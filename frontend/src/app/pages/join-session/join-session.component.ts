import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { StateService } from '../../core/services/state.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * Join a session via invite link or room ID. Collects name, corporate ID and
 * team/department — there are no roles. The corporate ID flows through to the
 * participant list, activity logs and session summaries. If the joiner presents
 * the session creator's corporate ID and no admin is currently connected, the
 * backend restores Admin controls to them automatically.
 */
@Component({
  selector: 'app-join-session',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container narrow">
      <div class="card fade-up">
        <div class="card-head">
          <h2>Join Sprint Estimate</h2>
          <p class="muted">Enter your details to join the estimation session.</p>
        </div>
        <div class="card-body col">
          <div class="field">
            <label>Session ID <span class="req">*</span></label>
            <input class="input" [(ngModel)]="roomId" placeholder="room-xxxxxxxx" [readonly]="lockedRoom()" />
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Your name <span class="req">*</span></label>
              <input class="input" [(ngModel)]="name" placeholder="e.g. Priya Sharma" maxlength="60" />
            </div>
            <div class="field">
              <label>Corporate ID</label>
              <input class="input" [(ngModel)]="corporateId" placeholder="e.g. EXL12345" />
            </div>
          </div>
          <div class="field">
            <label>Team / Department</label>
            <input class="input" [(ngModel)]="team" placeholder="e.g. Platform Engineering" />
          </div>

          <button class="btn btn-primary btn-lg btn-block" (click)="join()" [disabled]="loading() || !valid()">
            @if (loading()) { <span class="spinner sm"></span> Joining… }
            @else { Join session → }
          </button>
          <a routerLink="/" class="muted text-center" style="font-size:13px">← Back to home</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .narrow { max-width: 560px; }
    .card-head { padding: 24px 24px 0; }
    .card-head h2 { font-size: 22px; margin-bottom: 4px; }
    .card-body { padding: 22px 24px 24px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .req { color: var(--danger); }
    .spinner.sm { width: 16px; height: 16px; border-width: 2px; }
    @media (max-width: 560px) { .grid-2 { grid-template-columns: 1fr; } }
  `],
})
export class JoinSessionComponent implements OnInit {
  private api = inject(ApiService);
  private state = inject(StateService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  roomId = '';
  name = '';
  corporateId = '';
  team = '';
  loading = signal(false);
  lockedRoom = signal(false);

  ngOnInit(): void {
    const rid = this.route.snapshot.paramMap.get('roomId');
    if (rid) {
      this.roomId = rid;
      this.lockedRoom.set(true);
    }
  }

  valid(): boolean {
    return this.roomId.trim().length > 0 && this.name.trim().length > 0;
  }

  join(): void {
    if (!this.valid()) return;
    const rid = this.roomId.trim();
    this.loading.set(true);
    this.api
      .joinRoom(rid, {
        name: this.name.trim(),
        team: this.team.trim(),
        corporateId: this.corporateId.trim(),
      })
      .subscribe({
        next: (res) => {
          this.state.enter(res.room, res.user);
          this.toast.success(`Joined "${res.room.name}"`);
          this.router.navigate(['/room', rid]);
        },
        error: (err) => {
          this.loading.set(false);
          if (err?.status === 404) this.toast.error('Session not found. Check the Session ID.');
          else if (err?.status === 410) this.toast.error('This session has ended.');
          else this.toast.error('Could not join. Is the backend running?');
        },
      });
  }
}
