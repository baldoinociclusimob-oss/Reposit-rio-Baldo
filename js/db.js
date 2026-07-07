// Camada de persistência — IndexedDB puro (sem dependências externas).
// Todos os dados ficam no dispositivo. Nada é enviado para fora.

import { normalize } from "./utils/text.js";

const DB_NAME = "diario-vital-db";
const DB_VERSION = 2;

const STORE_CHECKINS = "checkins";
const STORE_TAGS = "tags";
const STORE_SETTINGS = "settings";
const STORE_MOMENTOS = "momentos";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_CHECKINS)) {
        const store = db.createObjectStore(STORE_CHECKINS, { keyPath: "id" });
        store.createIndex("byDate", "date", { unique: false });
        store.createIndex("byTipo", "tipo", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_TAGS)) {
        const store = db.createObjectStore(STORE_TAGS, { keyPath: "id" });
        store.createIndex("byCategoria", "categoria", { unique: false });
        store.createIndex("byNomeNormalizado", ["categoria", "nomeNormalizado"], { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(STORE_MOMENTOS)) {
        const store = db.createObjectStore(STORE_MOMENTOS, { keyPath: "id" });
        store.createIndex("byDate", "date", { unique: false });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Abertura do banco bloqueada por outra aba aberta."));
  });
  return dbPromise;
}

function tx(db, storeNames, mode) {
  return db.transaction(storeNames, mode);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Transação abortada."));
  });
}

/* ---------------------------- Check-ins ---------------------------- */

export function checkinId(date, tipo) {
  return `${date}__${tipo}`;
}

export async function getCheckIn(date, tipo) {
  const db = await openDb();
  const t = tx(db, STORE_CHECKINS, "readonly");
  const store = t.objectStore(STORE_CHECKINS);
  const result = await reqToPromise(store.get(checkinId(date, tipo)));
  return result || null;
}

export async function saveCheckIn(checkin) {
  if (!checkin.date || !checkin.tipo) {
    throw new Error("Check-in precisa de date e tipo.");
  }
  const db = await openDb();
  const t = tx(db, STORE_CHECKINS, "readwrite");
  const store = t.objectStore(STORE_CHECKINS);
  const now = new Date().toISOString();
  const id = checkinId(checkin.date, checkin.tipo);
  const existing = await reqToPromise(store.get(id));
  const record = {
    ...existing,
    ...checkin,
    id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  store.put(record);
  await txDone(t);
  return record;
}

export async function getCheckInsByDate(date) {
  const db = await openDb();
  const t = tx(db, STORE_CHECKINS, "readonly");
  const store = t.objectStore(STORE_CHECKINS);
  const idx = store.index("byDate");
  const results = await reqToPromise(idx.getAll(IDBKeyRange.only(date)));
  return results || [];
}

export async function getCheckInsInRange(startKey, endKey) {
  const db = await openDb();
  const t = tx(db, STORE_CHECKINS, "readonly");
  const store = t.objectStore(STORE_CHECKINS);
  const idx = store.index("byDate");
  const range = IDBKeyRange.bound(startKey, endKey);
  const results = await reqToPromise(idx.getAll(range));
  return results || [];
}

export async function getAllCheckIns() {
  const db = await openDb();
  const t = tx(db, STORE_CHECKINS, "readonly");
  const store = t.objectStore(STORE_CHECKINS);
  return (await reqToPromise(store.getAll())) || [];
}

export async function deleteCheckIn(date, tipo) {
  const db = await openDb();
  const t = tx(db, STORE_CHECKINS, "readwrite");
  t.objectStore(STORE_CHECKINS).delete(checkinId(date, tipo));
  await txDone(t);
}

export async function bulkPutCheckIns(records) {
  const db = await openDb();
  const t = tx(db, STORE_CHECKINS, "readwrite");
  const store = t.objectStore(STORE_CHECKINS);
  for (const r of records) store.put(r);
  await txDone(t);
}

/* --------------------------- Momentos (avulsos) --------------------------- */
// Registros espontâneos: "como estou agora", a qualquer hora, sem vínculo com
// os 3 check-ins fixos. Podem existir vários no mesmo dia.

export async function saveMomento(momento) {
  if (!momento.date) throw new Error("Momento precisa de date.");
  const db = await openDb();
  const t = tx(db, STORE_MOMENTOS, "readwrite");
  const store = t.objectStore(STORE_MOMENTOS);
  const now = new Date().toISOString();
  const record = {
    ...momento,
    id: momento.id || crypto.randomUUID(),
    createdAt: momento.createdAt || now,
    updatedAt: now,
  };
  store.put(record);
  await txDone(t);
  return record;
}

export async function getMomento(id) {
  const db = await openDb();
  const t = tx(db, STORE_MOMENTOS, "readonly");
  return (await reqToPromise(t.objectStore(STORE_MOMENTOS).get(id))) || null;
}

export async function getMomentosByDate(date) {
  const db = await openDb();
  const t = tx(db, STORE_MOMENTOS, "readonly");
  const idx = t.objectStore(STORE_MOMENTOS).index("byDate");
  const results = (await reqToPromise(idx.getAll(IDBKeyRange.only(date)))) || [];
  return results.sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));
}

