import { Injectable, computed, signal } from '@angular/core';
import { SqliteService } from '../db/sqlite.service';
import { Participant } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ParticipantService {
  private readonly _participants = signal<Participant[]>([]);
  private readonly _allowRepeat = signal(false);

  readonly participants = this._participants.asReadonly();
  readonly allowRepeat = this._allowRepeat.asReadonly();

  readonly eligibleParticipants = computed(() =>
    this._allowRepeat()
      ? this._participants().filter(p => !p.is_void)
      : this._participants().filter(p => p.is_eligible === 1 && !p.is_void)
  );

  readonly totalCount = computed(() => this._participants().length);
  readonly eligibleCount = computed(() => this.eligibleParticipants().length);

  constructor(private db: SqliteService) {}

  refresh(): void {
    this._participants.set(this.db.getAllParticipants());
  }

  addBulk(text: string): number {
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    let count = 0;
    lines.forEach(line => {
      // Support "Name, Grade & Section" or "Name"
      const parts = line.split(',');
      const name = parts[0]?.trim();
      const gradeSection = parts.slice(1).join(',').trim();
      if (name) {
        this.db.insertParticipant(name, gradeSection);
        count++;
      }
    });
    this.refresh();
    return count;
  }

  addOne(name: string, gradeSection = ''): void {
    if (!name.trim()) return;
    this.db.insertParticipant(name, gradeSection);
    this.refresh();
  }

  importFromCSV(csvText: string): number {
    const lines = csvText.split('\n').filter(l => l.trim());
    let count = 0;
    lines.forEach(line => {
      const [name, gradeSection] = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (name && name.toLowerCase() !== 'name') {
        this.db.insertParticipant(name, gradeSection ?? '');
        count++;
      }
    });
    this.refresh();
    return count;
  }

  markDrawn(id: number): void {
    this.db.markParticipantDrawn(id);
    this.refresh();
  }

  ensureEligible(id: number): void {
    this.db.ensureParticipantEligible(id);
    this.refresh();
  }

  markVoid(id: number): void {
    this.db.markParticipantVoid(id);
    this.refresh();
  }

  deleteParticipant(id: number): void {
    this.db.deleteParticipant(id);
    this.refresh();
  }

  resetEligibility(): void {
    this.db.resetParticipantEligibility();
    this.refresh();
  }

  resetForGrandPrize(): void {
    this.db.resetParticipantsForGrandPrize();
    this.refresh();
  }

  setAllowRepeat(allow: boolean): void {
    this._allowRepeat.set(allow);
  }

  exportExcel(): void {
    const rows = this._participants();
    const headers = 'No.,Name,Grade & Section,Status,Created At\n';
    const lines = rows.map((p, i) => {
      const status = p.is_void === 1 ? 'Void (Invalid)' : (p.is_eligible === 1 ? 'Eligible' : 'Drawn');
      const gs = p.grade_section || p.contact_info || '';
      return `"${i + 1}","${(p.name || '').replace(/"/g, '""')}","${gs.replace(/"/g, '""')}","${status}","${p.created_at || ''}"`;
    }).join('\n');
    this.download('participants.csv', 'text/csv;charset=utf-8;', '\ufeff' + headers + lines);
  }

  private download(filename: string, type: string, content: string): void {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** Placeholder: API integration point */
  async syncFromRegistrationAPI(endpoint: string): Promise<void> {
    // TODO: implement when registration app is ready
    console.log(`[ParticipantService] syncFromRegistrationAPI called for: ${endpoint}`);
    throw new Error('Registration API integration not yet configured');
  }
}
