import { createClient, SupabaseClient } from '@supabase/supabase-js';
-- Atualização do Schema para compatibilidade com o código VOD/Admin
-- Copie e cole este conteúdo no SQL Editor do Supabase

-- 1. Tabela MOVIES: Adicionar colunas faltantes
ALTER TABLE movies ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';

-- 2. Tabela SERIES: Adicionar colunas faltantes
ALTER TABLE series ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE series ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';
ALTER TABLE series ADD COLUMN IF NOT EXISTS seasons_count int; 

-- 3. Tabela PLANS (Novos planos de assinatura)
CREATE TABLE IF NOT EXISTS plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  features text[], -- array de strings
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Inserir planos padrão se a tabela estiver vazia
INSERT INTO plans (name, price, description, features, active)
SELECT 'Básico', 29.90, 'Para começar', ARRAY['HD', '1 Tela', 'Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans);

INSERT INTO plans (name, price, description, features, active)
SELECT 'Padrão', 49.90, 'Melhor custo-benefício', ARRAY['Full HD', '2 Telas', 'Sem Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Padrão');

INSERT INTO plans (name, price, description, features, active)
SELECT 'Premium', 69.90, 'Experiência máxima', ARRAY['4K HDR', '4 Telas', 'Áudio Espacial'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Premium');

-- 4. Tabela PAYMENT_SETTINGS (Configurações de pagamento)
CREATE TABLE IF NOT EXISTS payment_settings (
  id text DEFAULT 'default' PRIMARY KEY,
  pix_key text,
  pix_name text,
  bank_name text,
  bank_agency text,
  bank_account text,
  crypto_wallet text,
  instructions text,
  updated_at timestamptz DEFAULT now()
);

-- 5. Tabela DEVICES (Dispositivos dos usuários)
CREATE TABLE IF NOT EXISTS devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  type text,
  icon text,
  last_active timestamptz DEFAULT now(),
  is_current_session boolean DEFAULT false
);

-- 6. Tabela USER_PROFILES (Perfis de usuário - Kids, etc)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  avatar_color text,
  is_kids boolean DEFAULT false,
  pin text,
  created_at timestamptz DEFAULT now()
);

-- 7. Tabela USER_SETTINGS (Configurações gerais do usuário)
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  phone text,
  two_factor_enabled boolean DEFAULT false
);

-- 8. Tabela USER_SUBSCRIPTIONS (Assinaturas ativas)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id),
  status text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 9. Tabela APP_CONFIG (Configurações globais do app)
CREATE TABLE IF NOT EXISTS app_config (
  id text DEFAULT 'default' PRIMARY KEY,
  logo_url text,
  primary_color text,
  secondary_color text,
  background_color text
);

-- Inserir config padrão
INSERT INTO app_config (id, logo_url, primary_color, secondary_color, background_color)
SELECT 'default', 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', '#E50914', '#ffffff', '#0a0a0a'
WHERE NOT EXISTS (SELECT 1 FROM app_config);

-- 10. Políticas RLS (Segurança básica - Opcional, mas recomendado)
-- Habilitar RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Criar políticas de leitura pública
CREATE POLICY "Public plans are viewable by everyone" ON plans FOR SELECT USING (true);
CREATE POLICY "Public app_config is viewable by everyone" ON app_config FOR SELECT USING (true);
-- Payment settings apenas admin deveria ver (mas para simplificar, leitura auth)
CREATE POLICY "Authenticated can view payment settings" ON payment_settings FOR SELECT TO authenticated USING (true);-- Atualização do Schema para compatibilidade com o código VOD/Admin
-- Copie e cole este conteúdo no SQL Editor do Supabase

-- 1. Tabela MOVIES: Adicionar colunas faltantes
ALTER TABLE movies ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';

-- 2. Tabela SERIES: Adicionar colunas faltantes
ALTER TABLE series ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE series ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';
ALTER TABLE series ADD COLUMN IF NOT EXISTS seasons_count int; 

