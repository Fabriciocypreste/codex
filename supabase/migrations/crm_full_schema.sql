
-- Migration for CRM Features (Full)
-- Includes Transactions, Plans, and Updates

-- 1. Planos de Assinatura
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- 'Básico', 'Premium', 'Família'
    price NUMERIC(10,2) NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 30,
    device_limit INTEGER NOT NULL DEFAULT 1,
    quality TEXT DEFAULT 'HD', -- 'HD', '4K'
    features JSONB, -- Array de strings: ['Sem anúncios', 'Download offline']
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Assinaturas de Usuários (Vínculo Usuário -> Plano)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.plans(id),
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'cancelled', 'pending_payment'
    current_period_start TIMESTAMPTZ DEFAULT now(),
    current_period_end TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Transações Financeiras
CREATE TABLE IF NOT EXISTS public.crm_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    status TEXT NOT NULL DEFAULT 'pending', -- 'paid', 'pending', 'failed', 'refunded'
    payment_method TEXT, -- 'pix', 'credit_card', 'boleto'
    provider_transaction_id TEXT, -- ID no Stripe/MercadoPago
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Administradores (Se não existir)
CREATE TABLE IF NOT EXISTS public.crm_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'support',
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Revendedores (Se não existir)
CREATE TABLE IF NOT EXISTS public.crm_resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.crm_admins(id) ON DELETE CASCADE,
    commission_rate NUMERIC(5,2) DEFAULT 10.00,
    balance NUMERIC(10,2) DEFAULT 0.00,
    pix_key TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Tabela de Logs de Auditoria (Se não existir)
CREATE TABLE IF NOT EXISTS public.crm_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.crm_admins(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_resource TEXT,
    target_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Tabela de Fontes M3U (Se não existir)
CREATE TABLE IF NOT EXISTS public.crm_m3u_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    auto_update BOOLEAN DEFAULT true,
    update_interval INTEGER DEFAULT 24,
    last_updated TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Tabela de Blacklist de IP (Se não existir)
CREATE TABLE IF NOT EXISTS public.crm_ip_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_by UUID REFERENCES public.crm_admins(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.crm_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.user_subscriptions(status);

-- Habilitar RLS (Segurança Básica)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura (Público pode ver planos, Usuário vê suas subs/transações)
CREATE POLICY "Public plans" ON public.plans FOR SELECT USING (active = true);
CREATE POLICY "User subscriptions" ON public.user_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User transactions" ON public.crm_transactions FOR ALL USING (auth.uid() = user_id);

-- Políticas de Admin (Admins podem ver tudo)
-- NOTA: Isso requer que o admin esteja logado e a aplicação use Service Role OU uma lógica de claims.
-- Para simplificar neste estágio de desenvolvimento, vamos permitir acesso total via Service Role (API Backend) 
-- e criar uma policy permissiva temporária para o Dashboard funcionar sem auth complexa de admin agora.
-- (Em produção, substitua por check de role)

CREATE POLICY "Admins full access plans" ON public.plans FOR ALL USING (true);
CREATE POLICY "Admins full access subs" ON public.user_subscriptions FOR ALL USING (true);
CREATE POLICY "Admins full access transactions" ON public.crm_transactions FOR ALL USING (true);
