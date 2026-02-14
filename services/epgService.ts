// ═══════════════════════════════════════════════════════════════
// EPG Service — Grade de Programação (XMLTV)
// Fonte primária: /epg-br.xml (182 canais, 18k+ programas)
// Fallback: GitHub limaalef/BrazilTVEPG
// ═══════════════════════════════════════════════════════════════

export interface EPGProgramme {
  title: string;
  description: string;
  category: string;
  start: Date;
  stop: Date;
  channelId: string;
  isLive: boolean;
  episode?: string;
}

export interface EPGChannel {
  id: string;
  displayName: string;
  icon?: string;
  programmes: EPGProgramme[];
}

// Fonte primária (arquivo local servido pelo Vite via /public ou raiz)
const LOCAL_EPG = '/epg-br.xml';

// Fallback remoto
const REMOTE_EPG_SOURCES = [
  'https://raw.githubusercontent.com/limaalef/BrazilTVEPG/main/claro.xml',
  'https://raw.githubusercontent.com/limaalef/BrazilTVEPG/main/epg.xml',
];

// Cache
let epgCache: Map<string, EPGChannel> = new Map();
let lastFetchTime = 0;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 horas
let fetchPromise: Promise<void> | null = null;

// ═══ Helpers ═══

/** Parse data XMLTV: "20260212060000 +0000" ou "20260212060000 -0300" → Date */
function parseXMLTVDate(str: string): Date {
  const clean = str.trim();
  const year = parseInt(clean.substring(0, 4));
  const month = parseInt(clean.substring(4, 6)) - 1;
  const day = parseInt(clean.substring(6, 8));
  const hour = parseInt(clean.substring(8, 10));
  const min = parseInt(clean.substring(10, 12));
  const sec = parseInt(clean.substring(12, 14));

  const tzMatch = clean.match(/([+-]\d{4})$/);
  if (tzMatch) {
    const tzStr = tzMatch[1];
    const tzSign = tzStr[0] === '+' ? 1 : -1;
    const tzHours = parseInt(tzStr.substring(1, 3));
    const tzMins = parseInt(tzStr.substring(3, 5));
    const totalOffsetMs = tzSign * (tzHours * 60 + tzMins) * 60 * 1000;
    const utcMs = Date.UTC(year, month, day, hour, min, sec) - totalOffsetMs;
    return new Date(utcMs);
  }

  return new Date(year, month, day, hour, min, sec);
}

/** Normaliza nome de canal para comparação fuzzy */
function normalizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remover prefixos comuns: "BR - ", "BR: " etc.
    .replace(/^br\s*[-:]\s*/i, '')
    // Remover sufixos de qualidade
    .replace(/\s*(hd|fhd|sd|4k|uhd)\s*/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/** Parse um XML XMLTV e extrai canais/programas */
function parseXMLTV(xmlText: string): Map<string, EPGChannel> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const result = new Map<string, EPGChannel>();

  // Parse canais (com ícones)
  const channelNodes = doc.querySelectorAll('channel');
  channelNodes.forEach((node) => {
    const id = node.getAttribute('id') || '';
    const displayName = node.querySelector('display-name')?.textContent || id;
    const icon = node.querySelector('icon')?.getAttribute('src') || undefined;
    if (id) {
      result.set(id, { id, displayName, icon, programmes: [] });
    }
  });

  // Parse programas
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 2);

  const progNodes = doc.querySelectorAll('programme');
  progNodes.forEach((node) => {
    const channelId = node.getAttribute('channel') || '';
    const startStr = node.getAttribute('start') || '';
    const stopStr = node.getAttribute('stop') || '';

    if (!channelId || !startStr || !stopStr) return;

    const start = parseXMLTVDate(startStr);
    const stop = parseXMLTVDate(stopStr);

    // Só importar programas de hoje/amanhã
    if (stop < dayStart || start > dayEnd) return;

    const title = node.querySelector('title')?.textContent?.trim() || '';
    
    // Descrição: pode estar em <desc> com sinopse completa
    const descNode = node.querySelector('desc');
    let description = descNode?.textContent?.trim() || '';
    
    // Separar categoria da descrição se formato "Category\nSinopse..."
    let category = node.querySelector('category')?.textContent?.trim() || '';
    if (!category && description) {
      // Formato epg-br.xml: primeira linha pode ser o gênero
      const lines = description.split('\n');
      if (lines.length > 1 && lines[0].length < 30) {
        category = lines[0].trim();
        description = lines.slice(1).join('\n').trim();
      }
    }
    
    const episodeNum = node.querySelector('episode-num')?.textContent || '';
    const isLive = category.toLowerCase().includes('live') || title.toLowerCase().includes('ao vivo');

    const programme: EPGProgramme = {
      title,
      description,
      category,
      start,
      stop,
      channelId,
      isLive,
      episode: episodeNum || undefined,
    };

    const channel = result.get(channelId);
    if (channel) {
      channel.programmes.push(programme);
    } else {
      result.set(channelId, {
        id: channelId,
        displayName: channelId,
        programmes: [programme],
      });
    }
  });

  // Ordenar programas por horário
  result.forEach((ch) => {
    ch.programmes.sort((a, b) => a.start.getTime() - b.start.getTime());
  });

  return result;
}

