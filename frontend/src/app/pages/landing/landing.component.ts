import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * Marketing / home page. Clean enterprise hero with primary actions and a
 * concise feature grid. No emojis — corporate tone throughout.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container">
      <section class="hero card fade-up">
        <div class="hero-content">
          <span class="badge badge-orange">Internal · EXL Engineering</span>
          <h1 class="hero-title">Estimate sprints with <span class="accent">confidence</span>.</h1>
          <p class="hero-sub">
            A fast, real-time sprint estimation tool built for EXL sprint grooming.
            Create a session, invite your team, and reach consensus on story
            points — no spreadsheets, no guesswork.
          </p>
          <div class="row gap-sm hero-cta">
            <button class="btn btn-primary btn-lg" routerLink="/create">Create a session</button>
            <button class="btn btn-ghost btn-lg" routerLink="/join">Join a session</button>
          </div>
          <div class="hero-links">
            <a routerLink="/about">What is Sprint Estimate?</a>
            <span class="dot-sep"></span>
            <a routerLink="/guide">Read the guide</a>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          @for (c of demoCards; track c.v) {
            <div class="float-card level-{{ c.lvl }}" [style.animation-delay.ms]="$index * 120">{{ c.v }}</div>
          }
        </div>
      </section>

      <section class="features">
        @for (f of features; track f.title) {
          <div class="card card-pad card-hover feature fade-up">
            <div class="feature-mark">{{ f.mark }}</div>
            <h3>{{ f.title }}</h3>
            <p class="muted">{{ f.desc }}</p>
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .hero {
      display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px;
      padding: 48px; overflow: hidden; position: relative;
      background:
        radial-gradient(1200px 400px at 90% -10%, var(--exl-orange-soft), transparent 60%),
        var(--surface);
    }
    .hero-title { font-size: 42px; line-height: 1.1; margin-bottom: 18px; }
    .accent { color: var(--exl-orange-dark); }
    .hero-sub { font-size: 16px; color: var(--text-muted); max-width: 540px; line-height: 1.6; margin-bottom: 26px; }
    .hero-cta { flex-wrap: wrap; }
    .hero-links { margin-top: 18px; font-size: 14px; display: flex; align-items: center; gap: 12px; }
    .dot-sep { width: 4px; height: 4px; border-radius: 50%; background: var(--text-soft); }

    .hero-art { position: relative; display: grid; place-items: center; }
    .float-card {
      position: absolute; width: 66px; height: 90px; border-radius: 14px;
      background: var(--surface); border: 1.5px solid var(--border-strong);
      display: grid; place-items: center; font-weight: 800; font-size: 22px;
      box-shadow: var(--shadow); animation: floatY 3s ease-in-out infinite;
    }
    .float-card.level-low { color: var(--success); border-color: #bfe3cd; }
    .float-card.level-medium { color: var(--exl-orange-dark); border-color: var(--exl-orange-light); }
    .float-card.level-high { color: var(--danger); border-color: #f3c0c0; }
    .float-card:nth-child(1) { transform: translate(-90px, -40px) rotate(-12deg); }
    .float-card:nth-child(2) { transform: translate(10px, -70px) rotate(6deg); }
    .float-card:nth-child(3) { transform: translate(70px, 10px) rotate(14deg); }
    .float-card:nth-child(4) { transform: translate(-40px, 60px) rotate(-6deg); }
    .float-card:nth-child(5) { transform: translate(40px, 90px) rotate(10deg); }
    @keyframes floatY { 0%,100% { margin-top: 0; } 50% { margin-top: -14px; } }

    .features { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 28px; }
    .feature-mark {
      width: 38px; height: 38px; border-radius: 10px; margin-bottom: 12px;
      display: grid; place-items: center; font-weight: 800; font-size: 16px;
      background: var(--exl-orange-soft); color: var(--exl-orange-dark);
    }
    .feature h3 { font-size: 15px; margin-bottom: 6px; }
    .feature p { font-size: 13.5px; line-height: 1.5; }

    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; padding: 32px; }
      .hero-art { min-height: 220px; }
      .hero-title { font-size: 32px; }
      .features { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 560px) { .features { grid-template-columns: 1fr; } }
  `],
})
export class LandingComponent {
  demoCards = [
    { v: '3', lvl: 'low' },
    { v: '5', lvl: 'medium' },
    { v: '8', lvl: 'medium' },
    { v: '13', lvl: 'high' },
    { v: '?', lvl: 'low' },
  ];
  features = [
    { mark: 'RT', title: 'Real-time voting', desc: 'WebSocket-powered sessions keep every participant in sync instantly.' },
    { mark: '∑', title: 'Smart analysis', desc: 'Average, median, consensus and a suggested estimate after every reveal.' },
    { mark: '≡', title: 'Story backlog', desc: 'Add stories manually or import a full backlog from CSV.' },
    { mark: '↧', title: 'Export summaries', desc: 'Download the full session as JSON or CSV when you wrap up.' },
  ];
}
