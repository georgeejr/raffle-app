import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParticipantsPanelComponent } from './participants-panel/participants-panel.component';
import { PrizesPanelComponent } from './prizes-panel/prizes-panel.component';
import { SqliteService } from '../../core/db/sqlite.service';
import { ParticipantService } from '../../core/services/participant.service';
import { RaffleService } from '../../core/services/raffle.service';
import { WinnerService } from '../../core/services/winner.service';
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
            <div style="display:flex;align-items:center;gap:8px;margin-top:3px">
              @if (sqlite.isServerConnected()) {
                <span class="db-status-pill connected" title="Database is safely persisted to stpaul_raffle.db on your local disk">
                  <span class="pulse-dot"></span>
                  <span>Standalone SQLite: <strong>stpaul_raffle.db</strong> (Saved on Disk)</span>
                </span>
              } @else {
                <span class="db-status-pill local" title="Database is persisted in browser IndexedDB">
                  <span class="pulse-dot local"></span>
                  <span>Database: <strong>IndexedDB (Offline)</strong></span>
                </span>
              }
            </div>
          </div>
        </div>

        <div class="db-actions">
          <button class="btn btn-secondary btn-sm" (click)="sqlite.downloadBackup()" title="Download a backup copy of your database file">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Backup Database (.db)</span>
          </button>
          <input #restoreInput type="file" accept=".db,.sqlite" style="display:none" (change)="onRestoreFile($event)">
          <button class="btn btn-secondary btn-sm" (click)="restoreInput.click()" title="Restore database from a previously backed-up .db file">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Restore DB</span>
          </button>
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

    .db-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .db-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--gray-100);
      color: var(--text-secondary);
      border: 1px solid var(--border);

      &.connected {
        background: #eaf6ec;
        color: #1a5c22;
        border-color: #b5e2bd;
      }
      &.local {
        background: #fdf6e7;
        color: #855307;
        border-color: #f2db9e;
      }
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #2d8a3a;
      flex-shrink: 0;

      &.local {
        background: #c9952a;
      }
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
    public app: AppComponent,
    public sqlite: SqliteService,
    private participantSvc: ParticipantService,
    private raffleSvc: RaffleService,
    private winnerSvc: WinnerService
  ) {}

  async onRestoreFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (confirm(`Restore database from "${file.name}"? This will overwrite the current database.`)) {
      try {
        await this.sqlite.restoreFromBackup(file);
        this.participantSvc.refresh();
        this.raffleSvc.refresh();
        this.winnerSvc.refresh();
        alert('Database successfully restored!');
      } catch (err: any) {
        alert('Failed to restore database: ' + (err?.message || err));
      }
    }
    input.value = '';
  }
}

