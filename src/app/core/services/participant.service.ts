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
      ? this._participants()
      : this._participants().filter(p => p.is_eligible === 1)
  );

  readonly totalCount = computed(() => this._participants().length);
  readonly eligibleCount = computed(() => this.eligibleParticipants().length);

  constructor(private db: SqliteService) {}

  refresh(): void {
    this._participants.set(this.db.getAllParticipants());
  }

  addBulk(text: string): number {
    const names = text
      .split(/[\n,]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);

    names.forEach(name => this.db.insertParticipant(name));
    this.refresh();
    return names.length;
  }

  addOne(name: string, contactInfo = ''): void {
    if (!name.trim()) return;
    this.db.insertParticipant(name, contactInfo);
    this.refresh();
  }

  importFromCSV(csvText: string): number {
    const lines = csvText.split('\n').filter(l => l.trim());
    let count = 0;
    lines.forEach(line => {
      const [name, contact] = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (name) {
        this.db.insertParticipant(name, contact ?? '');
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

  deleteParticipant(id: number): void {
    this.db.deleteParticipant(id);
    this.refresh();
  }

  resetEligibility(): void {
    this.db.resetParticipantEligibility();
    this.refresh();
  }

  setAllowRepeat(allow: boolean): void {
    this._allowRepeat.set(allow);
  }

  exportExcel(): void {
    const rows = this._participants();
    const headers = 'No.,Name,Contact/Reference,Status,Created At\n';
    const lines = rows.map((p, i) =>
      `"${i + 1}","${(p.name || '').replace(/"/g, '""')}","${(p.contact_info || '').replace(/"/g, '""')}","${p.is_eligible === 1 ? 'Eligible' : 'Drawn'}","${p.created_at || ''}"`
    ).join('\n');
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
