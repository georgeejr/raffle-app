import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirm-backdrop" (click)="onCancel()">
      <div class="confirm-card card" (click)="$event.stopPropagation()">
        <!-- <div class="confirm-icon-wrap" [class.danger]="type === 'danger'">
          @if (type === 'danger') {
            <svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          } @else {
            <svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 14 14"/>
            </svg>
          }
        </div> -->

        <h3 class="confirm-title">{{ title }}</h3>

        @if (message) {
          <p class="confirm-message">{{ message }}</p>
        }

        @if (detail) {
          <div class="confirm-detail-box">
            {{ detail }}
          </div>
        }

        <div class="confirm-actions">
          @if (cancelLabel) {
            <button class="btn btn-secondary" (click)="onCancel()">
              {{ cancelLabel }}
            </button>
          }
          <button class="btn" [ngClass]="type === 'danger' ? 'btn-danger-solid' : 'btn-primary'" (click)="onConfirm()">
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 1200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.15s ease-out;
    }

    .confirm-card {
      background: #ffffff;
      border-radius: 14px;
      max-width: 440px;
      width: 100%;
      padding: 24px 24px 20px;
      text-align: center;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(0, 0, 0, 0.08);
      animation: scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .confirm-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 14px;
      background: #f1f8f2;
      color: #1a4d22;

      &.danger {
        background: #fee2e2;
        color: #dc2626;
      }
    }

    .confirm-title {
      font-size: 19px;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      color: #1a1d1a;
      margin-bottom: 8px;
    }

    .confirm-message {
      font-size: 14px;
      color: #4a544a;
      line-height: 1.45;
      margin-bottom: 12px;
    }

    .confirm-detail-box {
      font-size: 13px;
      line-height: 1.45;
      background: #f7f8f7;
      border: 1px solid #dde0dd;
      border-radius: 8px;
      padding: 10px 14px;
      color: #3d433d;
      text-align: left;
      margin-bottom: 18px;
    }

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 6px;

      button {
        min-width: 100px;
        font-weight: 600;
        padding: 9px 18px;
        font-size: 13.5px;
      }
    }

    .btn-danger-solid {
      background: #dc2626;
      color: #ffffff;
      border: 1px solid #b91c1c;

      &:hover:not(:disabled) {
        background: #b91c1c;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleUp {
      from { transform: scale(0.92); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `]
})
export class ConfirmDialogComponent {
  @Input() title = 'Are you sure?';
  @Input() message = '';
  @Input() detail = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() type: 'danger' | 'info' = 'danger';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm(): void { this.confirm.emit(); }
  onCancel(): void { this.cancel.emit(); }
}

