import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-wrap">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast toast-{{ t.type }}" (click)="toast.dismiss(t.id)">
          <span class="toast-icon">
            {{ t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i' }}
          </span>
          <span class="toast-msg">{{ t.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-wrap {
      position: fixed; bottom: 24px; right: 24px; z-index: 1000;
      display: flex; flex-direction: column; gap: 10px; max-width: 360px;
    }
    .toast {
      display: flex; align-items: center; gap: 12px; cursor: pointer;
      background: var(--surface); border: 1px solid var(--border);
      border-left: 4px solid var(--text-soft);
      border-radius: 12px; padding: 14px 18px; box-shadow: var(--shadow-lg);
      animation: fadeUp 0.3s ease both; font-size: 14px; font-weight: 500;
    }
    .toast-icon {
      width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
      display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 13px;
    }
    .toast-success { border-left-color: var(--success); }
    .toast-success .toast-icon { background: var(--success); }
    .toast-error { border-left-color: var(--danger); }
    .toast-error .toast-icon { background: var(--danger); }
    .toast-info { border-left-color: var(--info); }
    .toast-info .toast-icon { background: var(--info); }
    @media (max-width: 600px) { .toast-wrap { left: 16px; right: 16px; max-width: none; } }
  `],
})
export class ToastComponent {
  toast = inject(ToastService);
}
