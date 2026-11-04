import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParticipantService } from '../../../core/services/participant.service';

@Component({
  selector: 'app-participants-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel">
      <div class="panel-header">
        <div>
          <h2>Participants</h2>
          <p class="sub-text">{{ totalCount() }} total &middot; {{ eligibleCount() }} eligible</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" (click)="exportExcel()" [disabled]="totalCount() === 0">
            Export to Excel
          </button>
          <button class="btn btn-secondary btn-sm" (click)="resetEligibility()">Reset Participants</button>
          <!-- <button class="btn btn-danger btn-sm" (click)="confirmClearAll()" [disabled]="totalCount() === 0">
            Clear All
          </button> -->
        </div>
      </div>

      <!-- Input Tabs -->
      <div class="card">
        <div class="tabs" style="margin-bottom:20px">
          <button class="tab" [class.active]="inputTab() === 'bulk'" (click)="inputTab.set('bulk')">Bulk Paste</button>
          <!-- <button class="tab" [class.active]="inputTab() === 'single'" (click)="inputTab.set('single')">Add One</button> -->
          <button class="tab" [class.active]="inputTab() === 'import'" (click)="inputTab.set('import')">Import CSV</button>
        </div>

        @if (inputTab() === 'bulk') {
          <div class="flex-col gap-3">
            <div class="form-group">
              <label>Names (one per line or comma-separated)</label>
              <textarea class="form-control" rows="6"
                [(ngModel)]="bulkText"
                placeholder="Juan dela Cruz&#10;Maria Santos&#10;Jose Reyes, juan@example.com">
              </textarea>
            </div>
            <div style="display:flex; gap:10px; align-items:center; margin-top: 20px">
              <button class="btn btn-primary" (click)="addBulk()" [disabled]="!bulkText.trim()">
                Add Names
              </button>
              @if (lastAddedCount() > 0) {
                <span class="success-msg">Added {{ lastAddedCount() }} participants.</span>
              }
            </div>
          </div>
        }

        @if (inputTab() === 'single') {
          <div class="flex-col gap-3">
            <div class="flex gap-3">
              <div class="form-group" style="flex:1">
                <label>Name *</label>
                <input class="form-control" type="text" [(ngModel)]="singleName"
                  placeholder="Full name" (keyup.enter)="addOne()" />
              </div>
              <div class="form-group" style="flex:1">
                <label>Contact / Reference</label>
                <input class="form-control" type="text" [(ngModel)]="singleContact"
                  placeholder="Email or ticket number" (keyup.enter)="addOne()" />
              </div>
            </div>
            <div>
              <button class="btn btn-primary" (click)="addOne()" [disabled]="!singleName.trim()">
                Add Participant
              </button>
            </div>
          </div>
        }

        @if (inputTab() === 'import') {
          <div class="flex-col gap-3">
            <div class="import-drop" (click)="fileInput.click()"
              (dragover)="$event.preventDefault()"
              (drop)="onDrop($event)">
              <input #fileInput type="file" accept=".csv,.txt" style="display:none"
                (change)="onFileChange($event)">
              <p class="import-label">Drop CSV file here or click to browse</p>
              <p class="import-hint">Format: name, contact_info (one per row)</p>
            </div>
            @if (importResult() > 0) {
              <span class="success-msg">Imported {{ importResult() }} participants.</span>
            }
          </div>
        }
      </div>

      <!-- Table -->
      <div class="card" style="padding:0;overflow:hidden">
        @if (participants().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h4>No participants yet</h4>
            <p>Use the form above to add participants.</p>
          </div>
        } @else {
          <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;background:var(--gray-50)">
            <div style="position:relative;display:flex;align-items:center;flex:1;max-width:340px">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:10px;color:var(--text-muted);pointer-events:none">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input class="form-control" type="text" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
                placeholder="Search by name or contact..." style="width:100%;padding:7px 30px 7px 32px" />
              @if (searchQuery()) {
                <button (click)="searchQuery.set('')" title="Clear search"
                  style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;line-height:1;padding:2px 4px">&times;</button>
              }
            </div>
            <button class="btn btn-ghost btn-sm" (click)="exportExcel()" [disabled]="participants().length === 0"
              style="display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:6px 12px;margin-left:auto">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Excel
            </button>
            <span style="font-size:12px;color:var(--text-muted)">
              {{ filteredParticipants().length }} of {{ participants().length }}
            </span>
          </div>
          <div class="table-wrap" style="max-height:480px;overflow-y:scroll">
            <table>
              <thead style="position:sticky;top:0;background:var(--gray-50);z-index:2;box-shadow:0 1px 0 var(--border)">
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                @for (p of filteredParticipants(); track p.id; let i = $index) {
                  <tr [style.opacity]="p.is_eligible === 0 ? '0.5' : '1'">
                    <td style="color:var(--text-muted);width:40px">{{ i + 1 }}</td>
                    <td style="font-weight:500">{{ p.name }}</td>
                    <td style="color:var(--text-secondary);font-size:13px">{{ p.contact_info || '—' }}</td>
                    <td>
                      @if (p.is_eligible === 1) {
                        <span class="badge badge-active">Eligible</span>
                      } @else {
                        <span class="badge badge-completed">Drawn</span>
                      }
                    </td>
                    <td>
                      <button class="btn btn-ghost btn-sm" (click)="deleteParticipant(p.id)">Remove</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .panel { display: flex; flex-direction: column; gap: 20px; }
    .panel-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      h2 { font-size: 20px; }
    }
    .sub-text { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
    .success-msg { font-size: 13px; color: #1a5c22; font-weight: 600; }

    .import-drop {
      border: 2px dashed var(--border);
      border-radius: var(--radius);
      padding: 36px 24px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.15s;
      &:hover { border-color: var(--green); }
    }
    .import-label { font-size: 14px; color: var(--text-secondary); font-weight: 500; margin-bottom: 4px; }
    .import-hint  { font-size: 12px; color: var(--text-muted); }
  `]
})
export class ParticipantsPanelComponent implements OnInit {
  bulkText = '';
  singleName = '';
  singleContact = '';
  readonly searchQuery = signal('');
  inputTab = signal<'bulk' | 'single' | 'import'>('bulk');
  lastAddedCount = signal(0);
  importResult = signal(0);

  readonly participants = computed(() => this.participantSvc.participants());
  readonly totalCount = computed(() => this.participantSvc.totalCount());
  readonly eligibleCount = computed(() => this.participantSvc.eligibleCount());
  readonly filteredParticipants = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.participants();
    return this.participants().filter(p =>
      p.name.toLowerCase().includes(q) || (p.contact_info && p.contact_info.toLowerCase().includes(q))
    );
  });

  constructor(private participantSvc: ParticipantService) { }

  ngOnInit(): void { this.participantSvc.refresh(); }

  addBulk(): void {
    const count = this.participantSvc.addBulk(this.bulkText);
    this.lastAddedCount.set(count);
    this.bulkText = '';
    setTimeout(() => this.lastAddedCount.set(0), 3000);
  }

  addOne(): void {
    if (!this.singleName.trim()) return;
    this.participantSvc.addOne(this.singleName, this.singleContact);
    this.singleName = '';
    this.singleContact = '';
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const reader = new FileReader();
    reader.onload = e => {
      const count = this.participantSvc.importFromCSV(e.target?.result as string);
      this.importResult.set(count);
      setTimeout(() => this.importResult.set(0), 4000);
    };
    reader.readAsText(input.files[0]);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const count = this.participantSvc.importFromCSV(e.target?.result as string);
      this.importResult.set(count);
    };
    reader.readAsText(file);
  }

  resetEligibility(): void { this.participantSvc.resetEligibility(); }
  deleteParticipant(id: number): void { this.participantSvc.deleteParticipant(id); }

  exportExcel(): void {
    this.participantSvc.exportExcel();
  }

  confirmClearAll(): void {
    if (confirm('Delete ALL participants? This cannot be undone.')) {
      this.participants().forEach(p => this.participantSvc.deleteParticipant(p.id));
    }
  }
}