-- 3. Tabela PLANS (Novos planos de assinatura)
CREATE TABLE IF NOT EXISTS plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  features text[], -- array de strings
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Inserir planos padrão se a tabela estiver vazia
INSERT INTO plans (name, price, description, features, active)
SELECT 'Básico', 29.90, 'Para começar', ARRAY['HD', '1 Tela', 'Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans);

INSERT INTO plans (name, price, description, features, active)
SELECT 'Padrão', 49.90, 'Melhor custo-benefício', ARRAY['Full HD', '2 Telas', 'Sem Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Padrão');

INSERT INTO plans (name, price, description, features, active)
SELECT 'Premium', 69.90, 'Experiência máxima', ARRAY['4K HDR', '4 Telas', 'Áudio Espacial'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Premium');

-- 4. Tabela PAYMENT_SETTINGS (Configurações de pagamento)
CREATE TABLE IF NOT EXISTS payment_settings (
  id text DEFAULT 'default' PRIMARY KEY,
  pix_key text,
  pix_name text,
  bank_name text,
  bank_agency text,
  bank_account text,
  crypto_wallet text,
  instructions text,
  updated_at timestamptz DEFAULT now()
);

-- 5. Tabela DEVICES (Dispositivos dos usuários)
CREATE TABLE IF NOT EXISTS devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  type text,
  icon text,
  last_active timestamptz DEFAULT now(),
  is_current_session boolean DEFAULT false
);

-- 6. Tabela USER_PROFILES (Perfis de usuário - Kids, etc)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  avatar_color text,
  is_kids boolean DEFAULT false,
  pin text,
  created_at timestamptz DEFAULT now()
);

-- 7. Tabela USER_SETTINGS (Configurações gerais do usuário)
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  phone text,
  two_factor_enabled boolean DEFAULT false
);

-- 8. Tabela USER_SUBSCRIPTIONS (Assinaturas ativas)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id),
  status text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 9. Tabela APP_CONFIG (Configurações globais do app)
CREATE TABLE IF NOT EXISTS app_config (
  id text DEFAULT 'default' PRIMARY KEY,
  logo_url text,
  primary_color text,
  secondary_color text,
  background_color text
);

-- Inserir config padrão
INSERT INTO app_config (id, logo_url, primary_color, secondary_color, background_color)
SELECT 'default', 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', '#E50914', '#ffffff', '#0a0a0a'
WHERE NOT EXISTS (SELECT 1 FROM app_config);

-- 10. Políticas RLS (Segurança básica - Opcional, mas recomendado)
-- Habilitar RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Criar políticas de leitura pública
CREATE POLICY "Public plans are viewable by everyone" ON plans FOR SELECT USING (true);
CREATE POLICY "Public app_config is viewable by everyone" ON app_config FOR SELECT USING (true);
-- Payment settings apenas admin deveria ver (mas para simplificar, leitura auth)
CREATE POLICY "Authenticated can view payment settings" ON payment_settings FOR SELECT TO authenticated USING (true);-- Atualização do Schema para compatibilidade com o código VOD/Admin
-- Copie e cole este conteúdo no SQL Editor do Supabase

-- 1. Tabela MOVIES: Adicionar colunas faltantes
ALTER TABLE movies ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';

-- 2. Tabela SERIES: Adicionar colunas faltantes
ALTER TABLE series ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE series ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';
ALTER TABLE series ADD COLUMN IF NOT EXISTS seasons_count int; 

-- 3. Tabela PLANS (Novos planos de assinatura)
CREATE TABLE IF NOT EXISTS plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  features text[], -- array de strings
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Inserir planos padrão se a tabela estiver vazia
INSERT INTO plans (name, price, description, features, active)
SELECT 'Básico', 29.90, 'Para começar', ARRAY['HD', '1 Tela', 'Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans);

INSERT INTO plans (name, price, description, features, active)
SELECT 'Padrão', 49.90, 'Melhor custo-benefício', ARRAY['Full HD', '2 Telas', 'Sem Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Padrão');

INSERT INTO plans (name, price, description, features, active)
SELECT 'Premium', 69.90, 'Experiência máxima', ARRAY['4K HDR', '4 Telas', 'Áudio Espacial'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Premium');

-- 4. Tabela PAYMENT_SETTINGS (Configurações de pagamento)
CREATE TABLE IF NOT EXISTS payment_settings (
  id text DEFAULT 'default' PRIMARY KEY,
  pix_key text,
  pix_name text,
  bank_name text,
  bank_agency text,
  bank_account text,
  crypto_wallet text,
  instructions text,
  updated_at timestamptz DEFAULT now()
);

-- 5. Tabela DEVICES (Dispositivos dos usuários)
CREATE TABLE IF NOT EXISTS devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  type text,
  icon text,
  last_active timestamptz DEFAULT now(),
  is_current_session boolean DEFAULT false
);

-- 6. Tabela USER_PROFILES (Perfis de usuário - Kids, etc)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  avatar_color text,
  is_kids boolean DEFAULT false,
  pin text,
  created_at timestamptz DEFAULT now()
);

