import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WinnerService } from '../../core/services/winner.service';
import { AppComponent } from '../../app';

@Component({
  selector: 'app-winners-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="winners-layout">
      <div class="winners-header">
        <div class="winners-header-left">
          @if (app.isNavCollapsed()) {
            <button class="btn btn-secondary btn-sm" (click)="app.toggleNav()" style="display:inline-flex;align-items:center;gap:6px">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              <span>Nav</span>
            </button>
          }
          <div>
            <h1>Winners Board</h1>
            <p class="header-sub">{{ history().length }} total winners drawn</p>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" (click)="winnerSvc.exportExcel()" [disabled]="history().length === 0">
          Export to Excel
        </button>
      </div>

      @if (history().length === 0) {
        <div class="empty-state card">
          <div class="empty-icon">
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
            </svg>
          </div>
          <h4>No winners yet</h4>
          <p>Complete a raffle draw to see winners here.</p>
        </div>
      } @else {
        <!-- Grouped by Prize -->
        <div class="groups">
          @for (group of grouped(); track (group.title + '-' + $index)) {
            <div class="prize-group card" [class.major-group]="group.tier === 'Major'">
              <div class="group-header">
                <div class="group-left">
                  @if (group.image) {
                    <img [src]="group.image" class="group-img" alt="Prize" />
                  } @else {
                    <div class="group-img-placeholder"></div>
                  }
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="group-title">{{ group.title }}</h3>
                      <span class="badge" [ngClass]="group.tier === 'Major' ? 'badge-major' : 'badge-minor'">
                        {{ group.tier }}
                      </span>
                    </div>
                    <p class="group-count">{{ group.winners.length }} winner{{ group.winners.length !== 1 ? 's' : '' }}</p>
                  </div>
                </div>
              </div>

              <div class="winners-grid">
                @for (w of group.winners; track (w.id ? w.id + '-' + i : i); let i = $index) {
                  <div class="winner-chip">
                    <span class="winner-rank">{{ i + 1 }}</span>
                    <span class="winner-chip-name">{{ w.participant_name }}</span>
                    <span class="winner-chip-time">{{ formatTime(w.drawn_at) }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Full Table -->
        <div class="card history-card" style="padding:0;overflow:hidden">
          <div class="table-section-header">
            <h3>All Draw History ({{ filteredHistory().length }} of {{ history().length }})</h3>
            <div class="history-search-wrap">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input class="form-control" type="text" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
                placeholder="Search winners or prizes..." style="width:100%;padding:6px 28px 6px 30px;font-size:13px" />
              @if (searchQuery()) {
                <button (click)="searchQuery.set('')" title="Clear search"
                  style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;line-height:1;padding:2px 4px">&times;</button>
              }
            </div>
          </div>
          <div class="table-wrap history-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Winner Name</th>
                  <th>Prize</th>
                  <th>Tier</th>
                  <th>Drawn At</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredHistory(); track (row.id ? row.id + '-' + i : i); let i = $index) {
                  <tr>
                    <td style="color:var(--text-muted);width:50px">{{ i + 1 }}</td>
                    <td style="font-weight:600">{{ row.participant_name }}</td>
                    <td>{{ row.prize_title }}</td>
                    <td>
                      <span class="badge" [ngClass]="row.prize_tier === 'Major' ? 'badge-major' : 'badge-minor'">
                        {{ row.prize_tier }}
                      </span>
                    </td>
                    <td style="color:var(--text-secondary);font-size:12px">{{ formatTime(row.drawn_at) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; height: 100%; min-height: 0; }
    .winners-layout {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
      padding: 20px 28px 32px;
      gap: 20px;
    }

    .history-card {
      border: 1px solid var(--border);
    }

    .history-table-wrap {
      max-height: 520px;
      overflow-y: auto;
      overflow-x: auto;
      scrollbar-gutter: stable;

      table thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--gray-50);
        box-shadow: 0 1px 0 var(--border);
      }
    }

    .winners-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .winners-header-left { display: flex; align-items: center; gap: 14px; }

    .header-logo {
      width: 44px; height: 44px;
      object-fit: contain;
      border-radius: 50%;
      border: 1px solid var(--border-green);
    }

    h1 { font-size: 20px; color: var(--green-900); }
    .header-sub { font-size: 13px; color: var(--text-muted); margin-top: 2px; }

    .groups { display: flex; flex-direction: column; gap: 14px; }

    .prize-group { padding: 18px; }
    .prize-group.major-group { border-color: #f0cc70; background: #fffdf5; }

    .group-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .group-left { display: flex; align-items: center; gap: 12px; }

    .group-img {
      width: 48px; height: 48px;
      object-fit: cover;
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    .group-img-placeholder {
      width: 48px; height: 48px;
      background: var(--gray-100);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .group-title { font-size: 16px; font-family: 'Outfit', sans-serif; color: var(--green-900); }
    .group-count { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

    .winners-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 7px;
    }

    .winner-chip {
      display: flex;
      align-items: center;
      gap: 9px;
      background: var(--gray-50);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 9px 12px;
    }

    .winner-rank {
      width: 22px; height: 22px;
      background: var(--green);
      color: white;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px;
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      flex-shrink: 0;
    }

    .winner-chip-name {
      flex: 1;
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .winner-chip-time {
      font-size: 11px;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .table-section-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--gray-50);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      h3 { font-size: 14px; color: var(--green-900); }
    }
    .history-search-wrap {
      position: relative;
      display: flex;
      align-items: center;
      min-width: 240px;
    }
    .search-icon {
      position: absolute;
      left: 10px;
      color: var(--text-muted);
      pointer-events: none;
    }
  `]
})
export class WinnersBoardComponent implements OnInit {
  readonly searchQuery = signal('');
  readonly history = computed(() => this.winnerSvc.history());
  readonly grouped = computed(() => this.winnerSvc.winnersGroupedByPrize());
  readonly filteredHistory = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const rows = this.history();
    if (!q) return rows;
    return rows.filter(r =>
      (r.participant_name && r.participant_name.toLowerCase().includes(q)) ||
      (r.prize_title && r.prize_title.toLowerCase().includes(q)) ||
      (r.prize_tier && r.prize_tier.toLowerCase().includes(q))
    );
  });

  constructor(
    public winnerSvc: WinnerService,
    public app: AppComponent
  ) { }
  ngOnInit(): void { this.winnerSvc.refresh(); }

  formatTime(dt: string): string {
    try {
      return new Date(dt).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return dt; }
  }
}
