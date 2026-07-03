"use client";

import { createContext, useContext } from "react";
import type { Session } from "@/lib/types";

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/** Sesión del usuario logueado. Solo usable bajo el layout (crm). */
export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession fuera del SessionProvider");
  return s;
}
