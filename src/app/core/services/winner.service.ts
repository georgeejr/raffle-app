import { Injectable, computed, signal } from '@angular/core';
import { SqliteService } from '../db/sqlite.service';
import { DrawHistoryWithDetails } from '../models/models';

@Injectable({ providedIn: 'root' })
export class WinnerService {
  private readonly _history = signal<DrawHistoryWithDetails[]>([]);

  readonly history = this._history.asReadonly();

  readonly winnersGroupedByPrize = computed(() => {
    const map = new Map<string, { title: string; tier: string; image: string; winners: DrawHistoryWithDetails[] }>();
    this._history().forEach(row => {
      const key = String(row.prize_id);
      if (!map.has(key)) {
        map.set(key, {
          title: row.prize_title,
          tier: row.prize_tier,
          image: row.prize_image_data,
          winners: []
        });
      }
      map.get(key)!.winners.push(row);
    });
    return Array.from(map.values());
  });

  constructor(private db: SqliteService) {}

  refresh(): void {
    this._history.set(this.db.getDrawHistoryWithDetails());
  }

  exportExcel(): void {
    const rows = this._history();
    const headers = 'Prize,Tier,Winner Name,Grade & Section,Status,Drawn At\n';
    const lines = rows.map(r => {
      const status = r.status === 'allocated_teachers'
        ? 'Allocated to Teachers'
        : (r.status === 'voided' ? 'Voided' : 'Claimed');
      const gs = r.grade_section || '';
      return `"${r.prize_title.replace(/"/g, '""')}","${r.prize_tier}","${r.participant_name.replace(/"/g, '""')}","${gs.replace(/"/g, '""')}","${status}","${r.drawn_at}"`;
    }).join('\n');
    this.download('raffle-winners.csv', 'text/csv;charset=utf-8;', '\ufeff' + headers + lines);
  }

  private download(filename: string, type: string, content: string): void {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
