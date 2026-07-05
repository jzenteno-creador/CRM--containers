-- generado desde cctuowthpnstvdgjuomq el 2026-07-05, read-only export
-- Triggers del schema detention

CREATE TRIGGER trg_contenedores_upd BEFORE UPDATE ON detention.contenedores FOR EACH ROW EXECUTE FUNCTION detention.crm_set_updated_at();

CREATE TRIGGER trg_freetime_upd BEFORE UPDATE ON detention.freetime_origin FOR EACH ROW EXECUTE FUNCTION detention.crm_set_updated_at();

CREATE TRIGGER trg_incidencias_upd BEFORE UPDATE ON detention.incidencias FOR EACH ROW EXECUTE FUNCTION detention.crm_set_updated_at();

CREATE TRIGGER trg_mov_confirmado AFTER INSERT OR UPDATE ON detention.movimientos_planta FOR EACH ROW EXECUTE FUNCTION detention.crm_confirmar_movimiento();

CREATE TRIGGER trg_movimientos_upd BEFORE UPDATE ON detention.movimientos_planta FOR EACH ROW EXECUTE FUNCTION detention.crm_set_updated_at();

CREATE TRIGGER trg_navieras_upd BEFORE UPDATE ON detention.navieras FOR EACH ROW EXECUTE FUNCTION detention.crm_set_updated_at();

CREATE TRIGGER trg_operaciones_upd BEFORE UPDATE ON detention.operaciones FOR EACH ROW EXECUTE FUNCTION detention.crm_set_updated_at();

CREATE TRIGGER trg_plantas_upd BEFORE UPDATE ON detention.plantas FOR EACH ROW EXECUTE FUNCTION detention.crm_set_updated_at();

CREATE TRIGGER trg_usuarios_upd BEFORE UPDATE ON detention.usuarios FOR EACH ROW EXECUTE FUNCTION detention.crm_set_updated_at();
