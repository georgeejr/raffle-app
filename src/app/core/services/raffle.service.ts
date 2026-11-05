import { Injectable, computed, signal } from '@angular/core';
import { SqliteService } from '../db/sqlite.service';
import { Prize } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RaffleService {
  private readonly _prizes = signal<Prize[]>([]);
  private readonly _activePrizeId = signal<number | null>(null);

  readonly prizes = this._prizes.asReadonly();

  readonly activePrize = computed(() => {
    const id = this._activePrizeId();
    return id ? this._prizes().find(p => p.id === id) ?? null : null;
  });

  readonly pendingPrizes = computed(() =>
    this._prizes().filter(p => p.status === 'pending')
  );

  readonly completedPrizes = computed(() =>
    this._prizes().filter(p => p.status === 'completed')
  );

  constructor(private db: SqliteService) {}

  refresh(): void {
    const prizes = this.db.getAllPrizes();
    this._prizes.set(prizes);

    // Maintain or restore active prize from DB
    const currentActiveId = this._activePrizeId();
    if (currentActiveId && prizes.some(p => p.id === currentActiveId && p.status === 'active')) {
      return;
    }

    const activeInDb = prizes.find(p => p.status === 'active');
    if (activeInDb) {
      this._activePrizeId.set(activeInDb.id);
    } else {
      this._activePrizeId.set(null);
    }
  }

  createPrize(prize: Partial<Prize>): number {
    const id = this.db.insertPrize(prize);
    this.refresh();
    return id;
  }

  updatePrize(id: number, prize: Partial<Prize>): void {
    const existing = this.db.getPrize(id);
    if (!existing) return;

    let updated: Prize = { ...existing, ...prize };

    // If total quantity changed, recalculate remaining quantity based on already drawn count
    if (prize.quantity_total !== undefined && prize.quantity_total !== existing.quantity_total) {
      const alreadyDrawn = Math.max(0, existing.quantity_total - existing.quantity_remaining);
      const newTotal = Math.max(1, prize.quantity_total);
      const newRemaining = Math.max(0, newTotal - alreadyDrawn);
      const newStatus = newRemaining <= 0 ? 'completed' : (existing.status === 'completed' ? 'pending' : existing.status);

      updated = {
        ...updated,
        quantity_total: newTotal,
        quantity_remaining: newRemaining,
        status: newStatus
      };
    }

    this.db.updatePrize(id, updated);
    this.refresh();
  }

  deletePrize(id: number): void {
    this.db.deletePrize(id);
    if (this._activePrizeId() === id) this._activePrizeId.set(null);
    this.refresh();
  }

  reorderPrizes(prizes: Prize[]): void {
    this.db.reorderPrizes(prizes);
    this.refresh();
  }

  setActive(prizeId: number): void {
    // Mark previous active as pending (if it wasn't completed)
    const current = this.activePrize();
    if (current && current.status === 'active') {
      this.db.updatePrize(current.id, { ...current, status: 'pending' });
    }
    // Set new active
    const prize = this.db.getPrize(prizeId);
    if (prize) {
      this.db.updatePrize(prizeId, { ...prize, status: 'active' });
    }
    this._activePrizeId.set(prizeId);
    this.refresh();
  }

  clearActive(): void {
    const current = this.activePrize();
    if (current && current.status === 'active') {
      this.db.updatePrize(current.id, { ...current, status: 'pending' });
    }
    this._activePrizeId.set(null);
    this.refresh();
  }

  getPrize(id: number): Prize | null {
    return this.db.getPrize(id);
  }

  recordWinner(prizeId: number, participantId: number, batchId: string): void {
    this.db.insertDrawHistory(prizeId, participantId, batchId);
    const prize = this.db.getPrize(prizeId);
    if (prize) {
      const remaining = prize.quantity_remaining - 1;
      const status = remaining <= 0 ? 'completed' : 'active';
      this.db.updatePrize(prizeId, { ...prize, quantity_remaining: remaining, status });
    }
    this.refresh();
  }

  recordBatchWinners(prizeId: number, participantIds: number[], batchId: string): void {
    participantIds.forEach(pid => {
      this.db.insertDrawHistory(prizeId, pid, batchId);
    });
    const prize = this.db.getPrize(prizeId);
    if (prize) {
      const remaining = Math.max(0, prize.quantity_remaining - participantIds.length);
      const status = remaining <= 0 ? 'completed' : 'active';
      this.db.updatePrize(prizeId, { ...prize, quantity_remaining: remaining, status });
    }
    this.refresh();
  }

  allocatePrizeToTeachers(prizeId: number, participantId: number, drawHistoryId?: number): void {
    this.db.allocateWinnerPrizeToTeachers(prizeId, participantId, drawHistoryId);
    this.refresh();
  }

  voidWinnerAndRestorePrize(prizeId: number, participantId: number, drawHistoryId?: number): void {
    if (drawHistoryId) {
      this.db.voidDrawHistory(drawHistoryId);
    } else {
      this.db.voidDrawHistoryByWinner(prizeId, participantId);
    }

    const prize = this.db.getPrize(prizeId);
    if (prize) {
      const remaining = Math.min(prize.quantity_total, prize.quantity_remaining + 1);
      this.db.updatePrize(prizeId, { ...prize, quantity_remaining: remaining, status: 'active' });
      this._activePrizeId.set(prizeId);
    }
    this.refresh();
  }
}
