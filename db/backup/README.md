# Backup & restore — schema `detention`

Cubre el finding **D-02** (sin estrategia de backup para la única copia de todo) en el
contexto del plan **free** de Supabase (sin PITR, sin backups descargables, auto-pausa a los
7 días de inactividad).

## Cómo funciona

`.github/workflows/backup-detention.yml` corre todos los días 03:00 AR y también a mano
(pestaña **Actions → Backup DB detention → Run workflow**). Hace `pg_dump` del schema
`detention` completo (datos + DDL) en dos formatos y los sube como **artifact** del run,
con retención de 90 días:

- `detention-<stamp>.dump` — formato custom comprimido, para restore selectivo con `pg_restore`.
- `detention-<stamp>.sql` — plain SQL legible, para diff/inspección.

Como beneficio colateral, el run diario mantiene el proyecto "activo" y evita el auto-pausado
del free tier.

## Setup (una vez, lo hace John)

1. Dashboard Supabase → **Connect** → copiar el connection string de **Session pooler** o
   **Direct connection** (⚠️ NO "Transaction pooler": `pg_dump` necesita sesión).
2. Repo GitHub → **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `SUPABASE_DB_URL`
   - Value: el connection string (incluye la db-password del proyecto).
3. Correr el workflow a mano una vez para validar que el dump sale OK.

## Restore (ensayo pendiente — anotado en D-02)

Contra un proyecto/DB vacío, en orden:

```bash
# opción A: desde el .dump custom
pg_restore --no-owner --no-privileges --dbname="$TARGET_DB_URL" detention-<stamp>.dump

# opción B: desde el .sql plain
psql "$TARGET_DB_URL" -f detention-<stamp>.sql
```

El schema DDL versionado en `db/schema/` (ítem 0.1 / D-03) sirve para reconstruir la
estructura aunque no haya dump de datos a mano. **Falta ensayar un restore end-to-end
contra un proyecto vacío y cronometrarlo** — es el paso que convierte "tengo backups" en
"sé que puedo restaurar".

## Mejora futura (no implementada)

Subir el artifact también a Google Drive (ya está en el stack de SSB) para no depender solo
de la retención de 90 días de GitHub. Requiere credenciales de Drive como secret adicional.
