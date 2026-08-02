# ERD — schema `crm` (generado desde prod, 2026-08-02)

Fuente: `information_schema` del proyecto `cctuowthpnstvdgjuomq` (50 FKs). Las
**vistas del motor** (`vista_alertas`, `vista_kpi_costos_cerradas` y espejos impo,
`vista_bookings_saldo`, `vista_carga_actual`, `vista_stock_prefijos_restringidos`,
KPIs) no aparecen: son derivadas — la regla de fuente única vive en AGENTS.md.

```mermaid
erDiagram
    %% ═══ NÚCLEO EXPO (money path) ═══
    contenedores ||--o{ operaciones : "contenedor_id"
    navieras ||--o{ contenedores : "naviera_id"
    operaciones ||--o{ movimientos_planta : "operacion_id"
    operaciones ||--o{ operacion_eventos : "auditoría"
    operaciones ||--o{ operacion_waivers : "perdones"
    operaciones ||--o{ consolidaciones : "carga"
    operaciones ||--o{ incidencias : "operacion_id"
    productos ||--o{ consolidaciones : "producto_id"
    incidencias ||--o{ incidencia_fotos : "fotos"
    depositos ||--o{ operaciones : "retiro_de_id"
    plantas ||--o{ operaciones : "planta_actual_id"
    plantas ||--o{ movimientos_planta : "origen/destino"
    bookings ||--o{ operaciones : "retiro/asignado"
    navieras ||--o{ bookings : "naviera_id"

    %% ═══ ESPEJO IMPO ═══
    ordenes_impo ||--o{ operaciones_impo : "orden_id"
    contenedores ||--o{ operaciones_impo : "contenedor_id"
    navieras ||--o{ ordenes_impo : "naviera_id"
    plantas ||--o{ ordenes_impo : "planta_destino_id"
    operaciones_impo ||--o{ operacion_impo_eventos : "auditoría"
    operaciones_impo ||--o{ operacion_impo_waivers : "perdones"
    operaciones_impo ||--o{ incidencias : "operacion_impo_id"

    %% ═══ TARIFARIO (versionado por vigencia) ═══
    navieras ||--o{ freetime_origin : "tarifa expo"
    navieras ||--o{ freetime_destino : "tarifa impo"
    paises ||--o{ freetime_origin : "pais_id"
    paises ||--o{ freetime_destino : "pais_id"
    paises ||--o{ plantas : "pais_id"

    %% ═══ IDENTIDAD Y SOPORTE ═══
    usuarios ||--o{ usuarios : "aprobado_por"
    plantas ||--o{ usuarios : "planta_asignada (solo operadores)"
    usuarios ||--o{ push_suscripciones : "dispositivos"
    usuarios ||--o{ operacion_eventos : "quién"
    usuarios ||--o{ operacion_waivers : "registró/anuló"
    usuarios ||--o{ incidencias : "usuario_id"

    operaciones {
        uuid contenedor_id FK
        date fecha_retiro
        text estado "en_transito|en_planta|cerrado|anulada"
        uuid retiro_de_id FK
        uuid booking_retiro_id FK
        uuid booking_asignado_id FK
    }
    operaciones_impo {
        uuid orden_id FK
        uuid contenedor_id FK
        text estado "en_terminal→…→cerrada"
    }
    contenedores {
        text numero_contenedor "ISO 6346"
        text tipo "20DC|40DC|40HC (CHECK fijo)"
        bool reforzado
    }
    freetime_origin {
        uuid naviera_id FK
        uuid pais_id FK
        int dias_libres
        numeric tarifa_usd_dia
        date vigente_desde "versionado: vigente única x naviera+pais"
    }
    usuarios {
        uuid auth_user_id "matchea perfil()"
        text rol "operador|supervisor|administrador"
        text estado_cuenta "aprobación manual"
    }
```

## Lectura rápida

- **Dos ciclos espejo**: expo (`operaciones`, retiro→planta→devolución) e impo
  (`ordenes_impo`→`operaciones_impo`, terminal→planta→devolución). Comparten
  `contenedores`, `navieras`, `plantas`, `incidencias`.
- **La plata no vive en tablas de saldo**: se deriva SIEMPRE en las vistas del
  motor desde fechas + tarifario versionado. Waivers restan como NETO.
- **Escritura**: todo el money path es RPC-only (SECURITY DEFINER
  owner=`crm_rpc_executor`/postgres) — ver la lista sancionada en AGENTS.md.
- **Auditoría**: `operacion_eventos`/`operacion_impo_eventos` registran cada
  acción con usuario; los 20 FKs a `usuarios` son el rastro de "quién".
