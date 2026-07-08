import { redirect } from "next/navigation";

// Hub Admin (M8: usuarios, navieras, tarifas versionadas, plantas, config, ayuda).
// En M2 la única sección viva es Solicitudes de acceso — se entra directo.
export default function AdminPage() {
  redirect("/admin/solicitudes");
}
