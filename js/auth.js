// Trava de acesso ao app: senha local + Face ID/Touch ID (WebAuthn, autenticador
// da plataforma). Tudo verificado no próprio aparelho — nenhuma senha ou dado
// biométrico é enviado para fora. Sem servidor, não existe "recuperar senha":
// a única forma de contornar é limpar os dados do site no navegador, o que
// também apaga o diário — por isso a senha só pode ser trocada/removida sabendo
// a senha atual (ou o Face ID/Touch ID já habilitado).

import { getSetting, setSetting } from "./db.js";

const SETTINGS_KEY = "acesso";
const DEFAULT_SETTINGS = { enabled: false, hash: null, salt: null, faceId: null };

let unlockedInMemory = false;

export async function getAuthSettings() {
  const stored = await getSetting(SETTINGS_KEY, null);
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(byteLength) {
  return [...crypto.getRandomValues(new Uint8Array(byteLength))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function setPassword(password) {
  const salt = randomHex(16);
  const hash = await sha256Hex(salt + password);
  const settings = await getAuthSettings();
  settings.enabled = true;
  settings.salt = salt;
  settings.hash = hash;
  await setSetting(SETTINGS_KEY, settings);
}

export async function verifyPassword(password) {
  const settings = await getAuthSettings();
  if (!settings.hash || !settings.salt) return false;
  const hash = await sha256Hex(settings.salt + password);
  return hash === settings.hash;
}

export async function disableLock(currentPassword) {
  const ok = await verifyPassword(currentPassword);
  if (!ok) throw new Error("Senha incorreta.");
  await setSetting(SETTINGS_KEY, { ...DEFAULT_SETTINGS });
  unlockedInMemory = false;
}

export function isUnlockedThisSession() {
  return unlockedInMemory;
}
export function markUnlocked() {
  unlockedInMemory = true;
}

/* --------------------------- Face ID / Touch ID --------------------------- */

function toB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function platformBiometricAvailable() {
  return Boolean(
    window.PublicKeyCredential &&
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
    (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  );
}

export async function enableFaceId() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Diário Vital" },
      user: { id: userId, name: "diario-vital-local", displayName: "Diário Vital" },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
      attestation: "none",
    },
  });
  const settings = await getAuthSettings();
  settings.faceId = toB64(credential.rawId);
  settings.enabled = true;
  await setSetting(SETTINGS_KEY, settings);
}

export async function verifyFaceId() {
  const settings = await getAuthSettings();
  if (!settings.faceId) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: fromB64(settings.faceId), type: "public-key", transports: ["internal"] }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function disableFaceId() {
  const settings = await getAuthSettings();
  settings.faceId = null;
  await setSetting(SETTINGS_KEY, settings);
}