export async function getAllMomentos() {
  const db = await openDb();
  const t = tx(db, STORE_MOMENTOS, "readonly");
  return (await reqToPromise(t.objectStore(STORE_MOMENTOS).getAll())) || [];
}

export async function deleteMomento(id) {
  const db = await openDb();
  const t = tx(db, STORE_MOMENTOS, "readwrite");
  t.objectStore(STORE_MOMENTOS).delete(id);
  await txDone(t);
}

export async function bulkPutMomentos(records) {
  const db = await openDb();
  const t = tx(db, STORE_MOMENTOS, "readwrite");
  const store = t.objectStore(STORE_MOMENTOS);
  for (const r of records) store.put(r);
  await txDone(t);
}

/* ------------------------------- Tags ------------------------------- */

export async function getAllTags(categoria) {
  const db = await openDb();
  const t = tx(db, STORE_TAGS, "readonly");
  const store = t.objectStore(STORE_TAGS);
  if (categoria) {
    const idx = store.index("byCategoria");
    return (await reqToPromise(idx.getAll(IDBKeyRange.only(categoria)))) || [];
  }
  return (await reqToPromise(store.getAll())) || [];
}

export async function getTag(id) {
  const db = await openDb();
  const t = tx(db, STORE_TAGS, "readonly");
  return (await reqToPromise(t.objectStore(STORE_TAGS).get(id))) || null;
}

/** Busca uma tag existente por nome (normalizado) dentro da categoria, ou cria uma nova. */
export async function findOrCreateTag(categoria, nome) {
  const nomeTrim = (nome || "").trim();
  if (!nomeTrim) return null;
  const nomeNormalizado = normalize(nomeTrim);

  const db = await openDb();
  const t = tx(db, STORE_TAGS, "readwrite");
  const store = t.objectStore(STORE_TAGS);
  const idx = store.index("byNomeNormalizado");
  const existing = await reqToPromise(idx.get(IDBKeyRange.only([categoria, nomeNormalizado])));

  if (existing) {
    await txDone(t);
    return existing;
  }

  const now = new Date().toISOString();
  const tag = {
    id: crypto.randomUUID(),
    categoria,
    nome: nomeTrim,
    nomeNormalizado,
    createdAt: now,
    updatedAt: now,
  };
  store.put(tag);
  await txDone(t);
  return tag;
}

export async function renameTag(id, novoNome) {
  const nomeTrim = (novoNome || "").trim();
  if (!nomeTrim) throw new Error("Nome não pode ser vazio.");
  const db = await openDb();
  const t = tx(db, STORE_TAGS, "readwrite");
  const store = t.objectStore(STORE_TAGS);
  const tag = await reqToPromise(store.get(id));
  if (!tag) throw new Error("Tag não encontrada.");
  tag.nome = nomeTrim;
  tag.nomeNormalizado = normalize(nomeTrim);
  tag.updatedAt = new Date().toISOString();
  store.put(tag);
  await txDone(t);
  return tag;
}

export async function deleteTag(id) {
  const db = await openDb();
  const t = tx(db, STORE_TAGS, "readwrite");
  t.objectStore(STORE_TAGS).delete(id);
  await txDone(t);
}

export async function bulkPutTags(tags) {
  const db = await openDb();
  const t = tx(db, STORE_TAGS, "readwrite");
  const store = t.objectStore(STORE_TAGS);
  for (const tg of tags) store.put(tg);
  await txDone(t);
}

/* ----------------------------- Settings ----------------------------- */

export async function getSetting(key, fallback = null) {
  const db = await openDb();
  const t = tx(db, STORE_SETTINGS, "readonly");
  const result = await reqToPromise(t.objectStore(STORE_SETTINGS).get(key));
  return result ? result.value : fallback;
}

export async function setSetting(key, value) {
  const db = await openDb();
  const t = tx(db, STORE_SETTINGS, "readwrite");
  t.objectStore(STORE_SETTINGS).put({ key, value });
  await txDone(t);
}

/* ------------------------------ Export ------------------------------ */

export async function exportAllData() {
  const [checkins, tags, momentos] = await Promise.all([getAllCheckIns(), getAllTags(), getAllMomentos()]);
  return {
    exportedAt: new Date().toISOString(),
    version: DB_VERSION,
    checkins,
    tags,
    momentos,
  };
}

export const STORES = { STORE_CHECKINS, STORE_TAGS, STORE_SETTINGS, STORE_MOMENTOS };
