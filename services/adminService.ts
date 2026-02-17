/**
 * services/adminService.ts
 * 
 * Serviço centralizado para operações administrativas.
 * Conecta Dashboard, IPTV, Subscribers, Resellers e Security ao Supabase.
 */

import { supabase } from './supabaseService';

/* ---------- Interfaces ---------- */

export interface DashboardStats {
  totalSubscribers: number;
  activeSubscribers: number;
  totalMovies: number;
  totalSeries: number;
  totalChannels: number;
  totalRevenue: number;
}

export interface SubscriberRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  subscription?: {
    plan_name: string;
    status: string;
    current_period_end: string;
  };
  profiles?: { name: string; avatar_url?: string }[];
  devices_count?: number;
}

export interface M3USource {
  id: string;
  name: string;
  url: string;
  auto_update: boolean;
  update_interval: number;
  last_updated: string | null;
  status: string;
  created_at: string;
  channels_count?: number;
}

export interface Reseller {
  id: string;
  admin_id: string;
  commission_rate: number;
  balance: number;
  pix_key: string;
  notes: string;
  created_at: string;
  admin?: { name: string; email: string };
  clients_count?: number;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_resource: string;
  target_id: string;
  details: any;
  ip_address: string;
  created_at: string;
  admin?: { name: string; email: string };
}

export interface IPBlacklist {
  id: string;
  ip_address: string;
  reason: string;
  blocked_by: string;
  expires_at: string | null;
  created_at: string;
}

export interface SecuritySettings {
  id?: string;
  geo_block_enabled: boolean;
  ddos_protection: boolean;
  admin_2fa_required: boolean;
  max_login_attempts: number;
  session_timeout_hours: number;
}

export interface AdminConfig {
  id?: string;
  instance_name: string;
  maintenance_mode: boolean;
  cdn_caching: boolean;
  smtp_server: string;
  sender_email: string;
  system_alerts: boolean;
}

/* ---------- DASHBOARD ---------- */

export async function getDashboardStats(): Promise<DashboardStats> {
  const [moviesRes, seriesRes, channelsRes, subsRes, revenueRes] = await Promise.allSettled([
    supabase.from('movies').select('id', { count: 'exact', head: true }),
    supabase.from('series').select('id', { count: 'exact', head: true }),
    supabase.from('channels').select('id', { count: 'exact', head: true }),
    supabase.from('user_subscriptions').select('id, status', { count: 'exact' }),
    supabase.from('crm_transactions').select('amount').eq('status', 'paid'),
  ]);

  const moviesCount = moviesRes.status === 'fulfilled' ? (moviesRes.value.count || 0) : 0;
  const seriesCount = seriesRes.status === 'fulfilled' ? (seriesRes.value.count || 0) : 0;
  const channelsCount = channelsRes.status === 'fulfilled' ? (channelsRes.value.count || 0) : 0;

  let totalSubs = 0;
  let activeSubs = 0;
  if (subsRes.status === 'fulfilled') {
    totalSubs = subsRes.value.count || 0;
    activeSubs = (subsRes.value.data || []).filter((s: any) => s.status === 'active').length;
  }

  let revenue = 0;
  if (revenueRes.status === 'fulfilled' && revenueRes.value.data) {
    revenue = revenueRes.value.data.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0);
  }

  return {
    totalSubscribers: totalSubs,
    activeSubscribers: activeSubs,
    totalMovies: moviesCount,
    totalSeries: seriesCount,
    totalChannels: channelsCount,
    totalRevenue: revenue,
  };
}

export async function getRecentTransactions(limit = 10): Promise<any[]> {
  const { data, error } = await supabase
    .from('crm_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export async function getMonthlyRevenue(): Promise<{ month: string; receita: number; novos: number }[]> {
  // Buscar transações dos últimos 6 meses
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: transactions } = await supabase
    .from('crm_transactions')
    .select('amount, created_at')
    .eq('status', 'paid')
    .gte('created_at', sixMonthsAgo.toISOString())
    .order('created_at', { ascending: true });

  const { data: subs } = await supabase
    .from('user_subscriptions')
    .select('created_at')
    .gte('created_at', sixMonthsAgo.toISOString());

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const result: Record<string, { receita: number; novos: number }> = {};

  // Inicializar meses
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${months[d.getMonth()]}`;
    result[key] = { receita: 0, novos: 0 };
  }

  (transactions || []).forEach((t: any) => {
    const d = new Date(t.created_at);
    const key = months[d.getMonth()];
    if (result[key]) result[key].receita += parseFloat(t.amount) || 0;
  });

  (subs || []).forEach((s: any) => {
    const d = new Date(s.created_at);
    const key = months[d.getMonth()];
    if (result[key]) result[key].novos += 1;
  });

  return Object.entries(result).map(([month, data]) => ({ month, ...data }));
}

/* ---------- SUBSCRIBERS ---------- */

export async function getSubscribers(page = 1, pageSize = 20, search = '', statusFilter = '', planFilter = ''): Promise<{ data: SubscriberRow[]; total: number }> {
  // Buscar assinaturas com join no plano
  let query = supabase
    .from('user_subscriptions')
    .select(`
      id,
      user_id,
      status,
      current_period_end,
      created_at,
      plan:plans(name, price)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'Todos') {
    query = query.eq('status', statusFilter.toLowerCase());
  }

  if (planFilter && planFilter !== 'Todos') {
    // Filtrar pelo nome do plano requer join
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) return { data: [], total: 0 };

  const rows: SubscriberRow[] = (data || []).map((sub: any) => ({
    id: sub.user_id || sub.id,
    email: sub.user_id || 'N/A',
    created_at: sub.created_at,
    subscription: {
      plan_name: sub.plan?.name || 'Sem Plano',
      status: sub.status,
      current_period_end: sub.current_period_end,
    },
  }));

  return { data: rows, total: count || 0 };
}

