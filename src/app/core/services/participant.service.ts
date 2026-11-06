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

  /**
   * Robust CSV parser that handles:
   * - 1st Column: Name
   * - 2nd Column: Grade & Section
   * - Supports quotes around fields with embedded commas (e.g. "Dela Cruz, Juan", "Grade 5 - St. Jude")
   * - Skips header row (e.g. "Name", "Grade & Section", "Student Name", etc.)
   * - Handles comma and tab delimiters
   */
  parseCSVRows(text: string): { name: string; gradeSection: string }[] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if ((char === ',' || char === '\t') && !insideQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    const result: { name: string; gradeSection: string }[] = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const col1 = (row[0] || '').trim().replace(/^"|"$/g, '');
      const col2 = (row[1] || '').trim().replace(/^"|"$/g, '');

      // Check if header row (e.g. "Name", "Grade & Section", "Student Name", etc.)
      const isHeader = r === 0 && (
        col1.toLowerCase() === 'name' ||
        col1.toLowerCase().includes('student') ||
        col1.toLowerCase().includes('participant') ||
        col1.toLowerCase().includes('full name') ||
        col2.toLowerCase().includes('grade') ||
        col2.toLowerCase().includes('section')
      );
      if (isHeader) continue;

      if (col1) {
        result.push({ name: col1, gradeSection: col2 });
      }
    }

    return result;
  }

  addBulk(text: string): number {
    const parsed = this.parseCSVRows(text);
    let count = 0;
    parsed.forEach(p => {
      this.db.insertParticipant(p.name, p.gradeSection);
      count++;
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
    const parsed = this.parseCSVRows(csvText);
    let count = 0;
    parsed.forEach(p => {
      this.db.insertParticipant(p.name, p.gradeSection);
      count++;
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
