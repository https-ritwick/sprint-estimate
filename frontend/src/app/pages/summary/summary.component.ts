import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ActivityLogComponent } from '../../components/activity-log/activity-log.component';
import { Room } from '../../core/models/models';

/**
 * Session summary / wrap-up. Shows finalized stories, headline stats, the full
 * activity log, and JSON/CSV export actions.
 */
@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule, RouterLink, ActivityLogComponent],
  template: `
    <div class="container">
      @if (loading()) {
        <div class="loading"><span class="spinner"></span></div>
      } @else if (room()) {
        @if (room(); as r) {
        <div class="head spread">
          <div>
            <span class="badge badge-orange">Session summary</span>
            <h1>{{ r.name }}</h1>
            <p class="muted">
              @if (r.config.projectName) { <span>{{ r.config.projectName }}</span> }
              @if (r.config.sprintName) { <span> · {{ r.config.sprintName }}</span> }
            </p>
          </div>
          <div class="row gap-sm">
            <a class="btn btn-ghost" [href]="exportUrl('csv')" target="_blank" rel="noopener">Export CSV</a>
            <a class="btn btn-primary" [href]="exportUrl('json')" target="_blank" rel="noopener">Export JSON</a>
          </div>
        </div>

        <div class="tiles">
          <div class="card card-pad tile"><div class="v">{{ r.stories.length }}</div><div class="l">Stories</div></div>
          <div class="card card-pad tile"><div class="v">{{ estimatedCount() }}</div><div class="l">Estimated</div></div>
          <div class="card card-pad tile"><div class="v">{{ totalPoints() }}</div><div class="l">Total points</div></div>
          <div class="card card-pad tile"><div class="v">{{ r.users.length }}</div><div class="l">Participants</div></div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="panel-head"><h3>Story estimates</h3></div>
            @if (r.stories.length === 0) {
              <div class="empty"><p class="muted">No stories in this session.</p></div>
            } @else {
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr><th>Story</th><th>Jira</th><th>Priority</th><th class="r">Final</th></tr>
                  </thead>
                  <tbody>
                    @for (s of r.stories; track s.id) {
                      <tr>
                        <td>{{ s.title }}</td>
                        <td class="mono">{{ s.jiraId || '—' }}</td>
                        <td><span class="badge priority-{{ s.priority }}">{{ s.priority }}</span></td>
                        <td class="r">
                          @if (s.finalEstimate) { <span class="final">{{ s.finalEstimate }}</span> }
                          @else { <span class="soft">—</span> }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          <app-activity-log [entries]="activityNewestFirst()" />
        </div>

        <div class="foot">
          <a class="btn btn-ghost" routerLink="/room/{{ r.id }}">← Back to room</a>
          <a class="btn" routerLink="/">Home</a>
        </div>
        }
      } @else {
        <div class="card card-pad text-center">
          <h2>Session not found</h2>
          <p class="muted">This room may have expired (sessions are in-memory and reset on server restart).</p>
          <a class="btn btn-primary" routerLink="/" style="margin-top:14px">Back to home</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .loading { min-height: 50vh; display: grid; place-items: center; }
    .head { margin-bottom: 22px; flex-wrap: wrap; gap: 16px; }
    .head h1 { font-size: 26px; margin: 8px 0 4px; }
    .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
    .tile { text-align: center; }
    .tile .v { font-size: 26px; font-weight: 800; color: var(--exl-orange-dark); }
    .tile .l { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-soft); margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 18px; align-items: start; }
    .panel-head { padding: 16px 18px; border-bottom: 1px solid var(--border); }
    .panel-head h3 { font-size: 15px; }
    .empty { padding: 30px; text-align: center; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--border); }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-soft); font-weight: 700; }
    tr:last-child td { border-bottom: none; }
    .r { text-align: right; }
    .mono { font-family: ui-monospace, monospace; font-size: 12px; color: var(--text-muted); }
    .final { font-weight: 800; color: var(--success); background: var(--success-soft); padding: 2px 10px; border-radius: 999px; }
    .foot { display: flex; justify-content: space-between; margin-top: 22px; }
    @media (max-width: 900px) {
      .tiles { grid-template-columns: repeat(2, 1fr); }
      .grid { grid-template-columns: 1fr; }
    }
  `],
})
export class SummaryComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(true);
  room = signal<Room | null>(null);

  estimatedCount = computed(() => this.room()?.stories.filter((s) => s.status === 'estimated').length ?? 0);
  totalPoints = computed(() => {
    const stories = this.room()?.stories ?? [];
    let sum = 0;
    for (const s of stories) {
      const n = Number(s.finalEstimate);
      if (!isNaN(n)) sum += n;
    }
    return sum;
  });
  activityNewestFirst = computed(() => [...(this.room()?.activity ?? [])].reverse());

  ngOnInit(): void {
    const roomId = this.route.snapshot.paramMap.get('roomId') ?? '';
    this.api.getRoom(roomId).subscribe({
      next: (res) => { this.room.set(res.room); this.loading.set(false); },
      error: () => { this.room.set(null); this.loading.set(false); },
    });
  }

  exportUrl(fmt: 'json' | 'csv'): string {
    const id = this.room()?.id ?? '';
    return this.api.exportUrl(id, fmt);
  }
}
