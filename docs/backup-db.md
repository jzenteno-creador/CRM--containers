# Backup & restore — schemas `crm` (prod) y `detention` (legacy)

Cubre el finding **D-02** (sin estrategia de backup para la única copia de todo) en el
contexto del plan **free** de Supabase (sin PITR, sin backups descargables, auto-pausa a los
7 días de inactividad).

## Cómo funciona

`.github/workflows/backup-db.yml` corre todos los días 03:00 AR y también a mano
(pestaña **Actions → Backup DB CRM → Run workflow**). Hace `pg_dump` de los schemas
`crm` y `detention` completos (datos + DDL) en dos formatos y los sube como **artifact**
del run, con retención de 90 días:

- `crm-db-<stamp>.dump` — formato custom comprimido, para restore selectivo con `pg_restore`.
- `crm-db-<stamp>.sql` — plain SQL legible, para diff/inspección.

El job **falla** si el `.sql` no contiene ninguna `CREATE TABLE crm.` — un backup vacío que
reporta verde es peor que no tener backup.

Como beneficio colateral, el run diario mantiene el proyecto "activo" y evita el auto-pausado
del free tier.

> **2026-07-31 — por qué existe este párrafo.** Hasta hoy el workflow dumpeaba **solo**
> `detention`, el schema del prototipo v1. Los datos vivos del v2 (2.959 operaciones
> cargadas en M6) están en `crm`, en el mismo proyecto `cctuowthpnstvdgjuomq`, y **no
> tenían ninguna copia**. `detention` se sigue respaldando hasta que el v1 se dé de baja
> también en la DB (hoy solo se dio de baja el código).

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
pg_restore --no-owner --no-privileges --dbname="$TARGET_DB_URL" crm-db-<stamp>.dump

# opción B: desde el .sql plain
psql "$TARGET_DB_URL" -f crm-db-<stamp>.sql
```

**El restore NO deja la base lista para producción por sí solo.** El dump corre con
`--no-privileges`, así que no trae los `GRANT`/`REVOKE` — y en el v2 el modelo de seguridad
entero descansa en grants exactos por rol (ver `crm-v2/AGENTS.md`). Después de restaurar hay
que reaplicar los grants desde `crm-v2/supabase/migrations/`, y **verificar en el ensayo si
las policies RLS vinieron en el dump o hay que reaplicarlas también** — no está confirmado.

**ENSAYADO 2026-08-01** (run 30674909035 de `restore-drill.yml`): backup del 31/07
restaurado en un Postgres 17 virgen en **<1s** — 2.959 operaciones intactas, 1.331 con
costo calculado por el motor tras el restore. El ensayo es reproducible: Actions →
**Restore Drill** → Run workflow (correrlo tras cada cambio grande de schema y mínimo
1 vez por trimestre). Matices que el drill codifica: los ROLES son objetos de cluster y
no viajan en el dump (crearlos antes), los GRANTS no viajan (`--no-privileges` —
reaplicar desde migrations), `auth.uid()` necesita stub fuera de Supabase, y los índices
trigram requieren `pg_trgm` previa.

## Mejora futura (no implementada)

Subir el artifact también a Google Drive (ya está en el stack de SSB) para no depender solo
de la retención de 90 días de GitHub. Requiere credenciales de Drive como secret adicional.
