export type LocalAccount = { email: string; name: string };

const ACCOUNTS = "fenix.accounts";
const SESSION = "fenix.session";

function readAccounts(): { email: string; name: string; pass: string }[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS);
    return raw ? (JSON.parse(raw) as { email: string; name: string; pass: string }[]) : [];
  } catch {
    return [];
  }
}

async function digest(password: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`fenix:${password}`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getLocalAccount(): LocalAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION);
    return raw ? (JSON.parse(raw) as LocalAccount) : null;
  } catch {
    return null;
  }
}

export function clearLocalAccount() {
  try {
    localStorage.removeItem(SESSION);
  } catch {
    /* ignore */
  }
}

export async function localSignUp(email: string, password: string, name: string) {
  const list = readAccounts();
  const key = email.trim().toLowerCase();
  if (list.some((a) => a.email === key)) throw new Error("Questa email è già iscritta. Entra.");
  const pass = await digest(password);
  list.push({ email: key, name: name.trim() || key.split("@")[0], pass });
  localStorage.setItem(ACCOUNTS, JSON.stringify(list));
  const session = { email: key, name: name.trim() || key.split("@")[0] };
  localStorage.setItem(SESSION, JSON.stringify(session));
  return session;
}

export async function localSignIn(email: string, password: string) {
  const list = readAccounts();
  const key = email.trim().toLowerCase();
  const pass = await digest(password);
  const found = list.find((a) => a.email === key && a.pass === pass);
  if (!found) throw new Error("Email o password non corretti.");
  const session = { email: found.email, name: found.name };
  localStorage.setItem(SESSION, JSON.stringify(session));
  return session;
}
