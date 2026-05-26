import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet, Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { ThemeService } from './core/services/theme.service';
import { ToastComponent } from './components/toast/toast.component';

/**
 * Application shell: a professional EXL navbar + routed content + global toasts.
 * The navbar is hidden inside the live room so the room gets its own top bar.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ToastComponent],
  template: `
    @if (showNav()) {
      <header class="navbar">
        <div class="container nav-inner">
          <a class="brand" routerLink="/">
            <span class="brand-mark">EXL</span>
            <span class="brand-divider"></span>
            <span class="brand-text">Sprint Estimate</span>
          </a>

          <nav class="nav-links">
            <a routerLink="/about" routerLinkActive="active">What is Sprint Estimate?</a>
            <a routerLink="/guide" routerLinkActive="active">Guide</a>
            <a routerLink="/examples" routerLinkActive="active">Examples</a>
          </nav>

          <div class="nav-actions">
            <a class="btn btn-ghost btn-sm" routerLink="/join">Join Session</a>
            <a class="btn btn-primary btn-sm" routerLink="/create">New Session</a>
            <button
              class="btn btn-icon btn-ghost"
              (click)="theme.toggle()"
              [title]="theme.theme() === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
              aria-label="Toggle theme"
            >
              {{ theme.theme() === 'light' ? '☾' : '☀' }}
            </button>
          </div>
        </div>
      </header>
    }

    <main [class.with-nav]="showNav()">
      <router-outlet />
    </main>

    <app-toast />
  `,
  styles: [`
    .navbar {
      position: sticky; top: 0; z-index: 50;
      background: var(--surface); border-bottom: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
    }
    .nav-inner { display: flex; align-items: center; gap: 24px; height: 62px; }
    .brand { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .brand-mark {
      font-weight: 800; font-size: 17px; letter-spacing: 0.06em; color: #fff;
      background: linear-gradient(135deg, var(--exl-orange), var(--exl-orange-dark));
      padding: 6px 11px; border-radius: 9px; box-shadow: var(--shadow-sm);
    }
    .brand-divider { width: 1px; height: 22px; background: var(--border-strong); }
    .brand-text { font-weight: 700; font-size: 16px; color: var(--text); white-space: nowrap; }

    .nav-links { display: flex; align-items: center; gap: 4px; flex: 1; }
    .nav-links a {
      font-size: 14px; font-weight: 500; color: var(--text-muted);
      padding: 8px 12px; border-radius: 8px; transition: all 0.15s ease;
    }
    .nav-links a:hover { color: var(--text); background: var(--surface-2); }
    .nav-links a.active { color: var(--exl-orange-dark); background: var(--exl-orange-soft); }

    .nav-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .btn-icon { font-size: 16px; }

    main.with-nav { min-height: calc(100vh - 62px); padding: 28px 0; }
    main:not(.with-nav) { min-height: 100vh; }

    @media (max-width: 860px) {
      .nav-links { display: none; }
      .brand-text { display: none; }
    }
  `],
})
export class AppComponent implements OnInit {
  theme = inject(ThemeService);
  private router = inject(Router);

  // Hide the global navbar in the live room (it has its own top bar).
  readonly showNav = signal(true);

  ngOnInit(): void {
    this.theme.init();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.showNav.set(!e.urlAfterRedirects.startsWith('/room/'));
      });
  }
}
