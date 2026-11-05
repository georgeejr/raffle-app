import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParticipantsPanelComponent } from './participants-panel/participants-panel.component';
import { PrizesPanelComponent } from './prizes-panel/prizes-panel.component';
import { AppComponent } from '../../app';

type AdminTab = 'participants' | 'prizes';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ParticipantsPanelComponent, PrizesPanelComponent],
  template: `
    <div class="admin-layout">
      <div class="admin-header">
        <div class="admin-header-brand">
          @if (app.isNavCollapsed()) {
            <button class="btn btn-secondary btn-sm" (click)="app.toggleNav()" style="display:inline-flex;align-items:center;gap:6px">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              <span>Nav</span>
            </button>
          }
          <div>
            <h1>Participants &amp; Prizes</h1>
          </div>
        </div>
      </div>

      <div class="admin-tabs-row">
        <div class="tabs">
          <button class="tab" [class.active]="activeTab() === 'participants'"
            (click)="activeTab.set('participants')">
            Participants
          </button>
          <button class="tab" [class.active]="activeTab() === 'prizes'"
            (click)="activeTab.set('prizes')">
            Prizes
          </button>
        </div>
      </div>

      <div class="admin-content">
        @if (activeTab() === 'participants') {
          <app-participants-panel />
        }
        @if (activeTab() === 'prizes') {
          <app-prizes-panel />
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; height: 100%; min-height: 0; }
    .admin-layout { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

    .admin-header {
      padding: 14px 28px;
      background: var(--bg-white);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-shrink: 0;
    }

    .admin-header-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    h1 { font-size: 18px; color: var(--green-900); }

    .admin-tabs-row {
      padding: 0 28px;
      background: var(--bg-white);
      border-bottom: 2px solid var(--border);
      flex-shrink: 0;
    }

    .admin-tabs-row .tabs { border-bottom: none; }

    .admin-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px 28px 32px;
    }
  `]
})
export class AdminComponent {
  activeTab = signal<AdminTab>('participants');

  constructor(
    public app: AppComponent
  ) { }
}

