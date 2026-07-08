import { redirect } from "next/navigation";

// Sin sesión todavía (M2 wirea auth): la raíz manda al login.
export default function Home() {
  redirect("/login");
}