/** Buscar e parsear EPG — prioridade: local > remoto */
async function fetchAllEPG(): Promise<void> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL && epgCache.size > 0) return;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    console.log('[EPG] Carregando grades de programação...');
    let newCache = new Map<string, EPGChannel>();

    // 1. Tentar fonte local primeiro (epg-br.xml — 182 canais, ~18k programas)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(LOCAL_EPG, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const text = await res.text();
        newCache = parseXMLTV(text);
        console.log(`[EPG] Fonte local carregada: ${newCache.size} canais`);
      }
    } catch (err) {
      console.warn('[EPG] Fonte local indisponível, usando fallback remoto');
    }

    // 2. Fallback remoto se local falhou
    if (newCache.size === 0) {
      const results = await Promise.allSettled(
        REMOTE_EPG_SOURCES.map(async (url) => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            return parseXMLTV(text);
          } catch (err) {
            console.warn(`[EPG] Falha: ${url.split('/').pop()}`, err);
            return null;
          }
        })
      );

      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          r.value.forEach((channel, id) => {
            const existing = newCache.get(id);
            if (existing) {
              const existingStarts = new Set(existing.programmes.map((p) => p.start.getTime()));
              channel.programmes.forEach((p) => {
                if (!existingStarts.has(p.start.getTime())) existing.programmes.push(p);
              });
              existing.programmes.sort((a, b) => a.start.getTime() - b.start.getTime());
            } else {
              newCache.set(id, channel);
            }
          });
        }
      });
    }

    let totalProgrammes = 0;
    newCache.forEach((ch) => { totalProgrammes += ch.programmes.length; });

    epgCache = newCache;
    lastFetchTime = Date.now();
    fetchPromise = null;
    console.log(`[EPG] Pronto: ${newCache.size} canais, ${totalProgrammes} programas`);
  })();

  return fetchPromise;
}

// ═══ Mapeamento canal local → canal EPG ═══

// Cache de matching
const matchCache = new Map<string, string | null>();

// Mapeamento manual para canais com nomes muito diferentes
const MANUAL_MAP: Record<string, string[]> = {
  'sbt': ['sbtbrasil', 'sbtrj', 'sbtsp'],
  'record': ['recordtvbrasil', 'recordtvrj', 'recordtvsp'],
  'record news': ['recordnews'],
  'globo': ['globobrasil', 'globorj', 'globosp'],
  'band': ['bandbrasil', 'bandrj', 'bandsp'],
  'redetv': ['redetv', 'redetvrj', 'redetvsp'],
  'tv cultura': ['cultura'],
  'tv câmara': ['tvcamara'],
  'tv camara': ['tvcamara'],
  'rede brasil': ['redebrasil'],
  'cnn brasil': ['cnnbrasil'],
  'cartoon network': ['cartoonnetwork'],
  'discovery kids': ['discoverykids'],
  'globonews': ['globonews'],
  'band news': ['bandnews'],
  'sportv': ['sportv'],
  'sportv 2': ['sportv2'],
  'sportv 3': ['sportv3'],
  'premiere': ['premiereclubes'],
  'disney channel': ['disneychannel'],
  'disney junior': ['disneyjunior'],
  'hbo': ['hbo'],
  'telecine': ['telecinepremium', 'telecineaction'],
  'espn': ['espn'],
  'espn 2': ['espn2'],
  'multishow': ['multishow'],
  'gnt': ['gnt'],
  'viva': ['viva'],
  'bis': ['bis'],
  'megapix': ['megapix'],
  'universal': ['universalchannel', 'universaltv'],
  'comedy central': ['comedycentral'],
  'mtv': ['mtv'],
  'vh1': ['vh1'],
  'axn': ['axn'],
  'tnt': ['tnt'],
  'space': ['space'],
  'warner': ['warnerchannel'],
  'fx': ['fx'],
  'a&e': ['ae'],
  'history': ['historychannel', 'history'],
  'discovery': ['discoverychannel', 'discovery'],
  'animal planet': ['animalplanet'],
  'natgeo': ['nationalgeographic', 'natgeo'],
  'national geographic': ['nationalgeographic', 'natgeo'],
  'travel box': ['travelbox'],
  'food network': ['foodnetwork'],
};

