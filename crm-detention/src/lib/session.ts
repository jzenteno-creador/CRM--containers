import { cookies } from "next/headers";
import type { Session } from "./types";

const COOKIE = "crm_session";

/** Lee la sesión desde la cookie (server-side). Null si no hay login. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Session;
  } catch {
    return null;
  }
}

export function encodeSession(s: Session): string {
  return Buffer.from(JSON.stringify(s), "utf8").toString("base64url");
}

export const SESSION_COOKIE = COOKIE;
