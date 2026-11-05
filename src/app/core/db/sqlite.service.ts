import { Injectable, signal } from '@angular/core';
import { DrawHistory, DrawHistoryWithDetails, Participant, Prize } from '../models/models';

declare const initSqlJs: any;

const IDB_NAME = 'stpaul_raffle_idb';
const IDB_STORE = 'sqlite_store';
const SERVER_URL = 'http://localhost:3001/api/db';
const HEALTH_URL = 'http://localhost:3001/api/health';

class IdbHelper {
  static async get(): Promise<Uint8Array | null> {
    if (typeof indexedDB === 'undefined') return null;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(IDB_STORE)) {
            req.result.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => {
          try {
            const db = req.result;
            const tx = db.transaction(IDB_STORE, 'readonly');
            const getReq = tx.objectStore(IDB_STORE).get('database_file');
            getReq.onsuccess = () => resolve(getReq.result instanceof Uint8Array ? getReq.result : null);
            getReq.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  static async set(data: Uint8Array): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(IDB_STORE)) {
            req.result.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => {
          try {
            const db = req.result;
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(data, 'database_file');
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch {
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

@Injectable({ providedIn: 'root' })
export class SqliteService {
  private db: any = null;
  private SQL: any = null;
  private persistTimeout: any = null;

  readonly isReady = signal(false);
  readonly isServerConnected = signal(false);

  async initialize(): Promise<void> {
    // Load sql.js from public directory
    if (typeof initSqlJs === 'undefined') {
      await this.loadScript('/sql-wasm.js');
    }

    this.SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm'
    });

    let binaryData: Uint8Array | null = null;

    // 1. Try loading from the standalone local SQLite file on disk via the local storage server
    try {
      const resp = await fetch(SERVER_URL);
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength > 0) {
          binaryData = new Uint8Array(buffer);
          this.isServerConnected.set(true);
          console.log(`[SqliteService] Loaded ${binaryData.byteLength} bytes from standalone SQLite file on disk`);
        }
      }
    } catch {
      this.isServerConnected.set(false);
    }

    // 2. Fallback to browser IndexedDB (unlimited browser storage)
    if (!binaryData) {
      binaryData = await IdbHelper.get();
      if (binaryData) {
        console.log(`[SqliteService] Loaded ${binaryData.byteLength} bytes from browser IndexedDB`);
      }
    }

    // 3. Fallback: check legacy localStorage migration
    if (!binaryData) {
      const legacySaved = localStorage.getItem('stpaul_raffle_db');
      if (legacySaved) {
        try {
          binaryData = Uint8Array.from(atob(legacySaved), c => c.charCodeAt(0));
          console.log('[SqliteService] Migrated data from legacy localStorage');
        } catch {}
      }
    }

    if (binaryData && binaryData.length > 0) {
      try {
        this.db = new this.SQL.Database(binaryData);
      } catch (e) {
        console.warn('[SqliteService] Corrupt binary DB, creating fresh DB', e);
        this.db = new this.SQL.Database();
      }
    } else {
      this.db = new this.SQL.Database();
    }

    this.initSchema();
    this.persist();
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

  persist(): void {
    if (!this.db) return;
    try {
      const data: Uint8Array = this.db.export();

      // 1. Immediately persist to IndexedDB (browser local storage with no quota limits)
      IdbHelper.set(data);

      // 2. Debounce writing the binary database file onto disk via the local storage server
      if (this.persistTimeout) clearTimeout(this.persistTimeout);
      this.persistTimeout = setTimeout(() => {
        this.saveToServerDisk(data);
      }, 150);
    } catch (e) {
      console.warn('[SqliteService] Persist failed:', e);
    }
  }

  private async saveToServerDisk(data: Uint8Array): Promise<void> {
    try {
      const res = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: data as unknown as BodyInit
      });
      if (res.ok) {
        this.isServerConnected.set(true);
      }
    } catch {
      this.isServerConnected.set(false);
    }
  }

  /** Download a full backup of the standalone SQLite database file to user's machine */
  downloadBackup(): void {
    if (!this.db) return;
    const data: Uint8Array = this.db.export();
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `stpaul_raffle_backup_${dateStr}.db`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** Restore database from a user-uploaded .db or .sqlite backup file */
  async restoreFromBackup(file: File): Promise<boolean> {
    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const testDb = new this.SQL.Database(uint8);
      const check = testDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('participants', 'prizes', 'draw_history')");
      if (!check || check.length === 0) {
        throw new Error('Uploaded file is not a valid St. Paul raffle database backup.');
      }
      this.db = testDb;
      this.persist();
      return true;
    } catch (e) {
      console.error('[SqliteService] Restore failed:', e);
      throw e;
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

  deleteDrawHistory(id: number): void {
    this.run('DELETE FROM draw_history WHERE id = ?', [id]);
  }

  deleteDrawHistoryByWinner(prizeId: number, participantId: number): void {
    this.run(
      'DELETE FROM draw_history WHERE id IN (SELECT id FROM draw_history WHERE prize_id = ? AND participant_id = ? ORDER BY id DESC LIMIT 1)',
      [prizeId, participantId]
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
