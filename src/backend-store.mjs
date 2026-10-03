import { DatabaseSync } from 'node:sqlite';

export class BackendStore {
  constructor(dbFile) {
    this.db = new DatabaseSync(dbFile);
    try {
      this.db.exec('PRAGMA busy_timeout=2000; PRAGMA foreign_keys=ON;');
      const version = this.db.prepare('PRAGMA user_version').get().user_version;
      if (version !== 0 && version !== 1) throw new Error('Unsupported backend database schema');
      if (version === 0) {
        if (this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length) throw new Error('Unknown backend database schema');
        this.db.exec(`BEGIN IMMEDIATE;
          CREATE TABLE records (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, parent TEXT, revision INTEGER, body TEXT NOT NULL, UNIQUE(kind,parent,revision));
          CREATE TABLE events (seq INTEGER PRIMARY KEY AUTOINCREMENT, recordId TEXT NOT NULL REFERENCES records(id), kind TEXT NOT NULL, createdAt TEXT NOT NULL);
          CREATE TRIGGER records_no_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'immutable'); END;
          CREATE TRIGGER records_no_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT,'immutable'); END;
          CREATE TRIGGER events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'immutable'); END;
          CREATE TRIGGER events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'immutable'); END;
          PRAGMA user_version=1; COMMIT;`);
      }
      if (this.db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Corrupt backend database');
      this.db.prepare('SELECT id,kind,parent,revision,body FROM records LIMIT 0').all();
      this.db.prepare('SELECT recordId,kind,createdAt FROM events LIMIT 0').all();
    } catch (e) { this.db.close(); throw e; }
  }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  insert(kind, parent, record) {
    this.db.prepare('INSERT INTO records(id,kind,parent,revision,body) VALUES(?,?,?,?,?)').run(record.id, kind, parent, record.revision ?? null, JSON.stringify(record));
    this.db.prepare('INSERT INTO events(recordId,kind,createdAt) VALUES(?,?,?)').run(record.id, kind, record.createdAt ?? record.observedAt);
    return record;
  }
  get(kind, id) { const r = this.db.prepare('SELECT body FROM records WHERE kind=? AND id=?').get(kind, id); return r ? JSON.parse(r.body) : null; }
  list(kind, parent = null) { return this.db.prepare('SELECT body FROM records WHERE kind=? AND parent IS ? ORDER BY seq').all(kind, parent).map(r => JSON.parse(r.body)); }
  close() { this.db.close(); }
}
