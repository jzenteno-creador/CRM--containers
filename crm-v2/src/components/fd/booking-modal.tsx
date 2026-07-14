"use client";

// NuevoBookingModal (design system — M5 B3): alta inline de un booking desde
// cualquier ComboboxCreatable de bookings (Ingreso, Egreso, /bookings → Reasignar).
// Mismo patrón que NuevoDepositoModal (ingreso/tanda-form.tsx): el combobox NO crea
// nada por sí mismo, solo notifica `onCreate(texto)`; este modal hace la llamada real
// a `crm_crear_booking` y devuelve el id nuevo para que el consumidor lo autoseleccione.
//
// - ETD es OBLIGATORIO (columna `date` de crm.bookings) — se manda como 'YYYY-MM-DD'
//   plano, NUNCA timestamptz (fecha_corte también es `date`).
// - Naviera: si `navieraId` viene fijo (Ingreso: ya elegida en el encabezado de la
//   tanda) se oculta el selector y se usa esa; si no viene (Egreso, Reasignar en
//   /bookings — el booking nuevo puede ser de cualquier naviera) se muestra un
//   ComboboxCreatable de navieras, porque `crm_crear_booking` exige `p_naviera_id`.
// - Error de la RPC: se prioriza `error.hint` — la propia RPC lo arma con el detalle
//   legible ("Ya existe el booking X para esta naviera…") — sobre `error.message`
//   (que en `booking_duplicado` es solo el código, sin contexto). Sigue siendo texto
//   QUE DA LA RPC, nunca copy inventado en el cliente.

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Button } from "./button";
import { ComboboxCreatable } from "./combobox-creatable";
import { DateField, Field, Input } from "./fields";
import { FormAlert } from "./form-alert";
import { Modal } from "./modal";

export type NavieraOption = { id: string; nombre: string };

export function NuevoBookingModal({
  texto,
  tipo,
  navieraId,
  navieras,
  onClose,
  onCreado,
}: {
  /** Texto tipeado en el combobox de origen — precarga el número, editable. */
  texto: string;
  tipo: "retiro" | "embarque";
  /** Naviera FIJA (Ingreso: ya elegida en el encabezado) — si viene, oculta el selector. */
  navieraId?: string;
  /** Opciones para elegir naviera cuando `navieraId` no viene. */
  navieras?: NavieraOption[];
  onClose: () => void;
  onCreado: (id: string) => void;
}) {
  const [numero, setNumero] = useState(texto);
  const [navieraSel, setNavieraSel] = useState("");
  const [etd, setEtd] = useState("");
  const [fechaCorte, setFechaCorte] = useState("");
  const [buque, setBuque] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const navieraResuelta = navieraId ?? navieraSel;

  const errors = {
    numero: numero.trim() === "" ? "el número de booking es obligatorio" : null,
    naviera: navieraResuelta === "" ? "elegí la naviera" : null,
    etd: etd === "" ? "el ETD es obligatorio" : null,
  };
  const valid = Object.values(errors).every((e) => e === null);

  const crear = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    const { data, error } = await getSupabase().rpc("crm_crear_booking", {
      p_numero: numero.trim(),
      p_naviera_id: navieraResuelta,
      // date plano 'YYYY-MM-DD' (columnas `date` de crm.bookings) — nunca timestamptz
      p_etd: etd,
      p_tipo: tipo,
      p_fecha_corte: fechaCorte || null,
      p_buque: buque.trim() || null,
    });
    setSending(false);
    if (error) {
      setSubmitError(error.hint || error.message);
      return;
    }
    onCreado(data as string);
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title={`Crear booking «${texto}»`}
      width={460}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="número de booking" htmlFor="nb-numero" error={attempted ? errors.numero : null}>
          <Input
            id="nb-numero"
            value={numero}
            error={attempted ? errors.numero : null}
            onChange={(e) => setNumero(e.target.value)}
          />
        </Field>

        {!navieraId && (
          <Field label="naviera" htmlFor="nb-naviera" error={attempted ? errors.naviera : null}>
            <ComboboxCreatable
              id="nb-naviera"
              options={(navieras ?? []).map((n) => ({ id: n.id, label: n.nombre }))}
              value={navieraSel}
              onChange={setNavieraSel}
              error={attempted ? errors.naviera : null}
              placeholder="— elegí la naviera —"
            />
          </Field>
        )}

        <Field
          label="ETD"
          htmlFor="nb-etd"
          error={attempted ? errors.etd : null}
          hint="obligatorio — fecha de zarpe del buque"
        >
          <DateField id="nb-etd" value={etd} error={attempted ? errors.etd : null} onChange={(e) => setEtd(e.target.value)} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="fecha de corte" htmlFor="nb-corte" hint="opcional">
            <DateField id="nb-corte" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} />
          </Field>
          <Field label="buque" htmlFor="nb-buque" hint="opcional">
            <Input id="nb-buque" value={buque} onChange={(e) => setBuque(e.target.value)} />
          </Field>
        </div>

        {submitError && <FormAlert>{submitError}</FormAlert>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="primary" icon="ti-plus" loading={sending} disabled={!valid} onClick={() => void crear()}>
            Crear booking
          </Button>
        </div>
      </div>
    </Modal>
  );
}
