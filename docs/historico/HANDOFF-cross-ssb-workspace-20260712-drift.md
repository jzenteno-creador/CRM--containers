# Cross-workstream · hallazgo de infraestructura para la sesión ssb-workspace

**Fecha:** 2026-07-12 · **Sesión origen:** Crm-containers (M4 Bloque 1) · **Severidad:** ALTA (bloquea branching del proyecto compartido para siempre hasta repararse)

## Hallazgo

El historial de migraciones del proyecto Supabase compartido `cctuowthpnstvdgjuomq` **no es reproducible desde cero**. Al crear un branch de Supabase (feature Pro recién habilitada), el replay muere en la PRIMERA migración del historial:

```
migración: 002_multi_source_support   (2026-05-04 — workstream ssb-export-dashboard)
statement: alter table public.inbound_events drop constraint inbound_events_payload_hash_key
ERROR: relation "public.inbound_events" does not exist
```

Diagnóstico: `public.inbound_events` se creó o modificó **fuera del flujo de migraciones** (SQL Editor u otro canal), por lo que la migración registrada asume un estado que un clon limpio no tiene. Consecuencia: **ningún branch de este proyecto puede crearse** — el branch nace, falla el replay (`MIGRATIONS_FAILED`) y muere. Evidencia: branch `gate-019-noregresion` (id `b6814ef8-…`, borrado), logs de postgres del branch, `list_migrations` del branch = `[]`.

## Qué NO se hizo desde esta sesión

Nada sobre `public.*` ni sobre el historial de migraciones: regla §21 (public = territorio ssb-workspace, intocable desde acá). Cero cambios en prod (verificado dos veces post-intento).

## Reparación sugerida (a ejecutar DESDE la sesión ssb-workspace, con criterio propio)

Hacer idempotente la migración registrada (o normalizar el historial): que `002_multi_source_support` tolere la ausencia de la tabla (`drop constraint if exists` / guard de existencia), o recrear el historial para que el replay desde cero funcione. Mientras tanto, cualquier workstream que necesite un sandbox del proyecto debe usar un **proyecto temporal** aplicando sus propias migraciones desde archivos (es lo que hizo la sesión CRM para el gate de la 019).

## Contexto que suma

Este hallazgo refuerza la opción (a) de la decisión de infraestructura pendiente de John (sesión 13): separar los dos workstreams en proyectos Supabase distintos. El proyecto compartido ya tenía el problema de la anon key única + defaults de `public`; ahora además tiene branching roto por drift.
