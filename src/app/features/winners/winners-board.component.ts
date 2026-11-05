import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WinnerService } from '../../core/services/winner.service';
import { RaffleService } from '../../core/services/raffle.service';
import { SqliteService } from '../../core/db/sqlite.service';
import { DrawHistoryWithDetails } from '../../core/models/models';
import { AppComponent } from '../../app';

@Component({
  selector: 'app-winners-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="winners-layout">
      <!-- Header -->
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
            <h1>Winners Board &amp; Draw History</h1>
            <p class="header-sub">
              <strong>{{ totalValidCount() }}</strong> valid winner{{ totalValidCount() === 1 ? '' : 's' }}
              @if (totalVoidCount() > 0) {
                <span> &middot; <strong style="color:var(--red)">{{ totalVoidCount() }}</strong> void (invalid)</span>
              }
              <span> &middot; <strong>{{ history().length }}</strong> total draw logs</span>
            </p>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" (click)="winnerSvc.exportExcel()" [disabled]="history().length === 0">
          Export to Excel
        </button>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="card board-filter-card">
        <div class="filter-row">
          <!-- Search box -->
          <div class="search-field-wrap">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="search-field-icon">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              class="form-control search-input"
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Search winners, grades, prizes, notes..."
            />
            @if (searchQuery()) {
              <button class="clear-search-btn" (click)="searchQuery.set('')" title="Clear search">&times;</button>
            }
          </div>

          <!-- Tier Filter -->
          <div class="filter-select-wrap">
            <label class="filter-label">Tier:</label>
            <select class="form-control filter-select" [ngModel]="selectedTier()" (ngModelChange)="selectedTier.set($event)">
              <option value="All">All Tiers</option>
              <option value="Grand">Grand Prize</option>
              <option value="Major">Major Prize</option>
              <option value="Minor">Minor Prize</option>
            </select>
          </div>

          <!-- Prize Filter -->
          <div class="filter-select-wrap">
            <label class="filter-label">Prize:</label>
            <select class="form-control filter-select" [ngModel]="selectedPrize()" (ngModelChange)="selectedPrize.set($event)">
              <option value="All">All Prizes</option>
              @for (p of prizeOptions(); track p) {
                <option [value]="p">{{ p }}</option>
              }
            </select>
          </div>

          <!-- Status Filter -->
          <div class="filter-select-wrap">
            <label class="filter-label">Status:</label>
            <select class="form-control filter-select" [ngModel]="selectedStatus()" (ngModelChange)="selectedStatus.set($event)">
              <option value="All">All Statuses</option>
              <option value="claimed">Claimed</option>
              <option value="allocated_teachers">Assigned to Teachers</option>
              <option value="voided">Void (Invalid)</option>
            </select>
          </div>

          <!-- Reset Filter -->
          @if (searchQuery() || selectedTier() !== 'All' || selectedPrize() !== 'All' || selectedStatus() !== 'All') {
            <button class="btn btn-ghost btn-sm reset-filter-btn" (click)="resetFilters()">
              Reset Filters
            </button>
          }
        </div>
      </div>

      <!-- Main Draw History Table View -->
      @if (history().length === 0) {
        <div class="empty-state card">
          <div class="empty-icon">
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
            </svg>
          </div>
          <h4>No winners yet</h4>
          <p>Complete a raffle draw to see records here.</p>
        </div>
      } @else if (filteredHistory().length === 0) {
        <div class="empty-state card">
          <h4>No matching draw records</h4>
          <p>Try adjusting your search query or filter options above.</p>
          <button class="btn btn-secondary btn-sm" (click)="resetFilters()" style="margin-top:10px">Clear Filters</button>
        </div>
      } @else {
        <div class="card history-card">
          <div class="history-card-header">
            <h3>Draw History Records ({{ filteredHistory().length }} of {{ history().length }})</h3>
          </div>
          <div class="table-wrap history-table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width:50px">#</th>
                  <th>Winner Name</th>
                  <th>Grade &amp; Section</th>
                  <th>Prize Title</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Audit Notes</th>
                  <th>Drawn At</th>
                  <th style="text-align:right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredHistory(); track (row.id ? row.id + '-' + i : i); let i = $index) {
                  <tr [class.row-voided]="row.status === 'voided'" [class.row-teachers]="row.status === 'allocated_teachers'">
                    <td style="color:var(--text-muted);font-weight:500">{{ i + 1 }}</td>
                    <td>
                      <div class="winner-name-cell">
                        <span class="cell-name">{{ row.participant_name }}</span>
                      </div>
                    </td>
                    <td style="color:var(--text-secondary);font-size:12.5px">{{ row.grade_section || '—' }}</td>
                    <td>
                      <div class="prize-title-cell">
                        @if (row.prize_image_data) {
                          <img [src]="row.prize_image_data" class="table-prize-thumb" alt="Prize" />
                        }
                        <span>{{ row.prize_title }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="badge" [ngClass]="row.prize_tier === 'Grand' ? 'badge-grand' : (row.prize_tier === 'Major' ? 'badge-major' : 'badge-minor')">
                        {{ row.prize_tier === 'Grand' ? '★ Grand' : row.prize_tier }}
                      </span>
                    </td>
                    <td>
                      @if (row.status === 'voided') {
                        <span class="badge badge-void">Void (Invalid)</span>
                      } @else if (row.status === 'allocated_teachers') {
                        <span class="badge badge-teachers">Assigned to Teachers</span>
                      } @else {
                        <span class="badge badge-active">Claimed</span>
                      }
                    </td>
                    <td style="font-size:12px;color:var(--text-secondary)">
                      {{ row.notes || '—' }}
                    </td>
                    <td style="color:var(--text-secondary);font-size:12px;white-space:nowrap">{{ formatTime(row.drawn_at) }}</td>
                    <td style="text-align:right">
                      @if (row.status === 'voided') {
                        <span class="action-muted">Voided</span>
                      } @else if (row.status === 'allocated_teachers') {
                        <span class="action-muted">Assigned</span>
                      } @else {
                        <button class="btn btn-secondary btn-sm" (click)="voidAndRedraw(row)" title="Mark invalid or resolve prize item">
                          Resolve / Void
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Custom Invalid Resolution Dialog (Option A: Assign to Teachers vs Option B: Redraw) -->
      @if (confirmVoidModal(); as row) {
        <div class="modal-backdrop" (click)="$event.stopPropagation()">
          <div class="invalid-modal card" (click)="$event.stopPropagation()">
            <div class="invalid-modal-header">
              <div class="invalid-warning-icon">
                <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3>Invalid Winner Resolution</h3>
                <p class="invalid-winner-name">{{ row.participant_name }} @if (row.grade_section) { <span>&middot; {{ row.grade_section }}</span> }</p>
              </div>
            </div>

            <div class="invalid-modal-body">
              <div class="invalid-rule-notice">
                <span class="rule-tag">Status Update</span>
                <span><strong>{{ row.participant_name }}</strong> will be marked as <strong>Void</strong> and excluded from all future draws.</span>
              </div>

              <p class="invalid-choose-title">Choose Prize Allocation:</p>

              <div class="invalid-options-grid">
                <!-- Option A (Default per PTO Policy) -->
                <label class="invalid-option-card" [class.selected]="selectedInvalidOption() === 'teachers'" (click)="selectedInvalidOption.set('teachers')">
                  <div class="option-radio">
                    <input type="radio" name="boardInvalidOption" value="teachers" [checked]="selectedInvalidOption() === 'teachers'" />
                  </div>
                  <div class="option-info">
                    <div class="option-header-row">
                      <span class="option-title">Assign Item to Teachers &amp; Faculty</span>
                      <span class="pto-badge">Default (PTO Rule)</span>
                    </div>
                    <p class="option-desc">The prize item remains awarded and is allocated directly to school teachers. Do <strong>not</strong> return it to the active pool or redraw.</p>
                  </div>
                </label>

                <!-- Option B (Redraw) -->
                <label class="invalid-option-card" [class.selected]="selectedInvalidOption() === 'redraw'" (click)="selectedInvalidOption.set('redraw')">
                  <div class="option-radio">
                    <input type="radio" name="boardInvalidOption" value="redraw" [checked]="selectedInvalidOption() === 'redraw'" />
                  </div>
                  <div class="option-info">
                    <div class="option-header-row">
                      <span class="option-title">Redraw Replacement Winner</span>
                    </div>
                    <p class="option-desc">Mark this draw record as voided and restore 1 item back to {{ row.prize_title }} so a replacement winner can be drawn.</p>
                  </div>
                </label>
              </div>
            </div>

            <div class="invalid-modal-footer">
              <button class="btn btn-secondary" (click)="cancelConfirmVoid()">Cancel</button>
              <button class="btn btn-primary" (click)="executeConfirmVoid()">
                {{ selectedInvalidOption() === 'teachers' ? 'Confirm: Assign to Teachers' : 'Confirm: Redraw Prize' }}
              </button>
            </div>
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
      gap: 16px;
    }

    .winners-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .winners-header-left { display: flex; align-items: center; gap: 14px; }

    h1 { font-size: 22px; color: var(--green-900); font-family: 'Outfit', sans-serif; }
    .header-sub { font-size: 13px; color: var(--text-muted); margin-top: 2px; }

    /* Filter Card */
    .board-filter-card {
      padding: 12px 18px;
      border: 1px solid var(--border);
      flex-shrink: 0;
    }

    .filter-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
    }

    .search-field-wrap {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 240px;
    }

    .search-field-icon {
      position: absolute;
      left: 10px;
      color: var(--text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 7px 30px 7px 32px;
      font-size: 13px;
    }

    .clear-search-btn {
      position: absolute;
      right: 8px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
      font-size: 16px;
      line-height: 1;
      padding: 2px 4px;
      &:hover { color: var(--text-primary); }
    }

    .filter-select-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .filter-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .filter-select {
      padding: 6px 12px;
      font-size: 13px;
      min-width: 130px;
      cursor: pointer;
    }

    .reset-filter-btn {
      color: var(--red);
      font-size: 12.5px;
      &:hover { background: #ffebee; }
    }

    /* History Table Card */
    .history-card {
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 380px;
      overflow: hidden;
      padding: 0;
    }

    .history-card-header {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      background: #fafbfa;

      h3 {
        font-size: 15px;
        font-weight: 700;
        color: var(--green-900);
        margin: 0;
      }
    }

    .history-table-wrap {
      flex: 1;
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

    .winner-name-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      .cell-name {
        font-weight: 600;
        color: var(--green-900);
      }
    }

    .prize-title-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .table-prize-thumb {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      object-fit: cover;
      border: 1px solid var(--border);
      flex-shrink: 0;
    }

    .row-voided {
      background: #fffafa;
      opacity: 0.75;
      .cell-name {
        text-decoration: line-through;
        color: var(--text-muted);
      }
    }

    .row-teachers {
      background: #f7fcf7;
    }

    .badge-grand {
      background: linear-gradient(135deg, #ffd700, #ffb300);
      color: #2b1f00;
      font-weight: 700;
      border: 1px solid #e6a800;
    }

    .badge-teachers {
      background: #e8f5e9;
      color: #1b5e20;
      font-weight: 600;
      border: 1px solid #c8e6c9;
    }

    .badge-void {
      background: #ffebee;
      color: #c62828;
      font-weight: 600;
      border: 1px solid #ef9a9a;
    }

    .action-muted {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      padding: 4px 8px;
    }

    /* Invalid Resolution Modal in Winners Board */
    .invalid-modal {
      width: 100%;
      max-width: 520px;
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.22);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .invalid-modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 22px;
      border-bottom: 1px solid var(--border);
      background: #fffafa;

      h3 {
        font-size: 18px;
        margin: 0;
        color: #b71c1c;
      }
    }

    .invalid-warning-icon {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #ffebee;
      color: #c62828;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .invalid-winner-name {
      font-size: 13.5px;
      color: var(--text-secondary);
      margin: 2px 0 0;
      font-weight: 500;
    }

    .invalid-modal-body {
      padding: 20px 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .invalid-rule-notice {
      background: #fff8e1;
      border: 1px solid #ffe082;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12.5px;
      color: #5d4037;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      line-height: 1.4;
    }

    .rule-tag {
      background: #ffecb3;
      color: #6d4c41;
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }

    .invalid-choose-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--green-900);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .invalid-options-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .invalid-option-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      background: #ffffff;
      transition: all 0.15s ease;

      &:hover { border-color: #a5d6a7; background: #f9fbf9; }
      &.selected {
        border-color: #2d8a3a;
        background: #f0f7f1;
        box-shadow: 0 0 0 1px #2d8a3a;
      }
    }

    .option-radio {
      padding-top: 2px;
      input { cursor: pointer; }
    }

    .option-info { flex: 1; min-width: 0; }
    .option-header-row { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
    .option-title { font-size: 14px; font-weight: 700; color: #1a4d22; font-family: 'Outfit', sans-serif; }
    .pto-badge {
      font-size: 10px; font-weight: 700;
      color: #1b5e20; background: #c8e6c9;
      padding: 2px 6px; border-radius: 4px;
    }
    .option-desc { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.35; }

    .invalid-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 22px;
      background: var(--gray-50);
      border-top: 1px solid var(--border);
    }
  `]
})
export class WinnersBoardComponent implements OnInit {
  readonly searchQuery = signal('');
  readonly selectedTier = signal<'All' | 'Grand' | 'Major' | 'Minor'>('All');
  readonly selectedPrize = signal<string>('All');
  readonly selectedStatus = signal<'All' | 'claimed' | 'allocated_teachers' | 'voided'>('All');

  readonly confirmVoidModal = signal<DrawHistoryWithDetails | null>(null);
  readonly selectedInvalidOption = signal<'teachers' | 'redraw'>('teachers');

  readonly history = computed(() => this.winnerSvc.history());

  readonly prizeOptions = computed(() => {
    const prizes = new Set<string>();
    this.history().forEach(r => {
      if (r.prize_title) prizes.add(r.prize_title);
    });
    return Array.from(prizes).sort();
  });

  readonly totalValidCount = computed(() =>
    this.history().filter(h => h.status !== 'voided').length
  );

  readonly totalVoidCount = computed(() =>
    this.history().filter(h => h.status === 'voided').length
  );

  readonly filteredHistory = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const tier = this.selectedTier();
    const prize = this.selectedPrize();
    const status = this.selectedStatus();

    return this.history().filter(r => {
      if (tier !== 'All' && r.prize_tier !== tier) return false;
      if (prize !== 'All' && r.prize_title !== prize) return false;
      if (status !== 'All') {
        const rowStatus = r.status || 'claimed';
        if (rowStatus !== status) return false;
      }
      if (q) {
        const matchName = r.participant_name?.toLowerCase().includes(q);
        const matchGrade = r.grade_section?.toLowerCase().includes(q);
        const matchPrize = r.prize_title?.toLowerCase().includes(q);
        const matchNotes = r.notes?.toLowerCase().includes(q);
        if (!matchName && !matchGrade && !matchPrize && !matchNotes) return false;
      }
      return true;
    });
  });

  constructor(
    public winnerSvc: WinnerService,
    private raffleSvc: RaffleService,
    private sqlite: SqliteService,
    private router: Router,
    public app: AppComponent
  ) { }

  ngOnInit(): void {
    this.winnerSvc.refresh();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedTier.set('All');
    this.selectedPrize.set('All');
    this.selectedStatus.set('All');
  }

  voidAndRedraw(row: DrawHistoryWithDetails): void {
    this.selectedInvalidOption.set('teachers');
    this.confirmVoidModal.set(row);
  }

  cancelConfirmVoid(): void {
    this.confirmVoidModal.set(null);
  }

  executeConfirmVoid(): void {
    const row = this.confirmVoidModal();
    if (!row) return;

    // Disqualify and mark as void
    this.sqlite.markParticipantVoid(row.participant_id);

    if (this.selectedInvalidOption() === 'teachers') {
      this.raffleSvc.allocatePrizeToTeachers(row.prize_id, row.participant_id, row.id);
    } else {
      this.raffleSvc.voidWinnerAndRestorePrize(row.prize_id, row.participant_id, row.id);
    }

    this.winnerSvc.refresh();
    this.raffleSvc.refresh();
    this.confirmVoidModal.set(null);
  }

  formatTime(dt: string): string {
    try {
      return new Date(dt).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return dt; }
  }
}