-- 7. Tabela USER_SETTINGS (Configurações gerais do usuário)
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  phone text,
  two_factor_enabled boolean DEFAULT false
);

-- 8. Tabela USER_SUBSCRIPTIONS (Assinaturas ativas)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id),
  status text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 9. Tabela APP_CONFIG (Configurações globais do app)
CREATE TABLE IF NOT EXISTS app_config (
  id text DEFAULT 'default' PRIMARY KEY,
  logo_url text,
  primary_color text,
  secondary_color text,
  background_color text
);

-- Inserir config padrão
INSERT INTO app_config (id, logo_url, primary_color, secondary_color, background_color)
SELECT 'default', 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', '#E50914', '#ffffff', '#0a0a0a'
WHERE NOT EXISTS (SELECT 1 FROM app_config);

-- 10. Políticas RLS (Segurança básica - Opcional, mas recomendado)
-- Habilitar RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Criar políticas de leitura pública
CREATE POLICY "Public plans are viewable by everyone" ON plans FOR SELECT USING (true);
CREATE POLICY "Public app_config is viewable by everyone" ON app_config FOR SELECT USING (true);
-- Payment settings apenas admin deveria ver (mas para simplificar, leitura auth)
CREATE POLICY "Authenticated can view payment settings" ON payment_settings FOR SELECT TO authenticated USING (true);-- Atualização do Schema para compatibilidade com o código VOD/Admin
-- Copie e cole este conteúdo no SQL Editor do Supabase

-- 1. Tabela MOVIES: Adicionar colunas faltantes
ALTER TABLE movies ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';

-- 2. Tabela SERIES: Adicionar colunas faltantes
ALTER TABLE series ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE series ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';
ALTER TABLE series ADD COLUMN IF NOT EXISTS seasons_count int; 

-- 3. Tabela PLANS (Novos planos de assinatura)
CREATE TABLE IF NOT EXISTS plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  features text[], -- array de strings
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Inserir planos padrão se a tabela estiver vazia
INSERT INTO plans (name, price, description, features, active)
SELECT 'Básico', 29.90, 'Para começar', ARRAY['HD', '1 Tela', 'Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans);

INSERT INTO plans (name, price, description, features, active)
SELECT 'Padrão', 49.90, 'Melhor custo-benefício', ARRAY['Full HD', '2 Telas', 'Sem Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Padrão');

INSERT INTO plans (name, price, description, features, active)
SELECT 'Premium', 69.90, 'Experiência máxima', ARRAY['4K HDR', '4 Telas', 'Áudio Espacial'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Premium');

-- 4. Tabela PAYMENT_SETTINGS (Configurações de pagamento)
CREATE TABLE IF NOT EXISTS payment_settings (
  id text DEFAULT 'default' PRIMARY KEY,
  pix_key text,
  pix_name text,
  bank_name text,
  bank_agency text,
  bank_account text,
  crypto_wallet text,
  instructions text,
  updated_at timestamptz DEFAULT now()
);

-- 5. Tabela DEVICES (Dispositivos dos usuários)
CREATE TABLE IF NOT EXISTS devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  type text,
  icon text,
  last_active timestamptz DEFAULT now(),
  is_current_session boolean DEFAULT false
);

-- 6. Tabela USER_PROFILES (Perfis de usuário - Kids, etc)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  avatar_color text,
  is_kids boolean DEFAULT false,
  pin text,
  created_at timestamptz DEFAULT now()
);

