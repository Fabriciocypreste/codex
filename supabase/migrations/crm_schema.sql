-- Migration for CRM Features (Admin, Resellers, Logs)
-- Created: 2024-02-12

-- 1. Tabela de Administradores e Permissões
-- Vincula usuários existentes do Supabase Auth a funções administrativas
CREATE TABLE IF NOT EXISTS public.crm_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'support', -- 'superadmin', 'manager', 'support', 'reseller'
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Revendedores (Extensão de Admins)
CREATE TABLE IF NOT EXISTS public.crm_resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.crm_admins(id) ON DELETE CASCADE,
    commission_rate NUMERIC(5,2) DEFAULT 10.00, -- Porcentagem de comissão (ex: 10.00%)
    balance NUMERIC(10,2) DEFAULT 0.00, -- Saldo atual
    pix_key TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Logs de Auditoria (Segurança)
CREATE TABLE IF NOT EXISTS public.crm_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.crm_admins(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'CREATE_USER', 'DELETE_DEVICE', 'UPDATE_PLAN'
    target_resource TEXT, -- 'users', 'plans', 'iptv'
    target_id TEXT, -- ID do objeto afetado
    details JSONB, -- Dados alterados (antes/depois)
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Fontes M3U (IPTV)
CREATE TABLE IF NOT EXISTS public.crm_m3u_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    auto_update BOOLEAN DEFAULT true,
    update_interval INTEGER DEFAULT 24, -- Horas
    last_updated TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- 'active', 'error', 'disabled'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Blacklist de IP (Segurança)
CREATE TABLE IF NOT EXISTS public.crm_ip_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_by UUID REFERENCES public.crm_admins(id),
    expires_at TIMESTAMPTZ, -- Null = permanente
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_crm_admins_user_id ON public.crm_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_admin_id ON public.crm_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_created_at ON public.crm_audit_logs(created_at DESC);

-- RLS (Row Level Security) - IMPORTANTE:
-- Em produção, você deve habilitar RLS e criar policies para que apenas
-- usuários listados em 'crm_admins' possam ler/escrever nessas tabelas.
-- Por enquanto, deixaremos aberto para facilitar o desenvolvimento inicial.

ALTER TABLE public.crm_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política simples: Superadmin vê tudo (placeholder, precisa implementar auth.uid() check)
CREATE POLICY "Admins can view all" ON public.crm_admins FOR ALL USING (true);
CREATE POLICY "Admins can view logs" ON public.crm_audit_logs FOR ALL USING (true);
