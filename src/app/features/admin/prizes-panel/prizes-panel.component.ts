import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RaffleService } from '../../../core/services/raffle.service';
import { Prize, PrizeTier, DrawMode } from '../../../core/models/models';

interface PrizeForm {
  title: string;
  description: string;
  image_data: string;
  tier: PrizeTier;
  quantity_total: number;
  draw_mode: DrawMode;
}

const DEFAULT_FORM: PrizeForm = {
  title: '', description: '', image_data: '',
  tier: 'Minor', quantity_total: 1, draw_mode: 'sequential'
};

@Component({
  selector: 'app-prizes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel">
      <div class="panel-header">
        <div>
          <h2>Prizes &amp; Raffle Sequence</h2>
          <p class="sub-text">{{ prizes().length }} prizes configured &middot; Drag to reorder</p>
        </div>
        <button class="btn btn-primary" (click)="openModal()">Add Prize</button>
      </div>

      @if (prizes().length === 0) {
        <div class="empty-state card">
          <div class="empty-icon">
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/>
              <line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
            </svg>
          </div>
          <h4>No prizes yet</h4>
          <p>Add prizes using the button above.</p>
        </div>
      } @else {
        <div class="prize-list">
          @for (prize of prizes(); track prize.id; let i = $index) {
            <div class="prize-row card" [class.major-row]="prize.tier === 'Major'"
              [class.completed-row]="prize.status === 'completed'">

              <div class="prize-row-left">
                <span class="order-num">{{ i + 1 }}</span>

                @if (prize.image_data) {
                  <img [src]="prize.image_data" class="prize-thumb" alt="Prize" />
                } @else {
                  <div class="prize-thumb-placeholder">No Image</div>
                }

                <div class="prize-details">
                  <div class="prize-name-row">
                    <span class="prize-name">{{ prize.title }}</span>
                    <span class="badge" [ngClass]="prize.tier === 'Major' ? 'badge-major' : 'badge-minor'">
                      {{ prize.tier }}
                    </span>
                    <span class="badge" [ngClass]="'badge-' + prize.status">{{ prize.status }}</span>
                  </div>
                  @if (prize.description) {
                    <p class="prize-desc-sm">{{ prize.description }}</p>
                  }
                  <div class="prize-chips-row">
                    <span class="info-chip">{{ prize.quantity_remaining }}/{{ prize.quantity_total }} remaining</span>
                    <span class="info-chip">{{ prize.draw_mode === 'bulk' ? 'Bulk Draw' : 'Sequential' }}</span>
                  </div>
                </div>
              </div>

              <div class="prize-row-actions">
                <button class="btn btn-primary btn-sm" [disabled]="prize.status === 'completed'"
                  (click)="setActivePrize(prize)">
                  {{ prize.status === 'active' ? 'Active' : 'Activate' }}
                </button>
                <button class="btn btn-secondary btn-sm" [disabled]="prize.status === 'completed'" (click)="openModal(prize)">Edit</button>
                <button class="btn btn-danger btn-sm" (click)="deletePrize(prize.id)">Delete</button>
                <div class="reorder-btns">
                  <button class="btn btn-ghost btn-sm" (click)="moveUp(i)" [disabled]="i === 0">Up</button>
                  <button class="btn btn-ghost btn-sm" (click)="moveDown(i)" [disabled]="i === prizes().length - 1">Down</button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Prize Modal -->
    @if (showModal()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal" style="max-width:580px" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingId() ? 'Edit Prize' : 'Add New Prize' }}</h3>
            <button class="btn btn-ghost btn-sm" (click)="closeModal()">Close</button>
          </div>
          <div class="modal-body">
            <div class="flex gap-4">
              <div class="form-group" style="flex:1">
                <label>Prize Title *</label>
                <input class="form-control" type="text" [(ngModel)]="form.title"
                  placeholder="e.g. Smart TV 55-inch" />
              </div>
              <div class="form-group" style="width:120px">
                <label>Tier</label>
                <select class="form-control" [(ngModel)]="form.tier">
                  <option value="Major">Major</option>
                  <option value="Minor">Minor</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Description</label>
              <textarea class="form-control" rows="2" [(ngModel)]="form.description"
                placeholder="Optional details..."></textarea>
            </div>

            <div class="flex gap-4">
              <div class="form-group" style="flex:1">
                <label>Number of Winners</label>
                <input class="form-control" type="number" [(ngModel)]="form.quantity_total" min="1" max="999" />
              </div>
              <div class="form-group" style="flex:1">
                <label>Draw Mode</label>
                <select class="form-control" [(ngModel)]="form.draw_mode">
                  <option value="sequential">Sequential (spin each)</option>
                  <option value="bulk">Bulk (reveal all at once)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Prize Image</label>
              <div class="image-upload-area" (click)="imgInput.click()">
                <input #imgInput type="file" accept="image/*" style="display:none"
                  (change)="onImageChange($event)" />
                @if (form.image_data) {
                  <div class="img-preview-wrap">
                    <img [src]="form.image_data" class="img-preview" alt="Prize" />
                    <button class="clear-img-btn" (click)="$event.stopPropagation(); form.image_data = ''">Remove</button>
                  </div>
                } @else {
                  <div class="img-placeholder">
                    Click to upload image (JPG, PNG, WebP — max 2MB)
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="savePrize()" [disabled]="!form.title.trim()">
              {{ editingId() ? 'Save Changes' : 'Create Prize' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .panel { display: flex; flex-direction: column; gap: 20px; }
    .panel-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      h2 { font-size: 20px; }
    }
    .sub-text { font-size: 13px; color: var(--text-muted); margin-top: 2px; }

    .prize-list { display: flex; flex-direction: column; gap: 10px; }

    .prize-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 16px;
      &.major-row { border-color: #f0cc70; background: #fffdf5; }
      &.completed-row { opacity: 0.55; }
    }

    .prize-row-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }

    .order-num {
      width: 26px; height: 26px;
      background: var(--gray-100);
      border: 1px solid var(--border);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
      color: var(--text-muted);
      font-family: 'Outfit', sans-serif;
      flex-shrink: 0;
    }

    .prize-thumb {
      width: 52px; height: 52px;
      object-fit: cover;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      flex-shrink: 0;
    }

    .prize-thumb-placeholder {
      width: 52px; height: 52px;
      background: var(--gray-100);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; color: var(--text-muted);
      font-weight: 600;
      flex-shrink: 0;
    }

    .prize-details { flex: 1; min-width: 0; }

    .prize-name-row {
      display: flex; align-items: center; gap: 7px;
      flex-wrap: wrap; margin-bottom: 4px;
    }
    .prize-name { font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif; }
    .prize-desc-sm { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }

    .prize-chips-row { display: flex; gap: 6px; }
    .info-chip {
      font-size: 11px; font-weight: 600;
      color: var(--text-muted);
      background: var(--gray-100);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 2px 7px;
      font-family: 'Outfit', sans-serif;
    }

    .prize-row-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .reorder-btns { display: flex; gap: 2px; }

    .image-upload-area {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      cursor: pointer;
      transition: border-color 0.15s;
      overflow: hidden;
      &:hover { border-color: var(--green); }
    }

    .img-placeholder {
      padding: 24px;
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
      background: var(--gray-50);
    }

    .img-preview-wrap {
      position: relative;
      display: flex;
      justify-content: center;
      padding: 12px;
    }
    .img-preview {
      max-height: 140px;
      max-width: 100%;
      object-fit: contain;
      border-radius: var(--radius);
    }
    .clear-img-btn {
      position: absolute;
      top: 16px; right: 16px;
      background: var(--gray-700);
      color: white;
      border: none;
      padding: 3px 8px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 12px;
    }
  `]
})
export class PrizesPanelComponent implements OnInit {
  form: PrizeForm = { ...DEFAULT_FORM };
  showModal = signal(false);
  editingId = signal<number | null>(null);

  readonly prizes = computed(() => this.raffleSvc.prizes());

  constructor(private raffleSvc: RaffleService) { }
  ngOnInit(): void { this.raffleSvc.refresh(); }

  openModal(prize?: Prize): void {
    if (prize) {
      if (prize.status === 'completed') return;
      this.editingId.set(prize.id);
      this.form = {
        title: prize.title, description: prize.description, image_data: prize.image_data,
        tier: prize.tier, quantity_total: prize.quantity_total, draw_mode: prize.draw_mode
      };
    } else {
      this.editingId.set(null);
      this.form = { ...DEFAULT_FORM };
    }
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.editingId.set(null); }

  savePrize(): void {
    if (!this.form.title.trim()) return;
    const id = this.editingId();
    if (id) {
      this.raffleSvc.updatePrize(id, {
        title: this.form.title, description: this.form.description,
        image_data: this.form.image_data, tier: this.form.tier,
        quantity_total: this.form.quantity_total, draw_mode: this.form.draw_mode
      });
    } else {
      this.raffleSvc.createPrize({ ...this.form });
    }
    this.closeModal();
  }

  deletePrize(id: number): void {
    if (confirm('Delete this prize and its draw history?')) this.raffleSvc.deletePrize(id);
  }

  setActivePrize(prize: Prize): void { this.raffleSvc.setActive(prize.id); }
  moveUp(i: number): void {
    if (i === 0) return;
    const arr = [...this.prizes()];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    this.raffleSvc.reorderPrizes(arr);
  }
  moveDown(i: number): void {
    const arr = [...this.prizes()];
    if (i >= arr.length - 1) return;
    [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    this.raffleSvc.reorderPrizes(arr);
  }

  onImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = e => { this.form.image_data = e.target?.result as string; };
    reader.readAsDataURL(file);
  }
}