-- 7. Tabela USER_SETTINGS (Configurações gerais do usuário)
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  phone text,
  two_factor_enabled boolean DEFAULT false
);

-- 8. Tabela USER_SUBSCRIPTIONS (Assinaturas ativas)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id),
  status text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 9. Tabela APP_CONFIG (Configurações globais do app)
CREATE TABLE IF NOT EXISTS app_config (
  id text DEFAULT 'default' PRIMARY KEY,
  logo_url text,
  primary_color text,
  secondary_color text,
  background_color text
);

-- Inserir config padrão
INSERT INTO app_config (id, logo_url, primary_color, secondary_color, background_color)
SELECT 'default', 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', '#E50914', '#ffffff', '#0a0a0a'
WHERE NOT EXISTS (SELECT 1 FROM app_config);

-- 10. Políticas RLS (Segurança básica - Opcional, mas recomendado)
-- Habilitar RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Criar políticas de leitura pública
CREATE POLICY "Public plans are viewable by everyone" ON plans FOR SELECT USING (true);
CREATE POLICY "Public app_config is viewable by everyone" ON app_config FOR SELECT USING (true);
-- Payment settings apenas admin deveria ver (mas para simplificar, leitura auth)
CREATE POLICY "Authenticated can view payment settings" ON payment_settings FOR SELECT TO authenticated USING (true);-- Atualização do Schema para compatibilidade com o código VOD/Admin
-- Copie e cole este conteúdo no SQL Editor do Supabase

-- 1. Tabela MOVIES: Adicionar colunas faltantes
ALTER TABLE movies ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';

-- 2. Tabela SERIES: Adicionar colunas faltantes
ALTER TABLE series ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE series ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';
ALTER TABLE series ADD COLUMN IF NOT EXISTS seasons_count int; 

-- 3. Tabela PLANS (Novos planos de assinatura)
CREATE TABLE IF NOT EXISTS plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  features text[], -- array de strings
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Inserir planos padrão se a tabela estiver vazia
INSERT INTO plans (name, price, description, features, active)
SELECT 'Básico', 29.90, 'Para começar', ARRAY['HD', '1 Tela', 'Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans);

INSERT INTO plans (name, price, description, features, active)
SELECT 'Padrão', 49.90, 'Melhor custo-benefício', ARRAY['Full HD', '2 Telas', 'Sem Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Padrão');

INSERT INTO plans (name, price, description, features, active)
SELECT 'Premium', 69.90, 'Experiência máxima', ARRAY['4K HDR', '4 Telas', 'Áudio Espacial'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Premium');

-- 4. Tabela PAYMENT_SETTINGS (Configurações de pagamento)
CREATE TABLE IF NOT EXISTS payment_settings (
  id text DEFAULT 'default' PRIMARY KEY,
  pix_key text,
  pix_name text,
  bank_name text,
  bank_agency text,
  bank_account text,
  crypto_wallet text,
  instructions text,
  updated_at timestamptz DEFAULT now()
);

-- 5. Tabela DEVICES (Dispositivos dos usuários)
CREATE TABLE IF NOT EXISTS devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  type text,
  icon text,
  last_active timestamptz DEFAULT now(),
  is_current_session boolean DEFAULT false
);

-- 6. Tabela USER_PROFILES (Perfis de usuário - Kids, etc)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  avatar_color text,
  is_kids boolean DEFAULT false,
  pin text,
  created_at timestamptz DEFAULT now()
);

-- 7. Tabela USER_SETTINGS (Configurações gerais do usuário)
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  phone text,
  two_factor_enabled boolean DEFAULT false
);

-- 8. Tabela USER_SUBSCRIPTIONS (Assinaturas ativas)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id),
  status text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 9. Tabela APP_CONFIG (Configurações globais do app)
CREATE TABLE IF NOT EXISTS app_config (
  id text DEFAULT 'default' PRIMARY KEY,
  logo_url text,
  primary_color text,
  secondary_color text,
  background_color text
);

