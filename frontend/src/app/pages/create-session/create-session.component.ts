import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { StateService } from '../../core/services/state.service';
import { ToastService } from '../../core/services/toast.service';
import { DECK_OPTIONS, DeckType, SavedDefaults, SessionConfig, StoryInput } from '../../core/models/models';

/**
 * Session creation. Captures basic details, deck selection, configuration and
 * voting settings, with an option to persist the configuration locally as a
 * reusable default. Stories can optionally be pre-loaded from a CSV.
 */
@Component({
  selector: 'app-create-session',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container narrow">
      <div class="page-head">
        <h1>Create a Sprint Estimate session</h1>
        <p class="muted">You'll be the Admin for this room. Configure the deck and rules, then invite your team.</p>
      </div>

      <!-- Basic details -->
      <div class="card section fade-up">
        <div class="section-head"><span class="step">1</span><h2>Basic details</h2></div>
        <div class="section-body col">
          <div class="field">
            <label>Session name <span class="req">*</span></label>
            <input class="input" [(ngModel)]="roomName" placeholder="e.g. Sprint 42 Grooming" maxlength="80" />
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Project name</label>
              <input class="input" [(ngModel)]="projectName" placeholder="e.g. Atlas Platform" />
            </div>
            <div class="field">
              <label>Sprint name / number</label>
              <input class="input" [(ngModel)]="sprintName" placeholder="e.g. Sprint 42" />
            </div>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Your name <span class="req">*</span></label>
              <input class="input" [(ngModel)]="adminName" placeholder="e.g. Aak Kataria" maxlength="60" />
            </div>
            <div class="field">
              <label>Your corporate ID</label>
              <input class="input" [(ngModel)]="adminCorporateId" placeholder="e.g. EXL12345" />
            </div>
          </div>
          <div class="field">
            <label>Team / Department</label>
            <input class="input" [(ngModel)]="team" placeholder="e.g. Platform Engineering" />
          </div>
        </div>
      </div>

      <!-- Deck selection -->
      <div class="card section fade-up">
        <div class="section-head"><span class="step">2</span><h2>Estimation deck</h2></div>
        <div class="section-body">
          <div class="deck-grid">
            @for (d of decks; track d.type) {
              <button type="button" class="deck-option" [class.selected]="deckType === d.type" (click)="deckType = d.type">
                <div class="deck-name">{{ d.label }}</div>
                <div class="deck-preview">
                  @for (c of d.preview; track c) { <span class="mini-card">{{ c }}</span> }
                  <span class="mini-card more">…</span>
                </div>
                <span class="check-pill" *ngIf="deckType === d.type">Selected</span>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Configuration -->
      <div class="card section fade-up">
        <div class="section-head"><span class="step">3</span><h2>Configuration</h2></div>
        <div class="section-body col">
          <div class="grid-2">
            <div class="field">
              <label>Team velocity <span class="soft">(optional)</span></label>
              <input class="input" type="number" min="0" [(ngModel)]="velocity" placeholder="e.g. 30" />
            </div>
            <div class="toggle-field">
              <div>
                <div class="t-label">Share velocity with players</div>
                <div class="t-desc">Show the velocity target to all participants.</div>
              </div>
              <label class="switch"><input type="checkbox" [(ngModel)]="shareVelocity" /><span class="slider"></span></label>
            </div>
          </div>
          <div class="toggle-field">
            <div>
              <div class="t-label">Effort pointing enabled</div>
              <div class="t-desc">Estimate using story points (disable for discussion-only sessions).</div>
            </div>
            <label class="switch"><input type="checkbox" [(ngModel)]="effortPointing" /><span class="slider"></span></label>
          </div>
        </div>
      </div>

      <!-- Voting settings -->
      <div class="card section fade-up">
        <div class="section-head"><span class="step">4</span><h2>Estimation settings</h2></div>
        <div class="section-body col">
          <div class="toggle-field">
            <div>
              <div class="t-label">Will the Admin estimate?</div>
              <div class="t-desc">When enabled, the Admin estimates like a participant. When off, the Admin only manages the room.</div>
            </div>
            <label class="switch"><input type="checkbox" [(ngModel)]="adminVotes" /><span class="slider"></span></label>
          </div>
          <div class="toggle-field">
            <div>
              <div class="t-label">Auto-reveal after everyone estimates</div>
              <div class="t-desc">Reveal automatically once every eligible participant has chosen an estimate.</div>
            </div>
            <label class="switch"><input type="checkbox" [(ngModel)]="autoReveal" /><span class="slider"></span></label>
          </div>
          <div class="toggle-field">
            <div>
              <div class="t-label">Allow estimate changes after reveal</div>
              <div class="t-desc">Let participants change their estimate once they are shown.</div>
            </div>
            <label class="switch"><input type="checkbox" [(ngModel)]="allowChangeAfterReveal" /><span class="slider"></span></label>
          </div>
          <div class="toggle-field">
            <div>
              <div class="t-label">Auto-calculate score</div>
              <div class="t-desc">Compute average, median and a suggested estimate on reveal.</div>
            </div>
            <label class="switch"><input type="checkbox" [(ngModel)]="autoCalculate" /><span class="slider"></span></label>
          </div>
          <div class="toggle-field">
            <div>
              <div class="t-label">Enable story timer</div>
              <div class="t-desc">Allow the Admin to run a countdown timer per story.</div>
            </div>
            <label class="switch"><input type="checkbox" [(ngModel)]="enableTimer" /><span class="slider"></span></label>
          </div>
        </div>
      </div>

      <!-- Optional CSV import -->
      <div class="card section fade-up">
        <div class="section-head"><span class="step">5</span><h2>Import stories <span class="opt">optional</span></h2></div>
        <div class="section-body col">
          <p class="muted" style="font-size:13px">
            Pre-load a backlog from a CSV with columns:
            <code>story_id, title, description, acceptance_criteria, priority</code>.
            You can also add stories manually once inside the room.
          </p>
          <div class="upload-row">
            <input #fileInput type="file" accept=".csv" hidden (change)="onFile($event)" />
            <button type="button" class="btn btn-ghost" (click)="fileInput.click()">Choose CSV file</button>
            <span class="muted" style="font-size:13px">{{ csvFile ? csvFile.name + ' · ' + parsedCount() + ' stories ready' : 'No file selected' }}</span>
            @if (csvFile) { <button type="button" class="btn btn-sm" (click)="clearCsv(fileInput)">Clear</button> }
          </div>
          @if (csvError()) { <p class="err">{{ csvError() }}</p> }
        </div>
      </div>

      <div class="toggle-field save-default card section fade-up">
        <div>
          <div class="t-label">Save as default session settings</div>
          <div class="t-desc">Remember this configuration on this device for next time.</div>
        </div>
        <label class="switch"><input type="checkbox" [(ngModel)]="saveAsDefault" /><span class="slider"></span></label>
      </div>

      <div class="actions">
        <a routerLink="/" class="btn btn-ghost">← Cancel</a>
        <button class="btn btn-primary btn-lg" (click)="create()" [disabled]="loading() || !valid()">
          @if (loading()) { <span class="spinner sm"></span> Creating… }
          @else { Create session → }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .narrow { max-width: 720px; }
    .page-head { margin-bottom: 22px; }
    .page-head h1 { font-size: 26px; margin-bottom: 6px; }
    .section { margin-bottom: 18px; }
    .section-head {
      display: flex; align-items: center; gap: 12px; padding: 18px 22px;
      border-bottom: 1px solid var(--border);
    }
    .section-head h2 { font-size: 16px; }
    .step {
      width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
      background: var(--exl-orange-soft); color: var(--exl-orange-dark);
      display: grid; place-items: center; font-weight: 800; font-size: 13px;
    }
    .opt, .section-body code {
      font-size: 11px; font-weight: 600; color: var(--text-soft);
    }
    .section-body { padding: 20px 22px; }
    .section-body code {
      background: var(--surface-2); border: 1px solid var(--border);
      padding: 2px 6px; border-radius: 6px; font-size: 12px; color: var(--exl-orange-dark);
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .req { color: var(--danger); }

    .deck-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .deck-option {
      position: relative; text-align: left; cursor: pointer; font-family: inherit;
      background: var(--surface); border: 1.5px solid var(--border-strong);
      border-radius: var(--radius); padding: 16px; transition: all 0.15s ease;
    }
    .deck-option:hover { border-color: var(--exl-orange-light); }
    .deck-option.selected { border-color: var(--exl-orange); background: var(--exl-orange-tint); box-shadow: var(--ring); }
    .deck-name { font-weight: 700; font-size: 14px; margin-bottom: 10px; color: var(--text); }
    .deck-preview { display: flex; gap: 6px; flex-wrap: wrap; }
    .mini-card {
      min-width: 26px; height: 34px; padding: 0 6px; border-radius: 6px;
      border: 1px solid var(--border-strong); background: var(--surface-2);
      display: grid; place-items: center; font-weight: 700; font-size: 12px; color: var(--text-muted);
    }
    .mini-card.more { border-style: dashed; }
    .check-pill {
      position: absolute; top: 12px; right: 12px; font-size: 10px; font-weight: 700;
      text-transform: uppercase; color: var(--exl-orange-dark);
      background: var(--exl-orange-soft); padding: 2px 8px; border-radius: 999px;
    }

    .toggle-field {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 12px 0; border-bottom: 1px solid var(--border);
    }
    .toggle-field:last-child { border-bottom: none; }
    .t-label { font-weight: 600; font-size: 14px; }
    .t-desc { font-size: 12.5px; color: var(--text-muted); margin-top: 2px; max-width: 460px; }
    .save-default { padding: 16px 22px; }

    .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute; inset: 0; cursor: pointer; border-radius: 999px;
      background: var(--border-strong); transition: 0.2s;
    }
    .slider::before {
      content: ''; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px;
      background: #fff; border-radius: 50%; transition: 0.2s; box-shadow: var(--shadow-sm);
    }
    .switch input:checked + .slider { background: var(--exl-orange); }
    .switch input:checked + .slider::before { transform: translateX(20px); }

    .upload-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .err { color: var(--danger); font-size: 13px; }

    .actions { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
    .spinner.sm { width: 16px; height: 16px; border-width: 2px; }
    @media (max-width: 640px) {
      .grid-2, .deck-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class CreateSessionComponent implements OnInit {
  private api = inject(ApiService);
  private state = inject(StateService);
  private toast = inject(ToastService);
  private router = inject(Router);

  decks = DECK_OPTIONS;

  // basic
  roomName = '';
  projectName = '';
  sprintName = '';
  adminName = '';
  adminCorporateId = '';
  team = '';

  // deck + config
  deckType: DeckType = 'fibonacci';
  velocity: number | null = null;
  shareVelocity = true;
  effortPointing = true;

  // voting settings
  adminVotes = false;
  autoReveal = false;
  allowChangeAfterReveal = false;
  autoCalculate = true;
  enableTimer = true;

  saveAsDefault = false;

  // CSV
  csvFile: File | null = null;
  parsedStories = signal<StoryInput[]>([]);
  csvError = signal<string>('');
  parsedCount = () => this.parsedStories().length;

  loading = signal(false);

  ngOnInit(): void {
    const d = this.state.getDefaults();
    if (d) {
      this.deckType = d.deckType;
      this.adminVotes = d.adminVotes;
      this.shareVelocity = d.shareVelocity;
      this.effortPointing = d.effortPointing;
      this.autoReveal = d.autoReveal;
      this.allowChangeAfterReveal = d.allowChangeAfterReveal;
      this.autoCalculate = d.autoCalculate;
      this.enableTimer = d.enableTimer;
      this.team = d.team || '';
      this.adminCorporateId = d.adminCorporateId || '';
      this.saveAsDefault = true;
    }
  }

  valid(): boolean {
    return this.roomName.trim().length > 0 && this.adminName.trim().length > 0;
  }

  onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.csvError.set('');
    this.parsedStories.set([]);
    if (!file) { this.csvFile = null; return; }
    this.csvFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const stories = this.parseCsv(String(reader.result));
        if (stories.length === 0) {
          this.csvError.set('No valid stories found. Ensure there is a "title" column with values.');
        }
        this.parsedStories.set(stories);
      } catch (e) {
        this.csvError.set('Could not parse the CSV file.');
      }
    };
    reader.readAsText(file);
  }

  clearCsv(input: HTMLInputElement): void {
    this.csvFile = null;
    this.parsedStories.set([]);
    this.csvError.set('');
    input.value = '';
  }

  /** Minimal RFC-4180-ish CSV parser supporting quoted fields. */
  private parseCsv(text: string): StoryInput[] {
    const rows = this.splitRows(text);
    if (rows.length < 2) return [];
    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const col = (name: string) => header.indexOf(name);
    const ti = col('title');
    if (ti < 0) throw new Error('missing title column');
    const di = col('description');
    const ai = col('acceptance_criteria');
    const pi = col('priority');
    const si = col('story_id') >= 0 ? col('story_id') : col('jira_id');
    const valid = new Set(['Low', 'Medium', 'High', 'Critical']);
    const out: StoryInput[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const title = (row[ti] ?? '').trim();
      if (!title) continue;
      const pr = (row[pi] ?? '').trim();
      const priority = valid.has(this.titleCase(pr)) ? (this.titleCase(pr) as any) : 'Medium';
      out.push({
        title,
        description: (row[di] ?? '').trim(),
        acceptanceCriteria: (row[ai] ?? '').trim(),
        priority,
        jiraId: (row[si] ?? '').trim(),
      });
    }
    return out;
  }

  private titleCase(s: string): string {
    return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
  }

  private splitRows(text: string): string[][] {
    const rows: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); if (row.some((c) => c.trim() !== '')) rows.push(row); }
    return rows;
  }

  private buildConfig(): SessionConfig {
    return {
      projectName: this.projectName.trim(),
      sprintName: this.sprintName.trim(),
      deckType: this.deckType,
      adminVotes: this.adminVotes,
      velocity: this.velocity != null && !isNaN(this.velocity) ? Number(this.velocity) : null,
      shareVelocity: this.shareVelocity,
      effortPointing: this.effortPointing,
      autoReveal: this.autoReveal,
      allowChangeAfterReveal: this.allowChangeAfterReveal,
      autoCalculate: this.autoCalculate,
      enableTimer: this.enableTimer,
    };
  }

  create(): void {
    if (!this.valid()) return;
    this.loading.set(true);

    if (this.saveAsDefault) {
      const defaults: SavedDefaults = {
        deckType: this.deckType,
        adminVotes: this.adminVotes,
        shareVelocity: this.shareVelocity,
        effortPointing: this.effortPointing,
        autoReveal: this.autoReveal,
        allowChangeAfterReveal: this.allowChangeAfterReveal,
        autoCalculate: this.autoCalculate,
        enableTimer: this.enableTimer,
        team: this.team.trim(),
        adminCorporateId: this.adminCorporateId.trim(),
      };
      this.state.saveDefaults(defaults);
    } else {
      this.state.clearDefaults();
    }

    this.api
      .createRoom({
        roomName: this.roomName.trim(),
        adminName: this.adminName.trim(),
        adminCorporateId: this.adminCorporateId.trim(),
        team: this.team.trim(),
        config: this.buildConfig(),
      })
      .subscribe({
        next: (res) => {
          this.state.enter(res.room, res.user);
          const stories = this.parsedStories();
          if (stories.length > 0) {
            this.api.importStories(res.room.id, res.user.id, stories).subscribe({
              next: () => {
                this.toast.success(`Session created · ${stories.length} stories imported`);
                this.router.navigate(['/room', res.room.id]);
              },
              error: () => {
                this.toast.info('Session created, but story import failed. You can add stories in the room.');
                this.router.navigate(['/room', res.room.id]);
              },
            });
          } else {
            this.toast.success('Session created');
            this.router.navigate(['/room', res.room.id]);
          }
        },
        error: () => {
          this.loading.set(false);
          this.toast.error('Could not create session. Is the backend running?');
        },
      });
  }
}
