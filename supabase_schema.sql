-- ============================================
-- SCHEMA COMPLETO PARA REDX SPATIAL STREAMING
-- ============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: movies
-- ============================================
CREATE TABLE IF NOT EXISTS public.movies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tmdb_id INTEGER UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    rating TEXT,
    year INTEGER,
    duration TEXT,
    genre TEXT[] DEFAULT '{}',
    backdrop TEXT,
    poster TEXT,
    logo_url TEXT,
    stars TEXT[] DEFAULT '{}',
    trailer_key TEXT,
    stream_url TEXT,
    status TEXT DEFAULT 'published',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: series
-- ============================================
CREATE TABLE IF NOT EXISTS public.series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tmdb_id INTEGER UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    rating TEXT,
    year INTEGER,
    seasons INTEGER,
    genre TEXT[] DEFAULT '{}',
    backdrop TEXT,
    poster TEXT,
    logo_url TEXT,
    stars TEXT[] DEFAULT '{}',
    trailer_key TEXT,
    stream_url TEXT,
    status TEXT DEFAULT 'published',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: channels (TV ao vivo)
-- ============================================
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    logo TEXT,
    stream_url TEXT NOT NULL,
    category TEXT,
    number INTEGER,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: plans (Planos de assinatura)
-- ============================================
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    billing_period TEXT NOT NULL, -- 'monthly', 'yearly'
    features TEXT[] DEFAULT '{}',
    max_devices INTEGER DEFAULT 1,
    max_profiles INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: user_subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired', 'suspended'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- TABELA: user_settings
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT DEFAULT 'pt-BR',
    subtitle_language TEXT DEFAULT 'pt-BR',
    auto_play BOOLEAN DEFAULT TRUE,
    quality TEXT DEFAULT 'auto', -- 'auto', '720p', '1080p', '4k'
    notifications_enabled BOOLEAN DEFAULT TRUE,
    parental_control BOOLEAN DEFAULT FALSE,
    parental_pin TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- TABELA: user_profiles
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    is_kids BOOLEAN DEFAULT FALSE,
    is_main BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: user_devices
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_type TEXT, -- 'mobile', 'tablet', 'desktop', 'tv', 'stb'
    device_id TEXT NOT NULL,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

-- ============================================
-- TABELA: payment_methods
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'credit_card', 'debit_card', 'pix', 'boleto'
    card_brand TEXT,
    last_four TEXT,
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: uploads (Conteúdo enviado por usuários)
-- ============================================
CREATE TABLE IF NOT EXISTS public.uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    thumbnail_url TEXT,
    duration INTEGER, -- em segundos
    status TEXT DEFAULT 'processing', -- 'processing', 'ready', 'failed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: watchlist (Lista de favoritos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, -- 'movie', 'series'
    content_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, profile_id, content_type, content_id)
);

-- ============================================
-- TABELA: watch_history (Histórico de visualização)
-- ============================================
CREATE TABLE IF NOT EXISTS public.watch_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, -- 'movie', 'series', 'channel'
    content_id UUID NOT NULL,
    progress INTEGER DEFAULT 0, -- em segundos
    total_duration INTEGER, -- em segundos
    last_watched TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

-- Policies para movies (público pode ler, apenas autenticados)
CREATE POLICY "Movies são visíveis para usuários autenticados"
    ON public.movies FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admins podem inserir movies"
    ON public.movies FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins podem atualizar movies"
    ON public.movies FOR UPDATE
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins podem deletar movies"
    ON public.movies FOR DELETE
    USING (auth.jwt() ->> 'role' = 'admin');

-- Policies para series (mesmo padrão de movies)
CREATE POLICY "Series são visíveis para usuários autenticados"
    ON public.series FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admins podem inserir series"
    ON public.series FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins podem atualizar series"
    ON public.series FOR UPDATE
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins podem deletar series"
    ON public.series FOR DELETE
    USING (auth.jwt() ->> 'role' = 'admin');

-- Policies para channels
CREATE POLICY "Channels são visíveis para usuários autenticados"
    ON public.channels FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admins podem gerenciar channels"
    ON public.channels FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- Policies para plans (todos podem ver)
CREATE POLICY "Plans são visíveis para todos"
    ON public.plans FOR SELECT
    USING (true);

CREATE POLICY "Admins podem gerenciar plans"
    ON public.plans FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- Policies para user_subscriptions (usuários veem apenas suas próprias)
CREATE POLICY "Usuários podem ver suas próprias subscriptions"
    ON public.user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias subscriptions"
    ON public.user_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias subscriptions"
    ON public.user_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

-- Policies para user_settings
CREATE POLICY "Usuários podem ver seus próprios settings"
    ON public.user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios settings"
    ON public.user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios settings"
    ON public.user_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- Policies para user_profiles
CREATE POLICY "Usuários podem ver seus próprios profiles"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios profiles"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios profiles"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios profiles"
    ON public.user_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- Policies para user_devices
CREATE POLICY "Usuários podem ver seus próprios devices"
    ON public.user_devices FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem gerenciar seus próprios devices"
    ON public.user_devices FOR ALL
    USING (auth.uid() = user_id);

-- Policies para payment_methods
CREATE POLICY "Usuários podem ver seus próprios payment methods"
    ON public.payment_methods FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem gerenciar seus próprios payment methods"
    ON public.payment_methods FOR ALL
    USING (auth.uid() = user_id);

-- Policies para uploads
CREATE POLICY "Usuários podem ver todos os uploads"
    ON public.uploads FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem criar seus próprios uploads"
    ON public.uploads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios uploads"
    ON public.uploads FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios uploads"
    ON public.uploads FOR DELETE
    USING (auth.uid() = user_id);

