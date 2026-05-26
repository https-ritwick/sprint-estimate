import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Story, User } from '../../core/models/models';

/**
 * Live participant list. Shows each member's name, corporate ID, function and
 * vote status. Admins get a remove ("×") action on every other participant.
 */
@Component({
  selector: 'app-participants-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="panel-head spread">
        <h3>Participants <span class="count">{{ users.length }}</span></h3>
        <span class="badge badge-green" *ngIf="votableCount > 0">
          {{ votedCount }}/{{ votableCount }} voted
        </span>
      </div>
      <div class="list">
        @for (u of sortedUsers(); track u.id) {
          <div class="person" [class.is-me]="u.id === meId">
            <div class="avatar" [class.admin]="u.isAdmin">
              {{ initials(u.name) }}
              <span class="conn-dot dot" [class.dot-on]="u.isConnected" [class.dot-off]="!u.isConnected"></span>
            </div>
            <div class="person-info">
              <div class="person-name">
                {{ u.name }}
                <span *ngIf="u.id === meId" class="you-tag">you</span>
              </div>
              <div class="person-meta">
                @if (u.isAdmin) { <span class="badge badge-orange">Admin</span> }
                @else { <span class="soft">Participant</span> }
                <span class="corp" *ngIf="u.corporateId">· {{ u.corporateId }}</span>
                <span class="corp" *ngIf="u.team">· {{ u.team }}</span>
              </div>
            </div>
            <div class="vote-status">
              @if (u.isAdmin && !adminVotes) {
                <span class="soft" title="Does not estimate">—</span>
              } @else if (revealed && story) {
                <span class="vote-chip">{{ displayCard(story.votes[u.id]) }}</span>
              } @else if (hasVoted(u.id)) {
                <span class="check" title="Estimated">✓</span>
              } @else {
                <span class="thinking" title="Yet to estimate">···</span>
              }
            </div>
            @if (canManage && u.id !== meId) {
              <button class="remove-btn" title="Remove participant" (click)="remove.emit(u)">×</button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .panel-head { padding: 16px 18px; border-bottom: 1px solid var(--border); }
    .panel-head h3 { font-size: 15px; display: flex; align-items: center; gap: 8px; }
    .count {
      background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border);
      font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 999px;
    }
    .list { max-height: 460px; overflow-y: auto; }
    .person {
      display: flex; align-items: center; gap: 12px; padding: 12px 18px;
      border-bottom: 1px solid var(--border); transition: background 0.15s ease; position: relative;
    }
    .person:last-child { border-bottom: none; }
    .person.is-me { background: var(--exl-orange-tint); }
    .person:hover .remove-btn { opacity: 1; }
    .avatar {
      position: relative; width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
      display: grid; place-items: center; font-weight: 800; font-size: 14px;
      background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border);
    }
    .avatar.admin {
      background: linear-gradient(135deg, var(--exl-orange), var(--exl-orange-dark));
      color: #fff; border-color: var(--exl-orange-dark);
    }
    .conn-dot { position: absolute; bottom: -2px; right: -2px; border: 2px solid var(--surface); width: 11px; height: 11px; }
    .person-info { flex: 1; min-width: 0; }
    .person-name { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px; }
    .you-tag {
      font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--exl-orange-dark);
      background: var(--exl-orange-soft); padding: 1px 6px; border-radius: 6px;
    }
    .person-meta { font-size: 12px; margin-top: 2px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
    .corp { color: var(--text-soft); font-weight: 600; }
    .vote-status { flex-shrink: 0; }
    .vote-chip {
      display: grid; place-items: center; min-width: 34px; height: 34px; padding: 0 8px;
      background: var(--exl-orange-soft); color: var(--exl-orange-dark);
      border: 1.5px solid var(--exl-orange-light); border-radius: 10px; font-weight: 800; font-size: 14px;
      animation: pop 0.3s ease;
    }
    .check {
      display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
      background: var(--success-soft); color: var(--success); font-weight: 800;
    }
    .thinking {
      display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
      background: var(--surface-2); color: var(--text-soft); font-weight: 800; font-size: 12px;
      animation: pulse 1.5s ease infinite;
    }
    .remove-btn {
      flex-shrink: 0; width: 24px; height: 24px; border-radius: 7px; cursor: pointer;
      border: 1px solid var(--border); background: var(--surface-2); color: var(--text-soft);
      font-size: 16px; line-height: 1; opacity: 0; transition: all 0.15s ease;
      display: grid; place-items: center;
    }
    .remove-btn:hover { background: var(--danger-soft); color: var(--danger); border-color: var(--danger); }
  `],
})
export class ParticipantsPanelComponent {
  @Input() users: User[] = [];
  @Input() story: Story | null = null;
  @Input() meId = '';
  @Input() votedCount = 0;
  @Input() votableCount = 0;
  @Input() canManage = false;
  @Input() adminVotes = false;
  @Output() remove = new EventEmitter<User>();

  get revealed(): boolean {
    return !!this.story?.revealed;
  }

  sortedUsers(): User[] {
    return [...this.users].sort(
      (a, b) => (a.isAdmin === b.isAdmin ? a.name.localeCompare(b.name) : a.isAdmin ? -1 : 1),
    );
  }

  hasVoted(userId: string): boolean {
    return !!this.story?.votedUserIds.includes(userId);
  }

  initials(name: string): string {
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  displayCard(card: string | undefined): string {
    if (!card) return '—';
    return card === 'Coffee' ? '☕' : card;
  }
}
