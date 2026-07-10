// Proteção contra apagamento silencioso de dados. O WebKit (Safari) pode
// apagar TODO o armazenamento gravável por script — IndexedDB incluído —
// depois de 7 dias sem interação com o site, se ele não estiver instalado
// na tela de início. Isso é o pior cenário possível para um diário de saúde.

export async function ensurePersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return null;
  const already = await navigator.storage.persisted();
  if (already) return true;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isStoragePersisted() {
  if (!navigator.storage || !navigator.storage.persisted) return null;
  try {
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}

export function isIOS() {
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}
