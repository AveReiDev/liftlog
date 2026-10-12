/**
 * Backup and restore of everything she owns: settings, her own exercises,
 * workout plans and history.
 *
 * localStorage belongs to one origin, and Safari can clear it. An exported
 * file is the only way data survives a new phone or "Clear website data".
 * It is also how her old notes-app history gets in: it arrives as a backup file.
 *
 * Nothing is trusted on the way in: import only writes raw payloads, and each
 * store's sanitiser filters them on the next load.
 */

import { KEYS } from './storage.js';

export const APP_ID = 'liftlog';
export const BACKUP_FORMAT = 1;

const raw = (storage, key) => storage.read(key, null, (data) => data);
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function createBackup(storage, now) {
  return {
    app: APP_ID,
    format: BACKUP_FORMAT,
    exportedAt: new Date(now).toISOString(),
    settings: raw(storage, KEYS.settings),
    library: raw(storage, KEYS.library),
    workouts: raw(storage, KEYS.workouts),
    history: raw(storage, KEYS.history),
  };
}

export function backupFilename(now) {
  const d = new Date(now);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `liftlog-backup-${day}.json`;
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return { ok: false, error: 'That file isn’t a backup. It couldn’t be read as JSON.' };
  }
  if (!isObject(data) || data.app !== APP_ID) return { ok: false, error: 'That file isn’t a Lift Log backup.' };
  if (data.format !== BACKUP_FORMAT) return { ok: false, error: `This backup uses format ${data.format}, which this version can’t read.` };
  return { ok: true, backup: data };
}

/** Union two lists by id. Items already on the device win a clash. */
function unionById(current, incoming) {
  const mine = Array.isArray(current) ? current : [];
  const ids = new Set(mine.map((x) => x?.id));
  const added = (Array.isArray(incoming) ? incoming : []).filter((x) => isObject(x) && typeof x.id === 'string' && !ids.has(x.id));
  return { list: [...mine, ...added], added: added.length };
}

/**
 * Restore by MERGING, so importing an old file on a phone that has trained
 * since loses nothing. Settings are kept unless the device has none.
 * The caller reloads so every store re-reads, and re-cleans, what was written.
 */
export function restoreBackup(storage, backup) {
  const result = { sessions: 0, workouts: 0, exercises: 0 };

  if (Array.isArray(backup.history)) {
    const { list, added } = unionById(raw(storage, KEYS.history), backup.history);
    storage.write(KEYS.history, list);
    result.sessions = added;
  }
  if (Array.isArray(backup.workouts)) {
    const { list, added } = unionById(raw(storage, KEYS.workouts), backup.workouts);
    storage.write(KEYS.workouts, list);
    result.workouts = added;
  }
  if (isObject(backup.library)) {
    const current = isObject(raw(storage, KEYS.library)) ? raw(storage, KEYS.library) : {};
    const { list, added } = unionById(current.customs, backup.library.customs);
    storage.write(KEYS.library, {
      customs: list,
      overrides: { ...(isObject(backup.library.overrides) ? backup.library.overrides : {}), ...(isObject(current.overrides) ? current.overrides : {}) },
    });
    result.exercises = added;
  }
  if (isObject(backup.settings) && !isObject(raw(storage, KEYS.settings))) {
    storage.write(KEYS.settings, backup.settings);
  }
  return result;
}