/** Encontrar o melhor match de canal EPG para um nome local */
function findBestEPGMatch(channelName: string): EPGChannel | null {
  const cached = matchCache.get(channelName);
  if (cached !== undefined) {
    return cached ? epgCache.get(cached) || null : null;
  }

  const normalized = normalizeChannelName(channelName);
  
  // 1. Tentar mapeamento manual primeiro
  const manualKeys = Object.keys(MANUAL_MAP);
  for (const key of manualKeys) {
    if (normalizeChannelName(key) === normalized) {
      for (const epgNorm of MANUAL_MAP[key]) {
        // Procurar no cache pelo nome normalizado do EPG
        for (const [id, ch] of epgCache) {
          if (normalizeChannelName(ch.displayName) === epgNorm || normalizeChannelName(id) === epgNorm) {
            if (ch.programmes.length > 0) {
              matchCache.set(channelName, id);
              return ch;
            }
          }
        }
      }
    }
  }

  // 2. Match automático por similaridade
  let bestMatch: EPGChannel | null = null;
  let bestScore = 0;

  epgCache.forEach((epgChannel) => {
    if (epgChannel.programmes.length === 0) return; // ignorar canais sem programação

    const epgNorm = normalizeChannelName(epgChannel.displayName);
    const idNorm = normalizeChannelName(epgChannel.id);

    // Match exato (nome ou id)
    if (epgNorm === normalized || idNorm === normalized) {
      bestMatch = epgChannel;
      bestScore = 100;
      return;
    }

    // Um contém o outro (ambos os lados)
    if (epgNorm.includes(normalized) || normalized.includes(epgNorm)) {
      const score = Math.min(epgNorm.length, normalized.length) / Math.max(epgNorm.length, normalized.length) * 85;
      if (score > bestScore) {
        bestMatch = epgChannel;
        bestScore = score;
      }
    }
    // Também checar pelo id normalizado
    if (idNorm.includes(normalized) || normalized.includes(idNorm)) {
      const score = Math.min(idNorm.length, normalized.length) / Math.max(idNorm.length, normalized.length) * 80;
      if (score > bestScore) {
        bestMatch = epgChannel;
        bestScore = score;
      }
    }
  });

  if (bestScore >= 40 && bestMatch) {
    matchCache.set(channelName, (bestMatch as EPGChannel).id);
    return bestMatch;
  }

  matchCache.set(channelName, null);
  return null;
}

// ═══ API Pública ═══

/** Inicializar EPG (chamar no mount do LiveTV) */
export async function initEPG(): Promise<void> {
  await fetchAllEPG();
}

/** Obter programa atual de um canal */
export function getCurrentProgramme(channelName: string): EPGProgramme | null {
  const epgChannel = findBestEPGMatch(channelName);
  if (!epgChannel) return null;

  const now = new Date();
  return epgChannel.programmes.find((p) => p.start <= now && p.stop > now) || null;
}

/** Obter próximo programa de um canal */
export function getNextProgramme(channelName: string): EPGProgramme | null {
  const epgChannel = findBestEPGMatch(channelName);
  if (!epgChannel) return null;

  const now = new Date();
  return epgChannel.programmes.find((p) => p.start > now) || null;
}

/** Obter lista de programas do canal (próximas horas) */
export function getChannelSchedule(channelName: string, hours: number = 6): EPGProgramme[] {
  const epgChannel = findBestEPGMatch(channelName);
  if (!epgChannel) return [];

  const now = new Date();
  const limit = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return epgChannel.programmes.filter((p) => p.stop > now && p.start < limit);
}

/** Calcular progresso do programa atual (0-100) */
export function getProgrammeProgress(programme: EPGProgramme): number {
  const now = Date.now();
  const start = programme.start.getTime();
  const stop = programme.stop.getTime();
  const total = stop - start;
  if (total <= 0) return 0;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

/** Formatar horário: "14:30" */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Verificar se um canal tem EPG disponível */
export function hasEPG(channelName: string): boolean {
  return findBestEPGMatch(channelName) !== null;
}

/** Limpar caches (ex: ao trocar de página) */
export function clearEPGCache(): void {
  matchCache.clear();
}