-- Policies para watchlist
CREATE POLICY "Usuários podem ver sua própria watchlist"
    ON public.watchlist FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem gerenciar sua própria watchlist"
    ON public.watchlist FOR ALL
    USING (auth.uid() = user_id);

-- Policies para watch_history
CREATE POLICY "Usuários podem ver seu próprio histórico"
    ON public.watch_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem gerenciar seu próprio histórico"
    ON public.watch_history FOR ALL
    USING (auth.uid() = user_id);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON public.movies(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_genre ON public.movies USING GIN(genre);
CREATE INDEX IF NOT EXISTS idx_series_tmdb_id ON public.series(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_series_genre ON public.series USING GIN(genre);
CREATE INDEX IF NOT EXISTS idx_channels_category ON public.channels(category);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON public.watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_content ON public.watch_history(content_type, content_id);

-- ============================================
-- FUNÇÕES E TRIGGERS
-- ============================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_movies_updated_at BEFORE UPDATE ON public.movies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_series_updated_at BEFORE UPDATE ON public.series
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_devices_updated_at BEFORE UPDATE ON public.user_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_uploads_updated_at BEFORE UPDATE ON public.uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watch_history_updated_at BEFORE UPDATE ON public.watch_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: devices (Dispositivos do usuário — usada pelo código)
-- ============================================
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    type TEXT,
    icon TEXT,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    is_current_session BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TABELA: app_config (Configurações gerais do app)
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    logo_url TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    background_color TEXT
);

-- ============================================
-- TABELA: user_library (Biblioteca do usuário — favoritos/lista)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_library (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    list_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

-- ============================================
-- TABELA: watch_progress (Progresso de visualização)
-- ============================================
CREATE TABLE IF NOT EXISTS public.watch_progress (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    season_number INTEGER,
    episode_number INTEGER,
    progress_seconds INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

-- ============================================
-- TABELA: payment_settings (Config de pagamento)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    pix_key TEXT,
    pix_name TEXT,
    bank_name TEXT,
    bank_agency TEXT,
    bank_account TEXT,
    crypto_wallet TEXT,
    instructions TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: media_image_updates (Log de atualizações de imagem)
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_image_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID,
    media_type TEXT,
    tmdb_id INTEGER,
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS para tabelas adicionais
-- ============================================

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_image_updates ENABLE ROW LEVEL SECURITY;

-- devices
CREATE POLICY "Usuários podem ver seus próprios devices"
    ON public.devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem inserir seus próprios devices"
    ON public.devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem atualizar seus próprios devices"
    ON public.devices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem deletar seus próprios devices"
    ON public.devices FOR DELETE USING (auth.uid() = user_id);

-- app_config
CREATE POLICY "App config visível para autenticados"
    ON public.app_config FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins podem gerenciar app_config"
    ON public.app_config FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- user_library
CREATE POLICY "Usuários podem ver sua própria library"
    ON public.user_library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar sua própria library"
    ON public.user_library FOR ALL USING (auth.uid() = user_id);

-- watch_progress
CREATE POLICY "Usuários podem ver seu próprio progresso"
    ON public.watch_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar seu próprio progresso"
    ON public.watch_progress FOR ALL USING (auth.uid() = user_id);

-- payment_settings
CREATE POLICY "Payment settings visível para autenticados"
    ON public.payment_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins podem gerenciar payment_settings"
    ON public.payment_settings FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- media_image_updates
CREATE POLICY "Autenticados podem inserir media_image_updates"
    ON public.media_image_updates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Autenticados podem ver media_image_updates"
    ON public.media_image_updates FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- ÍNDICES para tabelas adicionais
-- ============================================
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_user_id ON public.user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_user_id ON public.watch_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_media_image_updates_tmdb_id ON public.media_image_updates(tmdb_id);

-- ============================================
-- DADOS INICIAIS (Planos de exemplo)
-- ============================================

INSERT INTO public.plans (name, description, price, billing_period, features, max_devices, max_profiles) VALUES
('Básico', 'Plano básico com acesso a conteúdo em HD', 19.90, 'monthly', ARRAY['HD (720p)', '1 dispositivo', '1 perfil'], 1, 1),
('Padrão', 'Plano padrão com Full HD em 2 dispositivos', 29.90, 'monthly', ARRAY['Full HD (1080p)', '2 dispositivos', '3 perfis'], 2, 3),
('Premium', 'Plano premium com 4K e conteúdo exclusivo', 49.90, 'monthly', ARRAY['4K Ultra HD', '4 dispositivos', '5 perfis', 'Conteúdo exclusivo'], 4, 5)
ON CONFLICT DO NOTHING;

-- ============================================
-- STORAGE BUCKET PARA UPLOADS
-- ============================================

-- Este comando deve ser executado via Dashboard ou API do Supabase Storage:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);

-- Após criar o bucket, configure as policies:
-- CREATE POLICY "Usuários podem upload de vídeos"
--     ON storage.objects FOR INSERT
--     WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Usuários podem ver seus próprios vídeos"
--     ON storage.objects FOR SELECT
--     USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- INSTRUÇÕES DE USO
-- ============================================

-- 1. Copie todo este SQL
-- 2. Acesse o Supabase Dashboard > SQL Editor
-- 3. Cole o SQL e execute (Run)
-- 4. Verifique se todas as tabelas foram criadas em Database > Tables
-- 5. Para criar o bucket de storage:
--    - Vá em Storage > Create bucket
--    - Nome: "videos"
--    - Public: false
-- 6. Configure as políticas de storage conforme comentários acima

-- Agora o banco está pronto para uso!
