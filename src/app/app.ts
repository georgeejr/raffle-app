import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { SqliteService } from './core/db/sqlite.service';
import { ParticipantService } from './core/services/participant.service';
import { RaffleService } from './core/services/raffle.service';
import { WinnerService } from './core/services/winner.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  template: `
    @if (!dbReady()) {
      <div class="loading-screen">
        <div class="loading-content">
          <img src="logo.png" alt="St. Paul School Logo" class="loading-logo" />
          <h2 class="loading-title">St. Paul School of Santa Maria</h2>
          <p class="loading-sub">Raffle System — Loading...</p>
          <div class="loading-bar">
            <div class="loading-fill"></div>
          </div>
        </div>
      </div>
    } @else {
      <div class="app-shell">
        <!-- Sidebar -->
        <nav class="sidebar" [class.collapsed]="isNavCollapsed()">
          <div class="sidebar-brand">
            <div class="brand-top-row">
              <img src="logo.png" alt="St. Paul Logo" class="brand-logo" />
              <button class="nav-toggle-icon" (click)="toggleNav()" title="Hide Navigation">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            </div>
            <div class="brand-text">
              <span class="brand-name">St. Paul School of Santa Maria</span>
              <!-- <span class="brand-sub">Sta. Maria, Bulacan</span> -->
            </div>
          </div>

          <!-- <div class="sidebar-divider"></div> -->

          <div class="sidebar-nav">
            <a class="nav-link" routerLink="/raffle" routerLinkActive="active">
              Spin &amp; Draw
            </a>
            <a class="nav-link" routerLink="/admin" routerLinkActive="active">
              Participants &amp; Prizes
            </a>
            <a class="nav-link" routerLink="/winners" routerLinkActive="active">
              Winners Board
            </a>
          </div>

          <div class="sidebar-footer">
            <div class="db-status">
              <span class="db-dot"></span>
              <span>Database Active</span>
            </div>
            <div class="school-motto">Caritas Christi Urget Nos</div>
          </div>
        </nav>

        <!-- Main Content -->
        <main class="main-content">
          <router-outlet />
        </main>
      </div>
    }
  `,
  styles: [`
    /* Loading Screen */
    .loading-screen {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f1f8f2;
    }

    .loading-content {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .loading-logo {
      width: 100px;
      height: 100px;
      object-fit: contain;
    }

    .loading-title {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: #1a4d22;
      max-width: 300px;
      line-height: 1.3;
    }

    .loading-sub {
      font-size: 13px;
      color: #6b736b;
    }

    .loading-bar {
      width: 200px;
      height: 4px;
      background: #dde0dd;
      border-radius: 100px;
      overflow: hidden;
    }

    .loading-fill {
      height: 100%;
      width: 40%;
      background: #2d8a3a;
      border-radius: 100px;
      animation: shimmer 1.2s linear infinite;
      background: linear-gradient(90deg, #2d8a3a 0%, #4caf5a 50%, #2d8a3a 100%);
      background-size: 200% 100%;
    }

    /* App Shell */
    .app-shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
      position: relative;
    }

    /* Sidebar */
    .sidebar {
      width: 230px;
      flex-shrink: 0;
      background: #217827;
      display: flex;
      flex-direction: column;
      padding: 0;
      border-right: .5px solid #e1e1e1;
      transition: width 0.25s ease, opacity 0.2s ease, visibility 0.25s ease;
      overflow: hidden;
      white-space: nowrap;
      z-index: 100;

      &.collapsed {
        width: 0 !important;
        min-width: 0 !important;
        padding: 0 !important;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        border-right: none;
      }
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 18px 20px;
      background: #ffffffff;
      flex-direction: column;
      position: relative;
    }

    .brand-top-row {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      position: relative;
    }

    .nav-toggle-icon {
      position: absolute;
      right: 0;
      top: 0;
      background: transparent;
      border: none;
      color: #6b736b;
      cursor: pointer;
      padding: 6px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: #f1f8f2;
        color: #1a4d22;
      }
    }

    .brand-logo {
      width: 100px;
      height: 100px;
      object-fit: contain;
      flex-shrink: 0;
      border-radius: 50%;
      background: white;
      padding: 2px;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: center;
    }

    .brand-name {
      font-family: 'Outfit', sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: #000000ff;
      line-height: 1.2;
    }

    .brand-sub {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.65);
      font-weight: 400;
    }

    .sidebar-divider {
      height: 1px;
      background: rgba(255,255,255,0.1);
      margin: 8px 0;
    }

    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      flex: 1;

      .nav-link {
        color: rgba(255,255,255,0.75);
        font-size: 14px;
        padding: 10px 14px;
        border-radius: 5px;
        border: none;

        &:hover {
          background: rgba(255,255,255,0.1);
          color: #ffffff;
        }

        &.active {
          background: rgba(255,255,255,0.15);
          color: #ffffff;
          border: 1px solid rgba(255,255,255,0.2);
        }
      }
    }

    .sidebar-footer {
      padding: 16px 18px;
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .db-status {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      color: rgba(255,255,255,0.5);
    }

    .db-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4caf5a;
    }

    .school-motto {
      font-size: 10px;
      color: rgba(255,255,255,0.35);
      font-style: italic;
      font-family: 'Inter', sans-serif;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #f7f8f7;
      height: 100%;
      min-height: 0;
      min-width: 0;
      position: relative;
    }

    router-outlet {
      display: none;
    }

    /* Floating Nav Toggle Button when sidebar is collapsed */
    .floating-nav-btn {
      position: absolute;
      top: 14px;
      left: 14px;
      z-index: 400;
      display: flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      color: #1a4d22;
      border: 1px solid #a5d6a7;
      border-radius: 6px;
      padding: 6px 12px;
      font-family: 'Outfit', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: background 0.15s, border-color 0.15s;

      &:hover {
        background: #e8f5e9;
        border-color: #2d8a3a;
      }
    }
  `]
})
export class AppComponent implements OnInit {
  readonly dbReady = signal(false);
  readonly isNavCollapsed = signal(false);

  constructor(
    private db: SqliteService,
    private participantSvc: ParticipantService,
    private raffleSvc: RaffleService,
    private winnerSvc: WinnerService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.db.initialize();
    this.participantSvc.refresh();
    this.raffleSvc.refresh();
    this.winnerSvc.refresh();
    this.dbReady.set(true);
  }

  toggleNav(): void {
    this.isNavCollapsed.update(v => !v);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 260);
  }
}
