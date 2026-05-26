import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NON_NUMERIC_CARDS } from '../../core/models/models';

/**
 * The voting deck. Cards are tinted by estimate magnitude (low = green,
 * medium = amber, high = red) using each card's rank within the numeric cards
 * of the current deck, so the colour logic adapts to any deck type. Neutral
 * cards ("?", "Pass") get a muted neutral style.
 */
@Component({
  selector: 'app-voting-cards',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="deck">
      @for (card of deck; track card) {
        <button
          class="poker-card level-{{ level(card) }}"
          [class.selected]="card === selected"
          [class.neutral]="isNeutral(card)"
          [disabled]="disabled"
          (click)="pick.emit(card)"
          [attr.aria-pressed]="card === selected"
        >
          <span class="corner tl">{{ display(card) }}</span>
          <span class="card-value">{{ display(card) }}</span>
          <span class="corner br">{{ display(card) }}</span>
        </button>
      }
    </div>
    @if (disabled) {
      <p class="muted text-center" style="margin-top:14px; font-size:13px">
        {{ disabledReason || 'Voting is closed.' }}
      </p>
    }
  `,
  styles: [`
    .deck { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
    .poker-card {
      width: 72px; height: 100px; border-radius: 14px; cursor: pointer;
      border: 1.5px solid var(--border-strong); background: var(--surface);
      color: var(--text); font-family: inherit; font-weight: 800; font-size: 26px;
      display: grid; place-items: center; transition: all 0.16s ease; position: relative;
      box-shadow: var(--shadow-sm); padding: 0;
    }
    .corner {
      position: absolute; font-size: 11px; font-weight: 700; opacity: 0.65;
    }
    .corner.tl { top: 7px; left: 9px; }
    .corner.br { bottom: 7px; right: 9px; transform: rotate(180deg); }
    .card-value { line-height: 1; }

    /* Estimate-level accents — subtle left/top tint, professional. */
    .poker-card.level-low    { border-color: #bfe3cd; }
    .poker-card.level-low .card-value    { color: var(--success); }
    .poker-card.level-medium { border-color: var(--exl-orange-light); }
    .poker-card.level-medium .card-value { color: var(--exl-orange-dark); }
    .poker-card.level-high   { border-color: #f3c0c0; }
    .poker-card.level-high .card-value   { color: var(--danger); }
    .poker-card.neutral { font-size: 18px; }
    .poker-card.neutral .card-value { color: var(--text-muted); }

    .poker-card:hover:not(:disabled) {
      transform: translateY(-8px); box-shadow: var(--shadow);
    }
    .poker-card.selected {
      background: linear-gradient(135deg, var(--exl-orange), var(--exl-orange-dark));
      border-color: var(--exl-orange-dark); transform: translateY(-10px);
      box-shadow: 0 12px 24px rgba(255, 106, 19, 0.35); animation: pop 0.3s ease;
    }
    .poker-card.selected .card-value,
    .poker-card.selected .corner { color: #fff; opacity: 1; }
    .poker-card:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (max-width: 560px) {
      .poker-card { width: 58px; height: 82px; font-size: 21px; }
      .corner { display: none; }
    }
  `],
})
export class VotingCardsComponent {
  @Input() deck: string[] = [];
  @Input() selected: string | null = null;
  @Input() disabled = false;
  @Input() disabledReason = '';
  @Output() pick = new EventEmitter<string>();

  isNeutral(card: string): boolean {
    return NON_NUMERIC_CARDS.has(card);
  }

  display(card: string): string {
    return card === 'Coffee' ? '☕' : card;
  }

  /** Classify a card into low / medium / high / neutral by its rank within the
   * deck's numeric cards (terciles), so colours scale with any deck. */
  level(card: string): 'low' | 'medium' | 'high' | 'neutral' {
    if (this.isNeutral(card)) return 'neutral';
    const numeric = this.deck.filter((c) => !this.isNeutral(c));
    const idx = numeric.indexOf(card);
    if (idx < 0 || numeric.length === 0) return 'neutral';
    const third = numeric.length / 3;
    if (idx < third) return 'low';
    if (idx < third * 2) return 'medium';
    return 'high';
  }
}
