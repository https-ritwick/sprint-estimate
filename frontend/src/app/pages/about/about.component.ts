import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container narrow">
      <span class="badge badge-orange">Overview</span>
      <h1>What is Sprint Estimate?</h1>
      <p class="lead">
        Sprint Estimate is a planning-poker-style estimation tool for agile teams. Instead of
        one person guessing, everyone estimates at once — surfacing different perspectives and
        driving a short, focused discussion to size work by consensus.
      </p>

      <div class="card card-pad block">
        <h2>How a round works</h2>
        <ol class="steps">
          <li><strong>Pick a story.</strong> The Admin selects a backlog item and reads it out, along with its acceptance criteria.</li>
          <li><strong>Everyone estimates privately.</strong> Each participant chooses an estimate card. Estimates stay hidden until the reveal.</li>
          <li><strong>Reveal together.</strong> All cards are revealed at once so no one anchors on anyone else.</li>
          <li><strong>Discuss outliers.</strong> The highest and lowest estimators explain their reasoning. Often they have information the others don't.</li>
          <li><strong>Re-estimate if needed.</strong> Repeat until the team converges, then finalize the estimate.</li>
        </ol>
      </div>

      <div class="card card-pad block">
        <h2>Why use cards?</h2>
        <p class="muted">
          The cards usually follow a Fibonacci-like sequence (1, 2, 3, 5, 8, 13…). The widening
          gaps reflect a simple truth: the larger a piece of work, the less precisely you can
          estimate it. The deck deliberately makes it hard to pretend you can tell 21 from 22.
        </p>
      </div>

      <div class="card card-pad block">
        <h2>Card meanings</h2>
        <div class="meaning-grid">
          <div class="m"><span class="chip low">Low</span><p>Small, well-understood work — green cards.</p></div>
          <div class="m"><span class="chip med">Medium</span><p>Moderate effort or some unknowns — amber cards.</p></div>
          <div class="m"><span class="chip high">High</span><p>Large or risky work that may need splitting — red cards.</p></div>
          <div class="m"><span class="chip neutral">? / Pass</span><p>Unsure, or abstaining from this round — neutral cards.</p></div>
        </div>
      </div>

      <div class="cta-row">
        <a class="btn btn-primary btn-lg" routerLink="/create">Create a session</a>
        <a class="btn btn-ghost btn-lg" routerLink="/guide">Read the guide</a>
      </div>
    </div>
  `,
  styles: [`
    .narrow { max-width: 760px; }
    h1 { font-size: 30px; margin: 12px 0 14px; }
    .lead { font-size: 17px; line-height: 1.6; color: var(--text-muted); margin-bottom: 24px; }
    .block { margin-bottom: 18px; }
    .block h2 { font-size: 18px; margin-bottom: 12px; }
    .steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; }
    .steps li { font-size: 14.5px; line-height: 1.55; }
    .meaning-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .m { display: flex; gap: 10px; align-items: flex-start; }
    .m p { font-size: 13.5px; color: var(--text-muted); }
    .chip { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; flex-shrink: 0; }
    .chip.low { background: var(--success-soft); color: var(--success); }
    .chip.med { background: var(--exl-orange-soft); color: var(--exl-orange-dark); }
    .chip.high { background: var(--danger-soft); color: var(--danger); }
    .chip.neutral { background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border); }
    .cta-row { display: flex; gap: 12px; margin-top: 22px; flex-wrap: wrap; }
    @media (max-width: 560px) { .meaning-grid { grid-template-columns: 1fr; } }
  `],
})
export class AboutComponent {}
