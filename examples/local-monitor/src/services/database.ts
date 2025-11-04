import Database from 'better-sqlite3'; // eslint-disable-line @typescript-eslint/no-require-imports
import {join} from 'path';
import {appDataDir} from '@utils/paths.js';

export interface Device {
  id: string;
  name: string;
  model: string;
  address: string;
  username: string;
  password: string;
  lastSeen: number | null;
}

const DB_PATH = join(appDataDir(), 'devices.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db === null) {
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        address TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        lastSeen INTEGER,
        name TEXT,
        model TEXT
      )
    `);
  }

  return db;
}

export function addDevice(
  id: string,
  address: string,
  username: string,
  password: string,
  name: string,
  model: string,
): Device {
  const database = getDatabase();
  const stmt = database.prepare(
    'INSERT INTO devices (id, address, username, password, name, model) VALUES (?, ?, ?, ?, ?, ?)',
  );
  stmt.run(id, address, username, password, name, model);

  return {
    id,
    address,
    username,
    password,
    lastSeen: null,
    name,
    model,
  };
}

export function getAllDevices(): Device[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM devices ORDER BY rowid');

  return stmt.all() as Device[];
}

export function updateLastSeen(id: string, timestamp: number): void {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE devices SET lastSeen = ? WHERE id = ?');

  stmt.run(timestamp, id);
}

export function deleteDevice(id: string): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM devices WHERE id = ?');

  stmt.run(id);
}

export function updateDeviceName(id: string, name: string): void {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE devices SET name = ? WHERE id = ?');
  stmt.run(name, id);
}
