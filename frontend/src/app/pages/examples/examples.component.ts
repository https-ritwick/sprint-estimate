import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-examples',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container narrow">
      <span class="badge badge-orange">Examples</span>
      <h1>Estimation decks &amp; scenarios</h1>
      <p class="lead">Pick the deck that fits how your team thinks about size.</p>

      <div class="deck-cards">
        @for (d of decks; track d.name) {
          <div class="card card-pad deck">
            <h3>{{ d.name }}</h3>
            <p class="muted">{{ d.desc }}</p>
            <div class="cards">
              @for (c of d.cards; track c.v) { <span class="mini level-{{ c.lvl }}">{{ c.v }}</span> }
            </div>
          </div>
        }
      </div>

      <div class="card card-pad block">
        <h2>A typical round</h2>
        <div class="scenario">
          <p><strong>Story:</strong> "As a user I can reset my password via email."</p>
          <p class="muted">Three engineers vote 3, 5 and 13. The 13 voter flags an unknown: the email provider integration isn't built yet. After a short discussion the team agrees to split out the integration and re-estimates the core story at <strong>5</strong>.</p>
          <p class="takeaway">The value wasn't the number — it was surfacing the hidden dependency before the sprint started.</p>
        </div>
      </div>

      <div class="cta-row">
        <a class="btn btn-primary btn-lg" routerLink="/create">Try it now</a>
        <a class="btn btn-ghost btn-lg" routerLink="/about">What is Sprint Estimate?</a>
      </div>
    </div>
  `,
  styles: [`
    .narrow { max-width: 820px; }
    h1 { font-size: 30px; margin: 12px 0 14px; }
    .lead { font-size: 17px; color: var(--text-muted); margin-bottom: 24px; }
    .deck-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .deck h3 { font-size: 16px; margin-bottom: 6px; }
    .deck p { font-size: 13.5px; margin-bottom: 12px; }
    .cards { display: flex; flex-wrap: wrap; gap: 8px; }
    .mini {
      min-width: 34px; height: 44px; padding: 0 8px; border-radius: 8px; font-weight: 800; font-size: 14px;
      display: grid; place-items: center; border: 1.5px solid var(--border-strong); background: var(--surface);
      color: var(--text-muted);
    }
    .mini.level-low { color: var(--success); border-color: #bfe3cd; }
    .mini.level-medium { color: var(--exl-orange-dark); border-color: var(--exl-orange-light); }
    .mini.level-high { color: var(--danger); border-color: #f3c0c0; }
    .mini.level-neutral { color: var(--text-soft); }
    .block { margin-bottom: 18px; }
    .block h2 { font-size: 18px; margin-bottom: 12px; }
    .scenario p { font-size: 14.5px; line-height: 1.55; margin-bottom: 10px; }
    .takeaway { color: var(--exl-orange-dark); font-weight: 600; }
    .cta-row { display: flex; gap: 12px; margin-top: 22px; flex-wrap: wrap; }
    @media (max-width: 640px) { .deck-cards { grid-template-columns: 1fr; } }
  `],
})
export class ExamplesComponent {
  decks = [
    { name: 'Fibonacci', desc: 'The classic. Widening gaps reflect growing uncertainty.', cards: [
      { v: '1', lvl: 'low' }, { v: '2', lvl: 'low' }, { v: '3', lvl: 'low' }, { v: '5', lvl: 'medium' },
      { v: '8', lvl: 'medium' }, { v: '13', lvl: 'high' }, { v: '21', lvl: 'high' }, { v: '?', lvl: 'neutral' },
    ]},
    { name: 'Modified Fibonacci', desc: 'Adds 0.5 and rounds higher numbers for larger backlogs.', cards: [
      { v: '0.5', lvl: 'low' }, { v: '1', lvl: 'low' }, { v: '2', lvl: 'low' }, { v: '5', lvl: 'medium' },
      { v: '20', lvl: 'high' }, { v: '40', lvl: 'high' }, { v: '100', lvl: 'high' }, { v: 'Pass', lvl: 'neutral' },
    ]},
    { name: 'T-Shirt Sizes', desc: 'Relative sizing for quick, coarse-grained triage.', cards: [
      { v: 'XS', lvl: 'low' }, { v: 'S', lvl: 'low' }, { v: 'M', lvl: 'medium' }, { v: 'L', lvl: 'medium' },
      { v: 'XL', lvl: 'high' }, { v: 'XXL', lvl: 'high' }, { v: '?', lvl: 'neutral' },
    ]},
    { name: 'Powers of 2', desc: 'Doubling scale favoured by some platform teams.', cards: [
      { v: '1', lvl: 'low' }, { v: '2', lvl: 'low' }, { v: '4', lvl: 'medium' }, { v: '8', lvl: 'medium' },
      { v: '16', lvl: 'high' }, { v: '32', lvl: 'high' }, { v: '64', lvl: 'high' }, { v: '?', lvl: 'neutral' },
    ]},
  ];
}
