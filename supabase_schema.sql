-- ============================================================
-- Stay Beautiful — Schema Supabase (Atualizado)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELA: services (Serviços Avulsos)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: combos (Pacotes de 4 sessões)
-- ============================================================
CREATE TABLE IF NOT EXISTS combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  service_id_1 UUID REFERENCES services(id) ON DELETE RESTRICT,
  service_id_2 UUID REFERENCES services(id) ON DELETE RESTRICT,
  service_id_3 UUID REFERENCES services(id) ON DELETE RESTRICT,
  service_id_4 UUID REFERENCES services(id) ON DELETE RESTRICT,
  price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MIGRAÇÃO: rodar apenas se a tabela `combos` já existir em produção
-- sem as colunas service_id_3 / service_id_4 (banco criado antes de
-- 2026-08-25). Copie e execute este bloco no SQL Editor do Supabase.
-- Faz backfill alternando os serviços 1/2 já cadastrados para preencher
-- as novas sessões 3/4, preservando os combos existentes.
-- ============================================================
-- ALTER TABLE combos ADD COLUMN IF NOT EXISTS service_id_3 UUID REFERENCES services(id) ON DELETE RESTRICT;
-- ALTER TABLE combos ADD COLUMN IF NOT EXISTS service_id_4 UUID REFERENCES services(id) ON DELETE RESTRICT;
-- UPDATE combos SET service_id_3 = service_id_1 WHERE service_id_3 IS NULL;
-- UPDATE combos SET service_id_4 = service_id_2 WHERE service_id_4 IS NULL;
-- ALTER TABLE combos ALTER COLUMN service_id_3 SET NOT NULL;
-- ALTER TABLE combos ALTER COLUMN service_id_4 SET NOT NULL;

-- ============================================================
-- TABELA: appointments
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  cancel_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  notes TEXT,
  price NUMERIC(10,2),
  avisado_whatsapp BOOLEAN DEFAULT FALSE,
  combo_group_id UUID,
  combo_session_index INTEGER,
  combo_name TEXT,
  google_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_cancel_token ON appointments(cancel_token);
CREATE INDEX IF NOT EXISTS idx_appointments_combo_group ON appointments(combo_group_id);

-- ============================================================
-- TABELA: blocked_slots
-- ============================================================
CREATE TABLE IF NOT EXISTS blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_slots_date ON blocked_slots(blocked_date);

-- ============================================================
-- TABELA: settings
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações padrão
INSERT INTO settings (key, value) VALUES
  ('working_hours', '{
    "monday":    {"open": "14:00", "close": "20:00", "enabled": true},
    "tuesday":   {"open": "14:00", "close": "20:00", "enabled": true},
    "wednesday": {"open": "14:00", "close": "20:00", "enabled": true},
    "thursday":  {"open": "14:00", "close": "20:00", "enabled": true},
    "friday":    {"open": "14:00", "close": "20:00", "enabled": true},
    "saturday":  {"open": "08:00", "close": "18:00", "enabled": true},
    "sunday":    {"open": "08:00", "close": "18:00", "enabled": false}
  }')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS services_read_public ON services;
DROP POLICY IF EXISTS services_write_admin ON services;
CREATE POLICY services_read_public ON services FOR SELECT USING (true);
CREATE POLICY services_write_admin ON services FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS combos_read_public ON combos;
DROP POLICY IF EXISTS combos_write_admin ON combos;
CREATE POLICY combos_read_public ON combos FOR SELECT USING (true);
CREATE POLICY combos_write_admin ON combos FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appointments_insert_public ON appointments;
DROP POLICY IF EXISTS appointments_read_public ON appointments;
DROP POLICY IF EXISTS appointments_update_public ON appointments;
CREATE POLICY appointments_insert_public ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY appointments_read_public ON appointments FOR SELECT USING (true);
CREATE POLICY appointments_update_public ON appointments FOR UPDATE USING (true);

ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blocked_read_public ON blocked_slots;
DROP POLICY IF EXISTS blocked_write_admin ON blocked_slots;
CREATE POLICY blocked_read_public ON blocked_slots FOR SELECT USING (true);
CREATE POLICY blocked_write_admin ON blocked_slots FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_read_public ON settings;
DROP POLICY IF EXISTS settings_write_admin ON settings;
CREATE POLICY settings_read_public ON settings FOR SELECT USING (true);
CREATE POLICY settings_write_admin ON settings FOR ALL USING (auth.role() = 'authenticated');
