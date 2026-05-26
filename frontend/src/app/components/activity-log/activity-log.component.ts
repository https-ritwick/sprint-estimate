import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityEntry } from '../../core/models/models';

/**
 * Real-time activity feed. Renders the room's activity log (newest first) with
 * a timestamp, an icon keyed off the event kind, and the pre-rendered message.
 */
@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="panel-head spread">
        <h3>Activity</h3>
        <span class="count">{{ entries.length }}</span>
      </div>
      @if (entries.length === 0) {
        <div class="empty">
          <p class="muted">No activity yet.</p>
        </div>
      } @else {
        <div class="log">
          @for (e of entries; track e.id) {
            <div class="entry">
              <span class="ico" [attr.data-kind]="iconFor(e.kind)">{{ iconFor(e.kind) }}</span>
              <div class="body">
                <div class="msg">{{ e.message }}</div>
                <div class="meta">
                  <span>{{ time(e.ts) }}</span>
                  <span *ngIf="e.corporateId" class="corp">· {{ e.corporateId }}</span>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .panel-head { padding: 16px 18px; border-bottom: 1px solid var(--border); }
    .panel-head h3 { font-size: 15px; }
    .count {
      background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border);
      font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 999px;
    }
    .empty { padding: 28px 18px; text-align: center; font-size: 13px; }
    .log { max-height: 380px; overflow-y: auto; padding: 6px 0; }
    .entry {
      display: flex; gap: 10px; padding: 9px 18px; align-items: flex-start;
      border-bottom: 1px solid var(--border);
    }
    .entry:last-child { border-bottom: none; }
    .ico {
      flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px; font-size: 13px;
      display: grid; place-items: center; background: var(--surface-2);
      border: 1px solid var(--border);
    }
    .body { min-width: 0; }
    .msg { font-size: 13px; font-weight: 500; line-height: 1.35; }
    .meta { font-size: 11px; color: var(--text-soft); margin-top: 2px; display: flex; gap: 5px; }
    .corp { font-weight: 600; }
  `],
})
export class ActivityLogComponent {
  @Input() entries: ActivityEntry[] = [];

  time(ts: number): string {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  iconFor(kind: string): string {
    const map: Record<string, string> = {
      session_created: '◆',
      user_joined: '→',
      user_left: '←',
      user_removed: '×',
      admin_removed_participant: '×',
      user_voted: '✓',
      vote_changed: '↻',
      admin_revealed: '◉',
      admin_reset: '⟲',
      admin_finalized: '★',
      story_added: '＋',
      story_updated: '✎',
      story_deleted: '−',
      story_changed: '»',
      stories_imported: '⇪',
      timer_started: '⏱',
      timer_paused: '⏸',
      timer_resumed: '▶',
      timer_reset: '⟲',
      timer_stopped: '■',
    };
    return map[kind] ?? '•';
  }
}
