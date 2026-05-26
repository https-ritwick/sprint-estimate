import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container narrow">
      <span class="badge badge-orange">Guide</span>
      <h1>Using EXL Sprint Estimate</h1>
      <p class="lead">A quick walkthrough for Admins and participants.</p>

      <div class="card card-pad block">
        <h2>For Admins</h2>
        <ul class="list">
          <li><strong>Create a session</strong> and choose a deck (Fibonacci, Modified Fibonacci, T-Shirt or Powers of 2).</li>
          <li>Decide whether you'll estimate using the <em>"Will Admin estimate?"</em> toggle. Leave it off to facilitate only.</li>
          <li>Configure estimation rules: auto-reveal when everyone estimates, allow changes after reveal, and the per-story timer.</li>
          <li><strong>Add stories</strong> manually or <strong>import a CSV</strong> backlog.</li>
          <li>Share the session ID or invite link from the room top bar.</li>
          <li>During a round: select a story, let the team estimate, <strong>reveal</strong>, discuss, <strong>reset</strong> to re-estimate, then <strong>finalize</strong>.</li>
          <li>Use the <strong>timer</strong> to keep rounds tight, and <strong>remove</strong> any participant who joined by mistake.</li>
          <li>You can <strong>leave and rejoin</strong> with the same corporate ID without ending the session — your controls return automatically. The session only closes when you click <strong>End session</strong>.</li>
          <li>One admin can run <strong>multiple sessions at once</strong>; each has its own independent ID, link, participants and state.</li>
        </ul>
      </div>

      <div class="card card-pad block">
        <h2>For participants</h2>
        <ul class="list">
          <li>Open the invite link, enter your name, corporate ID and team — no roles to pick.</li>
          <li>Pick the card that matches your estimate. You can change it until the reveal (or after, if the Admin allows).</li>
          <li>If you're unsure, use <strong>?</strong>; to sit a round out, use <strong>Pass</strong>.</li>
          <li>When estimates are revealed, be ready to explain your reasoning — especially if you're an outlier.</li>
        </ul>
      </div>

      <div class="card card-pad block">
        <h2>CSV import format</h2>
        <p class="muted">Upload a CSV with the following columns (only <code>title</code> is required):</p>
        <pre class="code">story_id,title,description,acceptance_criteria,priority
JIRA-101,Login screen,OAuth + email,Redirects on success,High
JIRA-102,Dark mode,Theme toggle,Persists across sessions,Low</pre>
        <p class="soft" style="font-size:13px">Priority accepts Low, Medium, High or Critical (defaults to Medium). Rows without a title are skipped.</p>
      </div>

      <div class="cta-row">
        <a class="btn btn-primary btn-lg" routerLink="/create">Start a session</a>
        <a class="btn btn-ghost btn-lg" routerLink="/examples">See examples</a>
      </div>
    </div>
  `,
  styles: [`
    .narrow { max-width: 760px; }
    h1 { font-size: 30px; margin: 12px 0 14px; }
    .lead { font-size: 17px; color: var(--text-muted); margin-bottom: 24px; }
    .block { margin-bottom: 18px; }
    .block h2 { font-size: 18px; margin-bottom: 12px; }
    .list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 9px; }
    .list li { font-size: 14.5px; line-height: 1.5; }
    code { background: var(--surface-2); border: 1px solid var(--border); padding: 2px 6px; border-radius: 6px; font-size: 12px; color: var(--exl-orange-dark); }
    .code {
      background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px;
      padding: 14px; font-size: 12.5px; overflow-x: auto; margin: 12px 0; line-height: 1.5;
      font-family: ui-monospace, monospace;
    }
    .cta-row { display: flex; gap: 12px; margin-top: 22px; flex-wrap: wrap; }
  `],
})
export class GuideComponent {}
