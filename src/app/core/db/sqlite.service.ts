import { Injectable, signal } from '@angular/core';
import { DrawHistory, DrawHistoryWithDetails, Participant, Prize } from '../models/models';

declare const initSqlJs: any;

const DB_KEY = 'stpaul_raffle_db';

@Injectable({ providedIn: 'root' })
export class SqliteService {
  private db: any = null;
  private SQL: any = null;

  readonly isReady = signal(false);

  async initialize(): Promise<void> {
    // Load sql.js from public directory
    if (typeof initSqlJs === 'undefined') {
      await this.loadScript('/sql-wasm.js');
    }

    this.SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm'
    });

    // Try to load existing DB from localStorage
    const saved = localStorage.getItem(DB_KEY);
    if (saved) {
      try {
        const uint8 = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
        this.db = new this.SQL.Database(uint8);
      } catch (e) {
        console.warn('[SqliteService] Corrupt DB in storage, starting fresh', e);
        localStorage.removeItem(DB_KEY);
        this.db = new this.SQL.Database();
      }
    } else {
      this.db = new this.SQL.Database();
    }

    this.initSchema();
    this.isReady.set(true);
    console.log('[SqliteService] Database ready');
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  private initSchema(): void {
    // sql.js requires individual run() calls per statement (no multi-statement support)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_info TEXT DEFAULT '',
        is_eligible INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS prizes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        image_data TEXT DEFAULT '',
        tier TEXT CHECK(tier IN ('Major','Minor')) DEFAULT 'Minor',
        quantity_total INTEGER DEFAULT 1,
        quantity_remaining INTEGER DEFAULT 1,
        draw_mode TEXT CHECK(draw_mode IN ('bulk','sequential')) DEFAULT 'sequential',
        sequence_order INTEGER DEFAULT 0,
        status TEXT CHECK(status IN ('pending','active','completed')) DEFAULT 'pending'
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS draw_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prize_id INTEGER REFERENCES prizes(id),
        participant_id INTEGER REFERENCES participants(id),
        drawn_at TEXT DEFAULT (datetime('now','localtime')),
        spin_batch_id TEXT DEFAULT ''
      )
    `);
    this.persist();
  }

  run(sql: string, params: any[] = []): void {
    try {
      this.db.run(sql, params);
      this.persist();
    } catch (e) {
      console.error('[SqliteService] run() error:', e, sql);
      throw e;
    }
  }

  query<T = any>(sql: string, params: any[] = []): T[] {
    const results: T[] = [];
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const rows = this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  getLastInsertId(): number {
    const row = this.queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    return row?.id ?? 0;
  }

  private persist(): void {
    try {
      const data: Uint8Array = this.db.export();
      const b64 = btoa(Array.from(data, b => String.fromCharCode(b)).join(''));
      localStorage.setItem(DB_KEY, b64);
    } catch (e) {
      console.warn('[SqliteService] Persist failed (storage quota?)', e);
    }
  }

  clearAll(): void {
    this.run('DELETE FROM draw_history');
    this.run('DELETE FROM prizes');
    this.run('DELETE FROM participants');
    this.persist();
  }

  // ---- Participants ----
  getAllParticipants(): Participant[] {
    return this.query<Participant>('SELECT * FROM participants ORDER BY name ASC');
  }

  getEligibleParticipants(): Participant[] {
    return this.query<Participant>('SELECT * FROM participants WHERE is_eligible = 1 ORDER BY name ASC');
  }

  insertParticipant(name: string, contactInfo = ''): void {
    this.run('INSERT INTO participants (name, contact_info) VALUES (?, ?)', [name.trim(), contactInfo.trim()]);
  }

  markParticipantDrawn(id: number): void {
    this.run('UPDATE participants SET is_eligible = 0 WHERE id = ?', [id]);
  }

  resetParticipantEligibility(): void {
    this.run('UPDATE participants SET is_eligible = 1');
  }

  deleteParticipant(id: number): void {
    this.run('DELETE FROM participants WHERE id = ?', [id]);
  }

  // ---- Prizes ----
  getAllPrizes(): Prize[] {
    return this.query<Prize>('SELECT * FROM prizes ORDER BY sequence_order ASC');
  }

  getPrize(id: number): Prize | null {
    return this.queryOne<Prize>('SELECT * FROM prizes WHERE id = ?', [id]);
  }

  insertPrize(prize: Partial<Prize>): number {
    const maxOrder = this.queryOne<{ max_order: number }>('SELECT MAX(sequence_order) as max_order FROM prizes');
    const nextOrder = (maxOrder?.max_order ?? -1) + 1;
    this.run(
      'INSERT INTO prizes (title, description, image_data, tier, quantity_total, quantity_remaining, draw_mode, sequence_order, status) VALUES (?,?,?,?,?,?,?,?,?)',
      [prize.title, prize.description ?? '', prize.image_data ?? '', prize.tier ?? 'Minor',
       prize.quantity_total ?? 1, prize.quantity_total ?? 1, prize.draw_mode ?? 'sequential', nextOrder, 'pending']
    );
    return this.getLastInsertId();
  }

  updatePrize(id: number, prize: Partial<Prize>): void {
    this.run(
      'UPDATE prizes SET title=?, description=?, image_data=?, tier=?, quantity_total=?, quantity_remaining=?, draw_mode=?, sequence_order=?, status=? WHERE id=?',
      [prize.title, prize.description, prize.image_data, prize.tier, prize.quantity_total, prize.quantity_remaining, prize.draw_mode, prize.sequence_order, prize.status, id]
    );
  }

  deletePrize(id: number): void {
    this.run('DELETE FROM draw_history WHERE prize_id = ?', [id]);
    this.run('DELETE FROM prizes WHERE id = ?', [id]);
  }

  reorderPrizes(prizes: Prize[]): void {
    prizes.forEach((p, i) => {
      this.run('UPDATE prizes SET sequence_order = ? WHERE id = ?', [i, p.id]);
    });
    this.persist();
  }

  // ---- Draw History ----
  insertDrawHistory(prizeId: number, participantId: number, batchId: string): void {
    this.run(
      'INSERT INTO draw_history (prize_id, participant_id, spin_batch_id) VALUES (?,?,?)',
      [prizeId, participantId, batchId]
    );
  }

  getDrawHistoryWithDetails(): DrawHistoryWithDetails[] {
    return this.query<DrawHistoryWithDetails>(`
      SELECT
        dh.id, dh.prize_id, dh.participant_id, dh.drawn_at, dh.spin_batch_id,
        COALESCE(p.name, 'Unknown Participant') AS participant_name,
        COALESCE(pr.title, 'Unknown Prize') AS prize_title,
        COALESCE(pr.tier, 'Minor') AS prize_tier,
        pr.image_data AS prize_image_data
      FROM draw_history dh
      LEFT JOIN participants p ON dh.participant_id = p.id
      LEFT JOIN prizes pr ON dh.prize_id = pr.id
      ORDER BY dh.drawn_at DESC, dh.id DESC
    `);
  }
}