-- Inserir config padrão
INSERT INTO app_config (id, logo_url, primary_color, secondary_color, background_color)
SELECT 'default', 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', '#E50914', '#ffffff', '#0a0a0a'
WHERE NOT EXISTS (SELECT 1 FROM app_config);

-- 10. Políticas RLS (Segurança básica - Opcional, mas recomendado)
-- Habilitar RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Criar políticas de leitura pública
CREATE POLICY "Public plans are viewable by everyone" ON plans FOR SELECT USING (true);
CREATE POLICY "Public app_config is viewable by everyone" ON app_config FOR SELECT USING (true);
-- Payment settings apenas admin deveria ver (mas para simplificar, leitura auth)
CREATE POLICY "Authenticated can view payment settings" ON payment_settings FOR SELECT TO authenticated USING (true);-- Atualização do Schema para compatibilidade com o código VOD/Admin
-- Copie e cole este conteúdo no SQL Editor do Supabase

-- 1. Tabela MOVIES: Adicionar colunas faltantes
ALTER TABLE movies ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';

-- 2. Tabela SERIES: Adicionar colunas faltantes
ALTER TABLE series ADD COLUMN IF NOT EXISTS trailer_url text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS use_trailer boolean DEFAULT false;
ALTER TABLE series ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';
ALTER TABLE series ADD COLUMN IF NOT EXISTS seasons_count int; 

-- 3. Tabela PLANS (Novos planos de assinatura)
CREATE TABLE IF NOT EXISTS plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  features text[], -- array de strings
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Inserir planos padrão se a tabela estiver vazia
INSERT INTO plans (name, price, description, features, active)
SELECT 'Básico', 29.90, 'Para começar', ARRAY['HD', '1 Tela', 'Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans);

INSERT INTO plans (name, price, description, features, active)
SELECT 'Padrão', 49.90, 'Melhor custo-benefício', ARRAY['Full HD', '2 Telas', 'Sem Anúncios'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Padrão');

INSERT INTO plans (name, price, description, features, active)
SELECT 'Premium', 69.90, 'Experiência máxima', ARRAY['4K HDR', '4 Telas', 'Áudio Espacial'], true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Premium');

-- 4. Tabela PAYMENT_SETTINGS (Configurações de pagamento)
CREATE TABLE IF NOT EXISTS payment_settings (
  id text DEFAULT 'default' PRIMARY KEY,
  pix_key text,
  pix_name text,
  bank_name text,
  bank_agency text,
  bank_account text,
  crypto_wallet text,
  instructions text,
  updated_at timestamptz DEFAULT now()
);

-- 5. Tabela DEVICES (Dispositivos dos usuários)
CREATE TABLE IF NOT EXISTS devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  type text,
  icon text,
  last_active timestamptz DEFAULT now(),
  is_current_session boolean DEFAULT false
);

-- 6. Tabela USER_PROFILES (Perfis de usuário - Kids, etc)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  avatar_color text,
  is_kids boolean DEFAULT false,
  pin text,
  created_at timestamptz DEFAULT now()
);

-- 7. Tabela USER_SETTINGS (Configurações gerais do usuário)
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  phone text,
  two_factor_enabled boolean DEFAULT false
);

-- 8. Tabela USER_SUBSCRIPTIONS (Assinaturas ativas)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id),
  status text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 9. Tabela APP_CONFIG (Configurações globais do app)
CREATE TABLE IF NOT EXISTS app_config (
  id text DEFAULT 'default' PRIMARY KEY,
  logo_url text,
  primary_color text,
  secondary_color text,
  background_color text
);

-- Inserir config padrão
INSERT INTO app_config (id, logo_url, primary_color, secondary_color, background_color)
SELECT 'default', 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', '#E50914', '#ffffff', '#0a0a0a'
WHERE NOT EXISTS (SELECT 1 FROM app_config);

