"use client";

// Módulo Ingreso — dos fases:
//  1. Tanda de retiro (alta masiva vía RPC crm_crear_tanda_retiro)
//  2. Pendientes de ingreso a planta (confirmación en lote vía crm_confirmar_ingreso_planta)

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Cargando, ErrorMsg } from "@/components/ui";
import type { Naviera, Planta } from "@/lib/types";
import { FaseRetiro } from "./fase-retiro";
import { FasePendientes } from "./fase-pendientes";

export default function IngresoPage() {
  const [navieras, setNavieras] = useState<Naviera[]>([]);
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const cargarCatalogos = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [nav, pla] = await Promise.all([
      supabase.from("navieras").select("id, nombre").order("nombre"),
      supabase.from("plantas").select("id, nombre, codigo").order("nombre"),
    ]);
    if (nav.error || pla.error) {
      setError(nav.error?.message ?? pla.error?.message ?? "error cargando catálogos");
    } else {
      setNavieras((nav.data ?? []) as Naviera[]);
      setPlantas((pla.data ?? []) as Planta[]);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  if (cargando) return <Cargando msg="cargando catálogos…" />;
  if (error) return <ErrorMsg msg={error} onRetry={() => void cargarCatalogos()} />;

  return (
    <>
      <FaseRetiro
        navieras={navieras}
        plantas={plantas}
        onCreada={() => setRefreshTick((t) => t + 1)}
      />
      <FasePendientes refreshTick={refreshTick} />
    </>
  );
}