export async function updateSubscriptionStatus(subId: string, status: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', subId);
  return !error;
}

export async function deleteSubscription(subId: string): Promise<boolean> {
  const { error } = await supabase.from('user_subscriptions').delete().eq('id', subId);
  return !error;
}

/* ---------- IPTV / M3U Sources ---------- */

export async function getM3USources(): Promise<M3USource[]> {
  const { data, error } = await supabase
    .from('crm_m3u_sources')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function createM3USource(source: Partial<M3USource>): Promise<M3USource | null> {
  const { data, error } = await supabase
    .from('crm_m3u_sources')
    .insert(source)
    .select()
    .maybeSingle();
  if (error) { console.error('Erro ao criar fonte M3U:', error); return null; }
  return data;
}

export async function updateM3USource(id: string, updates: Partial<M3USource>): Promise<boolean> {
  const { error } = await supabase.from('crm_m3u_sources').update(updates).eq('id', id);
  return !error;
}

export async function deleteM3USource(id: string): Promise<boolean> {
  const { error } = await supabase.from('crm_m3u_sources').delete().eq('id', id);
  return !error;
}

export async function getChannelsAdmin(): Promise<any[]> {
  // Try English column name first (schema standard), fallback to Portuguese
  let { data, error } = await supabase
    .from('channels')
    .select('*')
    .order('name', { ascending: true });
  if (error) {
    // Fallback: try Portuguese column name
    const res = await supabase.from('channels').select('*').order('nome', { ascending: true });
    data = res.data;
    error = res.error;
  }
  if (error) return [];
  // Normalize: ensure both naming conventions are available
  return (data || []).map((c: any) => ({
    ...c,
    nome: c.nome || c.name || '',
    name: c.name || c.nome || '',
    logo: c.logo || c.logo_url || '',
    genero: c.genero || c.category || '',
    category: c.category || c.genero || '',
    url: c.url || c.stream_url || '',
    stream_url: c.stream_url || c.url || '',
  }));
}

export async function createChannel(channel: any): Promise<any> {
  // Normalize to English column names (DB schema standard)
  const normalized: any = {
    name: channel.name || channel.nome || '',
    logo: channel.logo || '',
    category: channel.category || channel.genero || '',
    stream_url: channel.stream_url || channel.url || '',
  };
  if (channel.number != null) normalized.number = channel.number;
  if (channel.is_premium != null) normalized.is_premium = channel.is_premium;

  let { data, error } = await supabase.from('channels').insert(normalized).select().maybeSingle();
  if (error) {
    // Fallback: try Portuguese column names
    const ptNormalized: any = {
      nome: channel.nome || channel.name || '',
      logo: channel.logo || '',
      genero: channel.genero || channel.category || '',
      url: channel.url || channel.stream_url || '',
    };
    const res = await supabase.from('channels').insert(ptNormalized).select().maybeSingle();
    data = res.data;
    error = res.error;
  }
  if (error) { console.error('Erro ao criar canal:', error); return null; }
  return data;
}

export async function updateChannel(id: string, updates: any): Promise<boolean> {
  // Normalize to English column names (DB schema standard)
  const normalized: any = {};
  if (updates.name || updates.nome) normalized.name = updates.name || updates.nome;
  if (updates.logo !== undefined) normalized.logo = updates.logo;
  if (updates.category || updates.genero) normalized.category = updates.category || updates.genero;
  if (updates.stream_url || updates.url) normalized.stream_url = updates.stream_url || updates.url;
  if (updates.number != null) normalized.number = updates.number;
  if (updates.is_premium != null) normalized.is_premium = updates.is_premium;

  let { error } = await supabase.from('channels').update(normalized).eq('id', id);
  if (error) {
    // Fallback: try Portuguese column names
    const ptNormalized: any = {};
    if (updates.nome || updates.name) ptNormalized.nome = updates.nome || updates.name;
    if (updates.logo !== undefined) ptNormalized.logo = updates.logo;
    if (updates.genero || updates.category) ptNormalized.genero = updates.genero || updates.category;
    if (updates.url || updates.stream_url) ptNormalized.url = updates.url || updates.stream_url;
    const res = await supabase.from('channels').update(ptNormalized).eq('id', id);
    error = res.error;
  }
  return !error;
}

export async function deleteChannel(id: string): Promise<boolean> {
  const { error } = await supabase.from('channels').delete().eq('id', id);
  return !error;
}

/* ---------- RESELLERS ---------- */

export async function getResellers(): Promise<Reseller[]> {
  const { data, error } = await supabase
    .from('crm_resellers')
    .select(`*, admin:crm_admins(name, email)`)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function createReseller(reseller: Partial<Reseller>): Promise<Reseller | null> {
  const { data, error } = await supabase.from('crm_resellers').insert(reseller).select().maybeSingle();
  if (error) { console.error('Erro ao criar revendedor:', error); return null; }
  return data;
}

export async function updateReseller(id: string, updates: Partial<Reseller>): Promise<boolean> {
  const { error } = await supabase.from('crm_resellers').update(updates).eq('id', id);
  return !error;
}

export async function deleteReseller(id: string): Promise<boolean> {
  const { error } = await supabase.from('crm_resellers').delete().eq('id', id);
  return !error;
}

export async function getResellersStats(): Promise<{ total: number; totalBalance: number; totalCommissions: number }> {
  const { data, error } = await supabase.from('crm_resellers').select('balance, commission_rate');
  if (error || !data) return { total: 0, totalBalance: 0, totalCommissions: 0 };
  return {
    total: data.length,
    totalBalance: data.reduce((sum, r: any) => sum + (parseFloat(r.balance) || 0), 0),
    totalCommissions: data.reduce((sum, r: any) => sum + (parseFloat(r.commission_rate) || 0), 0) / Math.max(data.length, 1),
  };
}

/* ---------- SECURITY ---------- */

export async function getAuditLogs(limit = 50): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('crm_audit_logs')
    .select(`*, admin:crm_admins(name, email)`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export async function insertAuditLog(log: Partial<AuditLog>): Promise<boolean> {
  const { error } = await supabase.from('crm_audit_logs').insert(log);
  return !error;
}

export async function getIPBlacklist(): Promise<IPBlacklist[]> {
  const { data, error } = await supabase
    .from('crm_ip_blacklist')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function addIPToBlacklist(entry: Partial<IPBlacklist>): Promise<IPBlacklist | null> {
  const { data, error } = await supabase.from('crm_ip_blacklist').insert(entry).select().maybeSingle();
  if (error) { console.error('Erro ao bloquear IP:', error); return null; }
  return data;
}

export async function removeIPFromBlacklist(id: string): Promise<boolean> {
  const { error } = await supabase.from('crm_ip_blacklist').delete().eq('id', id);
  return !error;
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const { data, error } = await supabase.from('admin_settings').select('*').eq('key', 'security').maybeSingle();
  if (error || !data) {
    return { geo_block_enabled: false, ddos_protection: false, admin_2fa_required: false, max_login_attempts: 5, session_timeout_hours: 24 };
  }
  return data.value as SecuritySettings;
}

export async function updateSecuritySettings(settings: SecuritySettings): Promise<boolean> {
  const { error } = await supabase
    .from('admin_settings')
    .upsert({ key: 'security', value: settings }, { onConflict: 'key' });
  return !error;
}

/* ---------- ADMIN SETTINGS ---------- */

export async function getAdminConfig(): Promise<AdminConfig> {
  const { data, error } = await supabase.from('admin_settings').select('*').eq('key', 'config').maybeSingle();
  if (error || !data) {
    return {
      instance_name: 'RED X Master Node 01',
      maintenance_mode: false,
      cdn_caching: true,
      smtp_server: 'smtp.sendgrid.net',
      sender_email: 'no-reply@redx.com',
      system_alerts: true,
    };
  }
  return data.value as AdminConfig;
}

export async function updateAdminConfig(config: AdminConfig): Promise<boolean> {
  const { error } = await supabase
    .from('admin_settings')
    .upsert({ key: 'config', value: config }, { onConflict: 'key' });
  return !error;
}

export async function getSystemHealth(): Promise<{ database: boolean; storage: boolean; latency: number }> {
  const start = Date.now();
  try {
    const { error } = await supabase.from('movies').select('id').limit(1);
    const latency = Date.now() - start;
    return { database: !error, storage: true, latency };
  } catch {
    return { database: false, storage: false, latency: Date.now() - start };
  }
}