-- 10. Políticas RLS (Segurança básica - Opcional, mas recomendado)
-- Habilitar RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Criar políticas de leitura pública
CREATE POLICY "Public plans are viewable by everyone" ON plans FOR SELECT USING (true);
CREATE POLICY "Public app_config is viewable by everyone" ON app_config FOR SELECT USING (true);
-- Payment settings apenas admin deveria ver (mas para simplificar, leitura auth)
CREATE POLICY "Authenticated can view payment settings" ON payment_settings FOR SELECT TO authenticated USING (true);
/**
 * services/supabaseService.ts
 *
 * Correções:
 * - Validação explícita de variáveis de ambiente
 * - Suporte NEXT_PUBLIC_* | VITE_* | process.env
 * - Singleton globalThis para HMR
 * - Não expor service role no cliente
 * - Mensagens de erro claras
 */

/* ---------- Helpers para env ---------- */
const readEnv = (names: string[]): string | undefined => {
  // Next.js exposes public vars as NEXT_PUBLIC_*
  if (typeof process !== 'undefined' && process.env) {
    for (const n of names) {
      if (process.env[n]) return process.env[n];
    }
  }

  // Vite exposes import.meta.env
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    for (const n of names) {
      if ((import.meta as any).env[n]) return (import.meta as any).env[n];
    }
  }

  return undefined;
};

const supabaseUrl = readEnv(['NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_URL']);
const supabaseAnonKey = readEnv(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY']);

/* ---------- Validations ---------- */
if (!supabaseUrl || !supabaseAnonKey) {
  // Throw early so imports fail loudly and developer notices missing envs.
  // Prefer throwing so SSR/SSG doesn't continue with invalid client causing 500s obscurely.
  throw new Error(
    'Supabase: variáveis de ambiente ausentes. Defina NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (ou VITE_SUPABASE_*) no seu .env.\n' +
    `Encontradas: SUPABASE_URL=${Boolean(supabaseUrl)}, SUPABASE_ANON_KEY=${Boolean(supabaseAnonKey)}`
  );
}

/* ---------- Singleton (HMR-safe) ---------- */
declare global {
  // eslint-disable-next-line no-var
  var __supabase_client__: SupabaseClient | undefined;
}

const getSupabaseClient = (): SupabaseClient => {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__supabase_client__) {
    return (globalThis as any).__supabase_client__;
  }

  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    // Optional: ajustes adicionais, ex: auth: { persistSession: false } dependendo do app
  });

  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__supabase_client__ = client;
  }

  return client;
};

export const supabase = getSupabaseClient();

/* ---------- Interfaces (mantidas) ---------- */
// (Colei suas interfaces sem alteração para brevidade)
export interface Movie { id: string; tmdb_id?: number; title: string; description?: string; poster?: string; backdrop?: string; logo_url?: string; year?: number; rating?: number; genre?: string[]; stream_url?: string; trailer_url?: string; use_trailer?: boolean; platform?: string; status?: 'published' | 'draft'; created_at?: string; }
export interface Series { id: string; tmdb_id?: number; title: string; description?: string; poster?: string; backdrop?: string; logo_url?: string; year?: number; rating?: number; genre?: string[]; trailer_url?: string; use_trailer?: boolean; platform?: string; status?: 'published' | 'draft'; seasons_count?: number; created_at?: string; }
export interface Channel { id: string; nome: string; logo?: string; genero?: string; url: string; }
export interface Season { id: string; series_id: string; season_number: number; title?: string; description?: string; poster?: string; }
export interface Episode { id: string; season_id: string; episode_number: number; title: string; description?: string; duration?: string; stream_url?: string; thumbnail?: string; }
export interface UserSettings { id: string; user_id: string; email: string; name: string; phone?: string; two_factor_enabled: boolean; }
export interface Plan { id: string; name: string; price: number; description: string; features: string[]; active: boolean; }
export interface Subscription { id: string; plan_id: string; status: string; current_period_end: string; plan?: Plan; }
export interface PaymentMethod { id: string; card_brand: string; last_four: string; expiry_month: string; expiry_year: string; card_holder: string; is_default: boolean; }
export interface Device { id: string; user_id?: string; name: string; type: string; icon: string; last_active: string; is_current_session: boolean; }
export interface UserProfileDB { id: string; user_id?: string; name: string; avatar_color: string; is_kids: boolean; pin?: string; }
export interface PaymentSettings { id: string; pix_key: string; pix_name: string; bank_name?: string; bank_agency?: string; bank_account?: string; crypto_wallet?: string; instructions?: string; }
export interface AppConfig { id: string; logo_url: string; primary_color: string; secondary_color: string; background_color: string; }

