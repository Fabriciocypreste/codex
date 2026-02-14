-- Migration for Settings Features
-- Created: 2024-02-11

-- 1. Tabela de Configurações do Usuário (Visão Geral e Segurança)
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    phone TEXT,
    two_factor_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Assinaturas (Plans)
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY, -- 'basic', 'standard', 'premium'
    name TEXT NOT NULL,
    price TEXT NOT NULL,
    quality TEXT NOT NULL,
    screens TEXT NOT NULL,
    device_limit INTEGER NOT NULL,
    features TEXT[]
);

-- Insert default plans
INSERT INTO public.plans (id, name, price, quality, screens, device_limit, features)
VALUES 
('basic', 'Basic', 'R$ 25,90', 'HD (720p)', '1 tela', 1, ARRAY['Downloads limitados', 'Com anúncios leves', 'Som Estéreo']),
('standard', 'Standard', 'R$ 44,90', 'Full HD (1080p)', '2 telas', 2, ARRAY['Downloads ilimitados', 'Sem anúncios', 'Som Surround 5.1']),
('premium', 'Premium Spatial', 'R$ 59,90', 'Spatial 4K + Vision', '4 telas', 3, ARRAY['4 telas simultâneas', 'Downloads ilimitados', 'Sem anúncios', 'Spatial Audio Experience'])
ON CONFLICT (id) DO NOTHING;

-- Tabela de Assinatura do Usuário
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT REFERENCES public.plans(id),
    status TEXT DEFAULT 'active', -- 'active', 'canceled', 'past_due'
    current_period_end TIMESTAMPTZ,
    payment_method_id UUID, -- Link to payment_methods table
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Métodos de Pagamento
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    card_brand TEXT, -- 'visa', 'mastercard', etc
    last_four TEXT,
    expiry_month TEXT,
    expiry_year TEXT,
    card_holder TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Dispositivos (Aparelhos)
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Spatial Computer', 'Mobile', 'TV', etc
    icon TEXT, -- SVG path or icon name
    last_active TIMESTAMPTZ DEFAULT now(),
    is_current_session BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Perfis (Profiles)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_color TEXT, -- bg-blue-600, etc
    is_kids BOOLEAN DEFAULT false,
    pin TEXT, -- Para controle parental
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
