// Backup automático de segurança. Em navegadores com File System Access API
// (Chromium), grava um snapshot JSON periódico numa pasta escolhida pelo
// usuário — pode ser uma pasta sincronizada com nuvem, sem exigir servidor
// nosso. No iOS (sem essa API), só rastreamos a data do último backup para
// mostrar um lembrete quando estiver desatualizado.

import { getSetting, setSetting, exportAllData } from "./db.js";

const LAST_BACKUP_KEY = "ultimoBackupEm";
const BACKUP_DIR_KEY = "backupDirHandle";
export const AUTO_BACKUP_INTERVAL_DAYS = 7;
export const BACKUP_NUDGE_DAYS = 30;

export function fileSystemAccessSupported() {
  return "showDirectoryPicker" in window;
}

export async function chooseBackupFolder() {
  const handle = await window.showDirectoryPicker({ id: "diario-vital-backup", mode: "readwrite" });
  await setSetting(BACKUP_DIR_KEY, handle);
  return handle;
}

export async function getBackupFolderHandle() {
  return getSetting(BACKUP_DIR_KEY, null);
}

export async function clearBackupFolder() {
  await setSetting(BACKUP_DIR_KEY, null);
}

export async function getLastBackupAt() {
  return getSetting(LAST_BACKUP_KEY, null);
}

export async function markBackupDone() {
  await setSetting(LAST_BACKUP_KEY, new Date().toISOString());
}

export function daysSince(isoDate) {
  if (!isoDate) return null;
  const diffMs = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

async function writeBackupFile(handle) {
  const perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm !== "granted") return false;
  const data = await exportAllData();
  const stamp = new Date().toISOString().slice(0, 10);
  const fileHandle = await handle.getFileHandle(`diario-vital-backup-${stamp}.json`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
  return true;
}

/** Chamado no boot: grava um backup silencioso se houver pasta configurada
 * e já tiver passado o intervalo desde o último. Nunca pede permissão de
 * novo sozinho (exigiria gesto do usuário) — só usa se já estiver concedida. */
export async function runAutoBackupIfDue() {
  const handle = await getBackupFolderHandle();
  if (!handle) return false;
  const days = daysSince(await getLastBackupAt());
  if (days !== null && days < AUTO_BACKUP_INTERVAL_DAYS) return false;
  try {
    const ok = await writeBackupFile(handle);
    if (ok) await markBackupDone();
    return ok;
  } catch {
    return false;
  }
}
