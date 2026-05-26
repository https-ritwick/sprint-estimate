import { Injectable, signal } from '@angular/core';

const KEY = 'exl-pp-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<'light' | 'dark'>('light');

  init(): void {
    const saved = (localStorage.getItem(KEY) as 'light' | 'dark' | null) ?? 'light';
    this.apply(saved);
  }

  toggle(): void {
    this.apply(this.theme() === 'light' ? 'dark' : 'light');
  }

  private apply(theme: 'light' | 'dark'): void {
    this.theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }
}