/* ---------- Funções (mantidas, com pequenos ajustes de segurança/tratamento) ---------- */

export async function getAllMovies(): Promise<Movie[]> {
  const { data, error } = await supabase.from('movies').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMoviesByGenre(genre: string): Promise<Movie[]> {
  const { data, error } = await supabase.from('movies').select('*').contains('genre', [genre]).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMovieGenres(): Promise<string[]> {
  const { data, error } = await supabase.from('movies').select('genre');
  if (error) throw error;
  const genres = new Set<string>();
  data?.forEach((movie: any) => movie.genre?.forEach((g: string) => genres.add(g)));
  return Array.from(genres).sort();
}

export async function getAllSeries(): Promise<Series[]> {
  const { data, error } = await supabase.from('series').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getSeriesByGenre(genre: string): Promise<Series[]> {
  const { data, error } = await supabase.from('series').select('*').contains('genre', [genre]).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getSeriesGenres(): Promise<string[]> {
  const { data, error } = await supabase.from('series').select('genre');
  if (error) throw error;
  const genres = new Set<string>();
  data?.forEach((s: any) => s.genre?.forEach((g: string) => genres.add(g)));
  return Array.from(genres).sort();
}

export async function getAllChannels(): Promise<Channel[]> {
  const { data, error } = await supabase.from('channels').select('*').order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getChannelsByGenre(genero: string): Promise<Channel[]> {
  const { data, error } = await supabase.from('channels').select('*').eq('genero', genero).order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getMovieById(id: string): Promise<Movie | null> {
  const { data, error } = await supabase.from('movies').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSeriesById(id: string): Promise<Series | null> {
  const { data, error } = await supabase.from('series').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSeriesByTmdbId(tmdbId: number): Promise<Series | null> {
  const { data, error } = await supabase.from('series').select('*').eq('tmdb_id', tmdbId).maybeSingle();
  if (error) return null;
  return data;
}

export async function getSeasons(seriesId: string): Promise<Season[]> {
  const { data, error } = await supabase.from('seasons').select('*').eq('series_id', seriesId).order('season_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getEpisodes(seasonId: string): Promise<Episode[]> {
  const { data, error } = await supabase.from('episodes').select('*').eq('season_id', seasonId).order('episode_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase.from('user_subscriptions').select('*, plan:plans(*)').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const { data, error } = await supabase.from('payment_methods').select('*').eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

export async function getUserDevices(userId: string): Promise<Device[]> {
  const { data, error } = await supabase.from('devices').select('*').eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

export async function addDevice(device: Partial<Device>): Promise<Device | null> {
  const { data, error } = await supabase.from('devices').insert(device).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function removeDevice(deviceId: string): Promise<void> {
  const { error } = await supabase.from('devices').delete().eq('id', deviceId);
  if (error) throw error;
}

export async function getUserProfiles(userId: string): Promise<UserProfileDB[]> {
  const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

export async function addUserProfile(profile: Partial<UserProfileDB>): Promise<UserProfileDB | null> {
  const { data, error } = await supabase.from('user_profiles').insert(profile).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateMovie(id: string, updates: Partial<Movie>): Promise<Movie | null> {
  const { data, error } = await supabase.from('movies').update(updates).eq('id', id).select().maybeSingle();
  if (error) {
    console.error('Erro ao atualizar filme:', error);
    return null;
  }
  return data;
}

export async function updateSeries(id: string, updates: Partial<Series>): Promise<Series | null> {
  const { data, error } = await supabase.from('series').update(updates).eq('id', id).select().maybeSingle();
  if (error) {
    console.error('Erro ao atualizar série:', error);
    return null;
  }
  return data;
}

export async function deleteMovie(id: string): Promise<boolean> {
  const { error } = await supabase.from('movies').delete().eq('id', id);
  if (error) {
    console.error('Erro ao deletar filme:', error);
    return false;
  }
  return true;
}

export async function deleteSeries(id: string): Promise<boolean> {
  const { error } = await supabase.from('series').delete().eq('id', id);
  if (error) {
    console.error('Erro ao deletar série:', error);
    return false;
  }
  return true;
}

export async function getAppConfig(): Promise<AppConfig | null> {
  const { data, error } = await supabase.from('app_config').select('*').single();
  if (error || !data) {
    return {
      id: 'default',
      logo_url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
      primary_color: '#E50914',
      secondary_color: '#ffffff',
      background_color: '#0a0a0a'
    };
  }
  return data;
}

export async function updateAppConfig(config: Partial<AppConfig>): Promise<AppConfig | null> {
  const { data, error } = await supabase.from('app_config').upsert(config).select().single();
  if (error) {
    console.error('Erro ao atualizar configurações:', error);
    return null;
  }
  return data;
}

export async function uploadImage(file: File, bucket: 'posters' | 'backdrops' | 'logos' = 'posters'): Promise<string | null> {
  if (typeof window === 'undefined' && !(file instanceof (globalThis as any).File)) {
    throw new Error('uploadImage deve ser chamado do cliente com um objeto File (browser). Para uploads server-side use uma API route/Edge Function com SERVICE_ROLE.');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
  if (uploadError) {
    console.error(`Erro ao fazer upload para ${bucket}:`, uploadError);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function getAllPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from('plans').select('*').order('price', { ascending: true });
  if (error) {
    return [
      { id: '1', name: 'Básico', price: 29.90, description: 'Para começar', features: ['HD', '1 Tela', 'Anúncios'], active: true },
      { id: '2', name: 'Padrão', price: 49.90, description: 'Melhor custo-benefício', features: ['Full HD', '2 Telas', 'Sem Anúncios'], active: true },
      { id: '3', name: 'Premium', price: 69.90, description: 'Experiência máxima', features: ['4K HDR', '4 Telas', 'Áudio Espacial'], active: true }
    ];
  }
  return data;
}

export async function updatePlan(plan: Partial<Plan>): Promise<Plan | null> {
  const { data, error } = await supabase.from('plans').upsert(plan).select().single();
  if (error) {
    console.error('Erro ao salvar plano:', error);
    return null;
  }
  return data;
}

export async function deletePlan(id: string): Promise<boolean> {
  const { error } = await supabase.from('plans').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  const { data, error } = await supabase.from('payment_settings').select('*').single();
  if (error || !data) {
    return {
      id: 'default',
      pix_key: '',
      pix_name: '',
      instructions: 'Envie o comprovante para o suporte.'
    } as PaymentSettings;
  }
  return data;
}

export async function updatePaymentSettings(settings: Partial<PaymentSettings>): Promise<PaymentSettings | null> {
  const { data: existing, error: e } = await supabase.from('payment_settings').select('id').single();
  if (e && e.code !== 'PGRST116') { // exemplo de código caso tabela não exista
    console.error('Erro ao verificar payment_settings:', e);
  }

  let result;
  if (existing && existing.id) {
    result = await supabase.from('payment_settings').update(settings).eq('id', existing.id).select().single();
  } else {
    result = await supabase.from('payment_settings').insert(settings).select().single();
  }

  if ((result as any).error) {
    console.error('Erro ao salvar dados bancários:', (result as any).error);
    return null;
  }
  return (result as any).data || (result as any);
}

/* ---------- Default export (compatibilidade) ---------- */
export default {
  getAllMovies,
  getMoviesByGenre,
  getMovieGenres,
  getAllSeries,
  getSeriesByGenre,
  getSeriesGenres,
  getAllChannels,
  getChannelsByGenre,
  getMovieById,
  getSeriesById,
  getSeriesByTmdbId,
  getSeasons,
  getEpisodes,
  getUserSettings,
  getUserSubscription,
  getAllPlans,
  getPaymentMethods,
  getUserDevices,
  addDevice,
  removeDevice,
  getUserProfiles,
  addUserProfile,
  updateMovie,
  updateSeries,
  deleteMovie,
  deleteSeries,
  getAppConfig,
  updateAppConfig,
  uploadImage,
  updatePlan,
  deletePlan,	
  getPaymentSettings,
  updatePaymentSettings
};
