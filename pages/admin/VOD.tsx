import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { Film, Tv, Search, Edit2, Trash2, Plus, Star, Save, X, Upload, AlertTriangle, Globe, Sparkles } from 'lucide-react';
import { getAllMovies, getAllSeries, insertMovie, insertSeries, updateMovie, updateSeries, deleteMovie, deleteSeries, uploadImage, supabase, insertImageUpdate } from '../../services/supabaseService';
import { searchAnyLang, getImageUrl } from '../../services/tmdb';
import { Media } from '../../types';

const VOD: React.FC = () => {
  // Estados principais
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'Todos' | 'movie' | 'series'>('Todos');
  const [filterYear, setFilterYear] = useState('Todos');
  const [filterPlatform, setFilterPlatform] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'published' | 'draft'>('Todos');
  const [filterGenre, setFilterGenre] = useState('Todos');

  // Stats
  const [stats, setStats] = useState({ movies: 0, series: 0 });

  // Edit
  const [editingItem, setEditingItem] = useState<Media | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    poster: '',
    backdrop: '',
    logo_url: '',
    stream_url: '',
    trailer_url: '',
    use_trailer: false,
    platform: '',
    status: 'published' as 'published' | 'draft'
  });
  const [saving, setSaving] = useState(false);

  // Batch upload
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ processed: number; total: number; logs: string[]; matched: number }>({ processed: 0, total: 0, logs: [], matched: 0 });
  const [batchResults, setBatchResults] = useState<{ fileName: string; imageType: 'poster' | 'backdrop' | 'logo'; matchedId?: string; matchedTitle?: string; status: 'atualizado' | 'nao_encontrado' | 'upload_erro' | 'update_erro'; url?: string }[]>([]);
  const [batchFilter, setBatchFilter] = useState<'Todos' | 'atualizado' | 'nao_encontrado' | 'erros'>('Todos');

  const [showImportUpload, setShowImportUpload] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'url'>('file');
  const [importUrl, setImportUrl] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number; phase: string }>({ loaded: 0, total: 0, phase: '' });
  const [importProgress, setImportProgress] = useState<{ step: string; logs: string[]; movies: number; series: number }>({ step: '', logs: [], movies: 0, series: 0 });
  const [previewMovies, setPreviewMovies] = useState<any[]>([]);
  const [previewSeries, setPreviewSeries] = useState<any[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<{ movies: Set<number>; series: Set<number> }>({ movies: new Set(), series: new Set() });

  // Filtros de importação
  const [importFilterType, setImportFilterType] = useState<'Todos' | 'movie' | 'series'>('Todos');
  const [importFilterKids, setImportFilterKids] = useState<'Todos' | 'kids' | 'adult'>('Todos');
  const [importFilterYearMin, setImportFilterYearMin] = useState<number>(1900);
  const [importFilterYearMax, setImportFilterYearMax] = useState<number>(2030);
  const [importFilterGroup, setImportFilterGroup] = useState<string>('Todos');
  const [importFilterGenre, setImportFilterGenre] = useState<string>('Todos');
  const [importFilterSearch, setImportFilterSearch] = useState<string>('');

  // Delete
  const [deletingItem, setDeletingItem] = useState<Media | null>(null);

  // Create new
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'movie' | 'series'>('movie');
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    poster: '',
    backdrop: '',
    logo_url: '',
    stream_url: '',
    trailer_url: '',
    use_trailer: false,
    platform: '',
    year: new Date().getFullYear(),
    genre: '' as string,
    tmdb_id: '' as string,
    rating: '',
    status: 'published' as 'published' | 'draft'
  });
  const [creating, setCreating] = useState(false);

  // TMDB search for create
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbSearchResults, setTmdbSearchResults] = useState<any[]>([]);
  const [searchingTmdb, setSearchingTmdb] = useState(false);

  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;
    setSearchingTmdb(true);
    try {
      const results = await searchAnyLang(tmdbSearchQuery);
      const filtered = (results || []).filter((r: any) => {
        if (createType === 'movie') return r.media_type === 'movie';
        return r.media_type === 'tv';
      }).slice(0, 10);
      setTmdbSearchResults(filtered);
    } catch (e) {
      console.error('Erro na busca TMDB:', e);
    } finally {
      setSearchingTmdb(false);
    }
  };

  const fillFromTmdb = (result: any) => {
    setCreateForm(prev => ({
      ...prev,
      title: result.title || result.name || prev.title,
      description: result.overview || prev.description,
      poster: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : prev.poster,
      backdrop: result.backdrop_path ? `https://image.tmdb.org/t/p/original${result.backdrop_path}` : prev.backdrop,
      year: new Date(result.release_date || result.first_air_date || '').getFullYear() || prev.year,
      tmdb_id: String(result.id),
      rating: result.vote_average?.toFixed(1) || prev.rating,
    }));
    setTmdbSearchResults([]);
    setTmdbSearchQuery('');
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      alert('Título é obrigatório.');
      return;
    }
    setCreating(true);
    try {
      const payload: any = {
        title: createForm.title.trim(),
        description: createForm.description || null,
        poster: createForm.poster || null,
        backdrop: createForm.backdrop || null,
        logo_url: createForm.logo_url || null,
        stream_url: createForm.stream_url || null,
        year: createForm.year || null,
        genre: createForm.genre ? createForm.genre.split(',').map(g => g.trim()).filter(Boolean) : [],
        status: createForm.status,
      };
      if (createForm.tmdb_id) payload.tmdb_id = parseInt(createForm.tmdb_id) || null;
      if (createForm.rating) payload.rating = parseFloat(createForm.rating) || null;

      let result = null;
      if (createType === 'movie') {
        result = await insertMovie(payload);
      } else {
        result = await insertSeries(payload);
      }

      if (result) {
        const newItem = { ...result, type: createType } as Media;
        setItems(prev => [newItem, ...prev]);
        setStats(prev => ({
          movies: createType === 'movie' ? prev.movies + 1 : prev.movies,
          series: createType === 'series' ? prev.series + 1 : prev.series
        }));
        setShowCreateModal(false);
        setCreateForm({
          title: '', description: '', poster: '', backdrop: '', logo_url: '',
          stream_url: '', trailer_url: '', use_trailer: false, platform: '',
          year: new Date().getFullYear(), genre: '', tmdb_id: '', rating: '',
          status: 'published'
        });
      } else {
        alert('Erro ao inserir no banco. Verifique o console.');
      }
    } catch (error) {
      console.error('Erro ao criar conteúdo:', error);
      alert('Erro ao criar conteúdo.');
    } finally {
      setCreating(false);
    }
  };

  // Carregar dados (useCallback para estabilidade)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [movies, series] = await Promise.all([getAllMovies(), getAllSeries()]);
      const normalizedMovies = (movies || []).map(m => ({ ...m, type: 'movie' as const }));
      const normalizedSeries = (series || []).map(s => ({ ...s, type: 'series' as const }));
      const merged = [...normalizedMovies, ...normalizedSeries];
      setItems(merged);
      setStats({ movies: normalizedMovies.length, series: normalizedSeries.length });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper: converter imagem para WebP (client-only)
  const isConvertibleImage = (file: File) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    const isWebp = ext === 'webp' || type === 'image/webp';
    const isJpgPng = ['jpg', 'jpeg', 'png'].includes(ext) || ['image/jpeg', 'image/jpg', 'image/png'].includes(type);
    return !isWebp && isJpgPng;
  };

  const convertToWebP = async (file: File): Promise<File> => {
    if (typeof window === 'undefined') throw new Error('Conversion must run in browser');
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.webp', { type: 'image/webp', lastModified: Date.now() });
            resolve(newFile);
          } else {
            reject(new Error('Conversion to WebP failed'));
          }
        }, 'image/webp', 0.85);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  // Upload single file handler
  const handleFileUpload = async (file: File, bucket: 'posters' | 'backdrops' | 'logos', field: 'poster' | 'backdrop' | 'logo_url') => {
    setSaving(true);
    try {
      // Manter upload direto; conversão só no batch
      const url = await uploadImage(file, bucket);
      if (url) {
        setEditForm(prev => ({ ...prev, [field]: url }));
      } else {
        alert('Erro ao fazer upload da imagem.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao fazer upload.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['fileName', 'imageType', 'matchedId', 'matchedTitle', 'status', 'url'];
    const rows = batchResults.map(r => [r.fileName, r.imageType, r.matchedId || '', r.matchedTitle || '', r.status, r.url || '']);
    const csv = [headers.join(','), ...rows.map(arr => arr.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upload-resumo-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const normalizeText = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const KIDS_KEYWORDS = /\b(kids|infantil|crian[cç]a|anima[cç][aã]o|animation|cartoon|disney|pixar|dreamworks|nickelodeon|desenho|family|fam[ií]lia|nick jr|baby|junior)\b/i;

  const classifyType = (name: string, group?: string): 'movie' | 'series' => {
    const n = normalizeText(name).toLowerCase();
    const g = (group || '').toLowerCase();
    if (/(s\d+\s*e\d+|temporada|season|ep\.?\s*\d+|\d+x\d+|epis[oó]dio|episode)/i.test(n)) return 'series';
    if (/\bseries?\b|\bs[ée]ries?\b/.test(g)) return 'series';
    return 'movie';
  };

  /** Extrai nome-base da série e info de temporada/episódio do título */
  const extractSeriesInfo = (title: string): { baseName: string; season: number; episode: number } | null => {
    // Padrões ordenados do mais específico ao mais genérico
    const patterns: { regex: RegExp; getSE: (m: RegExpMatchArray) => { s: number; e: number } }[] = [
      { regex: /\s*[-–—.:|\s]*S(\d+)\s*E(\d+).*/i, getSE: m => ({ s: parseInt(m[1]), e: parseInt(m[2]) }) },
      { regex: /\s*[-–—.:|\s]*T(\d+)\s*E(\d+).*/i, getSE: m => ({ s: parseInt(m[1]), e: parseInt(m[2]) }) },
      { regex: /\s*[-–—.:|\s]*(\d+)x(\d+).*/i, getSE: m => ({ s: parseInt(m[1]), e: parseInt(m[2]) }) },
      { regex: /\s*[-–—.:|\s]*Temporada\s*(\d+)\s*[-–—.:|\s]*(?:EP?\.?\s*(\d+))?.*/i, getSE: m => ({ s: parseInt(m[1]), e: m[2] ? parseInt(m[2]) : 1 }) },
      { regex: /\s*[-–—.:|\s]*Season\s*(\d+)\s*[-–—.:|\s]*(?:EP?\.?\s*(\d+))?.*/i, getSE: m => ({ s: parseInt(m[1]), e: m[2] ? parseInt(m[2]) : 1 }) },
      { regex: /\s*[-–—.:|\s]*Epis[oó]dio\s*(\d+).*/i, getSE: m => ({ s: 1, e: parseInt(m[1]) }) },
      { regex: /\s*[-–—.:|\s]*Episode\s*(\d+).*/i, getSE: m => ({ s: 1, e: parseInt(m[1]) }) },
      { regex: /\s*[-–—.:|\s]*EP?\.?\s*(\d+).*/i, getSE: m => ({ s: 1, e: parseInt(m[1]) }) },
    ];
    for (const { regex, getSE } of patterns) {
      const match = title.match(regex);
      if (match && match.index !== undefined) {
        const baseName = title.substring(0, match.index).replace(/\s*[-–—.:|\s]+$/, '').trim();
        if (!baseName) continue; // Nome vazio = falso positivo
        const { s, e } = getSE(match);
        return { baseName, season: s, episode: e };
      }
    }
    return null;
  };

  /** Consolida episódios de séries em entradas únicas (agrupa por nome-base) */
  const consolidateSeriesEpisodes = (seriesEntries: any[]): any[] => {
    const groups = new Map<string, {
      baseName: string;
      episodes: { season: number; episode: number; stream_url: string; title: string }[];
      firstEntry: any;
      maxSeason: number;
    }>();
    const standalone: any[] = [];

    for (const entry of seriesEntries) {
      const info = extractSeriesInfo(entry.title || '');
      if (info) {
        const key = normalizeText(info.baseName).toLowerCase();
        if (!groups.has(key)) {
          groups.set(key, { baseName: info.baseName, episodes: [], firstEntry: entry, maxSeason: 0 });
        }
        const group = groups.get(key)!;
        group.episodes.push({
          season: info.season,
          episode: info.episode,
          stream_url: entry.stream_url || '',
          title: entry.title || '',
        });
        group.maxSeason = Math.max(group.maxSeason, info.season);
        // Preferir entry com mais dados (poster, description) como base
        if ((!group.firstEntry.poster && entry.poster) || (!group.firstEntry.description && entry.description)) {
          group.firstEntry = { ...group.firstEntry, ...entry, title: group.firstEntry.title };
        }
      } else {
        standalone.push(entry);
      }
    }

    const consolidated: any[] = [];
    for (const [, group] of groups) {
      // Ordenar episódios: temporada → episódio
      group.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
      const uniqueSeasons = new Set(group.episodes.map(ep => ep.season)).size;
      const firstEp = group.episodes[0];

      consolidated.push({
        ...group.firstEntry,
        title: group.baseName,
        stream_url: firstEp?.stream_url || group.firstEntry.stream_url || '',
        seasons: uniqueSeasons,
        type: 'series',
        // Salvar total de episódios para referência
        _episodeCount: group.episodes.length,
        _episodes: group.episodes, // mantido apenas para log/preview, removido antes do DB
      });
    }

    return [...consolidated, ...standalone];
  };

  const isKidsContent = (name: string, group?: string): boolean => {
    return KIDS_KEYWORDS.test(name) || KIDS_KEYWORDS.test(group || '');
  };

  const extractGenresFromGroup = (group: string): string[] => {
    if (!group) return [];
    const genres: string[] = [];
    const g = group.toLowerCase();
    if (/a[cç][aã]o|action/.test(g)) genres.push('Ação');
    if (/com[eé]dia|comedy/.test(g)) genres.push('Comédia');
    if (/drama/.test(g)) genres.push('Drama');
    if (/terror|horror/.test(g)) genres.push('Terror');
    if (/suspense|thriller/.test(g)) genres.push('Suspense');
    if (/aventura|adventure/.test(g)) genres.push('Aventura');
    if (/fic[cç][aã]o|sci.?fi/.test(g)) genres.push('Ficção Científica');
    if (/romance|romanc/.test(g)) genres.push('Romance');
    if (/anim(a[cç][aã]o|ation|e)|cartoon|desenho/.test(g)) genres.push('Animação');
    if (/document[aá]rio|documentary/.test(g)) genres.push('Documentário');
    if (/fam[ií]lia|family/.test(g)) genres.push('Família');
    if (/fantasia|fantasy/.test(g)) genres.push('Fantasia');
    if (/guerra|war/.test(g)) genres.push('Guerra');
    if (/crime/.test(g)) genres.push('Crime');
    if (/musical|music/.test(g)) genres.push('Musical');
    if (/kids|infantil|crian/.test(g)) genres.push('Infantil');
    return genres;
  };

  const extractYear = (name: string) => {
    const m = name.match(/\b(19\d{2}|20\d{2})\b/);
    return m ? parseInt(m[1], 10) : undefined;
  };

  const parseM3UText = (text: string) => {
    // Remover BOM (Byte Order Mark) se presente
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/);
    const entries: any[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('#EXTINF')) {
        const info = line;
        // Procurar a URL: pular linhas vazias e linhas #EXT extras (ex: #EXTGRP, #EXTVLCOPT)
        let url = '';
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j]?.trim();
          if (!nextLine) continue;
          if (nextLine.startsWith('#EXT')) continue; // Pular metadados extras
          if (nextLine.startsWith('#')) continue; // Pular qualquer comentário
          url = nextLine;
          i = j; // Avançar o cursor principal para após a URL
          break;
        }
        if (!url) continue; // Sem URL encontrada, pular
        const nameMatch = info.match(/,(.*)$/);
        const name = nameMatch ? nameMatch[1].trim() : 'Sem Título';
        // Suporte a aspas simples e duplas nos atributos
        const logoMatch = info.match(/tvg-logo=["']([^"']*)["']/);
        const groupMatch = info.match(/group-title=["']([^"']*)["']/);
        const logo = logoMatch ? logoMatch[1] : '';
        const group = groupMatch ? groupMatch[1] : '';
        const type = classifyType(name, group);
        const year = extractYear(name);
        const platform = group || '';
        const genre = extractGenresFromGroup(group);
        const kids = isKidsContent(name, group);
        if (kids && !genre.includes('Infantil')) genre.push('Infantil');
        const e = { title: name, description: '', poster: '', backdrop: '', logo_url: logo, stream_url: url, year, genre, status: 'published', type, kids };
        entries.push(e);
      }
    }
    const movies = entries.filter(e => e.type === 'movie');
    const rawSeries = entries.filter(e => e.type === 'series');
    // Consolidar episódios da mesma série em uma única entrada
    const series = consolidateSeriesEpisodes(rawSeries);
    return { movies, series };
  };
  const parseJSONText = (text: string) => {
    let obj: any;
    try { obj = JSON.parse(text); } catch { return { movies: [], series: [] }; }
    const arrMovies = Array.isArray(obj) ? obj.filter((x: any) => classifyType(x.title || '') === 'movie') : (obj.movies || []);
    const arrSeries = Array.isArray(obj) ? obj.filter((x: any) => classifyType(x.title || '') === 'series') : (obj.series || []);
    const normalizeItem = (x: any, type: 'movie' | 'series') => {
      const genre = Array.isArray(x.genre) ? x.genre : [];
      const kids = isKidsContent(x.title || '', x.platform || '');
      if (kids && !genre.includes('Infantil')) genre.push('Infantil');
      return {
        title: x.title || 'Sem Título',
        description: x.description || '',
        poster: x.poster || '',
        backdrop: x.backdrop || '',
        logo_url: x.logo_url || '',
        stream_url: x.stream_url || '',
        year: x.year || extractYear(x.title || ''),
        genre,
        status: 'published',
        type,
        kids
      };
    };
    const movies = arrMovies.map((x: any) => normalizeItem(x, 'movie'));
    const rawSeries = arrSeries.map((x: any) => normalizeItem(x, 'series'));
    // Consolidar episódios da mesma série em uma única entrada
    const series = consolidateSeriesEpisodes(rawSeries);
    return { movies, series };
  };
  const applyParsedResult = (result: { movies: any[]; series: any[] }) => {
    setPreviewMovies(result.movies || []);
    setPreviewSeries(result.series || []);
    setImportFilterType('Todos');
    setImportFilterKids('Todos');
    setImportFilterYearMin(1900);
    setImportFilterYearMax(2030);
    setImportFilterGroup('Todos');
    setImportFilterGenre('Todos');
    setImportFilterSearch('');
    // Iniciar sem seleção — o usuário escolhe o que quer
    setSelectedPreview({ movies: new Set(), series: new Set() });
    setImportProgress({ step: 'Pronto para inserir', logs: [], movies: result.movies.length, series: result.series.length });
  };

  const handleImportParse = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportProgress({ step: 'Lendo arquivo', logs: [`📄 Arquivo: ${importFile.name} (${formatBytes(importFile.size)})`, '⏳ Lendo conteúdo do arquivo...'], movies: 0, series: 0 });
    try {
      const text = await importFile.text();
      if (!text || text.length < 5) {
        setImportProgress({ step: '', logs: ['❌ Arquivo vazio ou inválido. Verifique se o arquivo contém dados.'], movies: 0, series: 0 });
        setImporting(false);
        return;
      }
      setImportProgress(prev => ({ ...prev, logs: [...prev.logs, `✅ Arquivo lido (${formatBytes(text.length)})`, '🔍 Analisando conteúdo...'] }));
      const isM3U = importFile.name.toLowerCase().endsWith('.m3u') || importFile.name.toLowerCase().endsWith('.m3u8') || text.trimStart().replace(/^\uFEFF/, '').startsWith('#EXTM3U');
      // Usar setTimeout para liberar a UI antes do parse pesado
      await new Promise(resolve => setTimeout(resolve, 50));
      const result = isM3U ? parseM3UText(text) : parseJSONText(text);
      if (result.movies.length === 0 && result.series.length === 0) {
        setImportProgress({ step: '', logs: [`📄 Arquivo: ${importFile.name}`, `⚠️ Nenhum conteúdo VOD encontrado no arquivo.`, isM3U ? '💡 Dica: Verifique se o M3U contém entradas #EXTINF com URLs válidas.' : '💡 Dica: O JSON deve ter formato { movies: [...], series: [...] } ou um array de itens.'], movies: 0, series: 0 });
        setImporting(false);
        return;
      }
      setImportProgress(prev => ({ ...prev, logs: [...prev.logs, `📋 Encontrados: ${result.movies.length} filmes e ${result.series.length} séries`] }));
      applyParsedResult(result);
      setImporting(false);
    } catch (error: any) {
      console.error('Erro ao processar arquivo:', error);
      setImportProgress({ step: '', logs: [`❌ Erro ao processar arquivo: ${error?.message || 'Erro desconhecido'}`, '💡 Dica: Verifique se o arquivo está em formato UTF-8 e não está corrompido.'], movies: 0, series: 0 });
      setImporting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleImportFromUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setFetchingUrl(true);
    setImporting(true);
    setDownloadProgress({ loaded: 0, total: 0, phase: 'Conectando...' });
    setImportProgress({ step: 'Baixando lista da URL...', logs: ['⏳ Conectando a ' + url], movies: 0, series: 0 });
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} — ${response.statusText}`);

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      setDownloadProgress({ loaded: 0, total: contentLength, phase: 'Baixando...' });
      setImportProgress(prev => ({ ...prev, logs: [...prev.logs, '📥 Download iniciado' + (contentLength ? ` (${formatBytes(contentLength)})` : '')] }));

      let text = '';
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let loaded = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          loaded += value.length;
          text += decoder.decode(value, { stream: true });
          setDownloadProgress({ loaded, total: contentLength, phase: 'Baixando...' });
        }
        text += decoder.decode();
      } else {
        text = await response.text();
      }

      if (!text || text.length < 10) throw new Error('Resposta vazia ou inválida.');

      setDownloadProgress(prev => ({ ...prev, phase: 'Processando lista...' }));
      setImportProgress(prev => ({ ...prev, logs: [...prev.logs, `✅ Download concluído (${formatBytes(text.length)})`, '🔍 Analisando conteúdo...'] }));

      const isM3U = url.toLowerCase().includes('m3u') || text.trimStart().startsWith('#EXTM3U');
      const result = isM3U ? parseM3UText(text) : parseJSONText(text);

      if (result.movies.length === 0 && result.series.length === 0) {
        setDownloadProgress({ loaded: 0, total: 0, phase: '' });
        setImportProgress({ step: '', logs: ['⚠️ Nenhum conteúdo encontrado na lista. Verifique se a URL está correta.'], movies: 0, series: 0 });
      } else {
        setDownloadProgress({ loaded: 0, total: 0, phase: '' });
        setImportProgress(prev => ({ ...prev, logs: [...prev.logs, `📋 Encontrados: ${result.movies.length} filmes e ${result.series.length} séries`] }));
        applyParsedResult(result);
      }
    } catch (error: any) {
      const msg = error.message || 'Erro desconhecido';
      const isCors = msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS');
      setDownloadProgress({ loaded: 0, total: 0, phase: '' });
      setImportProgress({
        step: '',
        logs: [isCors
          ? '❌ Erro de CORS — O servidor bloqueou a requisição do navegador. Baixe o arquivo .m3u manualmente e use a aba "Upload de Arquivo".'
          : `❌ Erro ao baixar: ${msg}`],
        movies: 0,
        series: 0
      });
    } finally {
      setFetchingUrl(false);
      setImporting(false);
    }
  };

  // Dados extraídos da lista para popular os filtros
  const importAllItems = [...previewMovies.map((m: any, idx: number) => ({ ...m, _kind: 'movies' as const, _idx: idx })), ...previewSeries.map((s: any, idx: number) => ({ ...s, _kind: 'series' as const, _idx: idx }))];
  const importAvailableYears = Array.from(new Set(importAllItems.map(i => i.year).filter((y: any) => typeof y === 'number' && y > 1900))).sort((a, b) => b - a);
  const importAvailableGroups = Array.from(new Set(importAllItems.map(i => i.platform || i.group || '').filter(Boolean))).sort();
  const importAvailableGenres = Array.from(new Set(importAllItems.flatMap(i => Array.isArray(i.genre) ? i.genre : []).filter(Boolean))).sort();
  const importMinYear = importAvailableYears.length > 0 ? importAvailableYears[importAvailableYears.length - 1] : 1900;
  const importMaxYear = importAvailableYears.length > 0 ? importAvailableYears[0] : 2030;
  const importKidsCount = importAllItems.filter(i => i.kids).length;

  // Aplicar filtros na lista
  const filteredImportItems = importAllItems.filter(item => {
    if (importFilterType !== 'Todos' && item.type !== importFilterType) return false;
    if (importFilterKids === 'kids' && !item.kids) return false;
    if (importFilterKids === 'adult' && item.kids) return false;
    if (item.year && item.year < importFilterYearMin) return false;
    if (item.year && item.year > importFilterYearMax) return false;
    if (importFilterGroup !== 'Todos') {
      const itemGroup = item.platform || item.group || '';
      if (itemGroup !== importFilterGroup) return false;
    }
    if (importFilterGenre !== 'Todos') {
      if (!Array.isArray(item.genre) || !item.genre.includes(importFilterGenre)) return false;
    }
    if (importFilterSearch) {
      const search = importFilterSearch.toLowerCase();
      if (!item.title.toLowerCase().includes(search)) return false;
    }
    return true;
  });

  const filteredImportMovies = filteredImportItems.filter(i => i._kind === 'movies');
  const filteredImportSeries = filteredImportItems.filter(i => i._kind === 'series');

  // Selecionar/deselecionar todos os filtrados
  const selectAllFiltered = () => {
    const newMovies = new Set(selectedPreview.movies);
    const newSeries = new Set(selectedPreview.series);
    filteredImportItems.forEach(i => {
      if (i._kind === 'movies') newMovies.add(i._idx);
      else newSeries.add(i._idx);
    });
    setSelectedPreview({ movies: newMovies, series: newSeries });
  };
  const deselectAllFiltered = () => {
    const newMovies = new Set(selectedPreview.movies);
    const newSeries = new Set(selectedPreview.series);
    filteredImportItems.forEach(i => {
      if (i._kind === 'movies') newMovies.delete(i._idx);
      else newSeries.delete(i._idx);
    });
    setSelectedPreview({ movies: newMovies, series: newSeries });
  };
  const selectOnlyFiltered = () => {
    const newMovies = new Set<number>();
    const newSeries = new Set<number>();
    filteredImportItems.forEach(i => {
      if (i._kind === 'movies') newMovies.add(i._idx);
      else newSeries.add(i._idx);
    });
    setSelectedPreview({ movies: newMovies, series: newSeries });
  };
  const togglePreviewSelect = (kind: 'movies' | 'series', idx: number) => {
    setSelectedPreview(prev => {
      const next = new Set(prev[kind]);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return { ...prev, [kind]: next };
    });
  };
  // Extrair apenas colunas válidas do banco para insert
  const sanitizeForDB = (item: any, table: 'movies' | 'series') => {
    const movieCols = ['title', 'description', 'poster', 'backdrop', 'logo_url', 'stream_url', 'year', 'genre', 'rating', 'duration', 'tmdb_id', 'stars', 'trailer_key', 'status'];
    const seriesCols = ['title', 'description', 'poster', 'backdrop', 'logo_url', 'stream_url', 'year', 'genre', 'rating', 'seasons', 'tmdb_id', 'stars', 'trailer_key', 'status'];
    const validCols = table === 'movies' ? movieCols : seriesCols;
    const clean: Record<string, any> = {};
    for (const col of validCols) {
      if (item[col] !== undefined && item[col] !== '') {
        clean[col] = item[col];
      }
    }
    // Garantir campos obrigatórios
    if (!clean.title) clean.title = 'Sem Título';
    // Remover campos internos de consolidação (não existem no DB)
    delete clean._episodeCount;
    delete clean._episodes;
    delete clean.kids;
    delete clean._kind;
    delete clean._idx;
    return clean;
  };

  const handleImportInsert = async () => {
    setImporting(true);
    setImportProgress(prev => ({ ...prev, step: 'Enriquecendo com TMDB...', logs: [] }));
    const rawMovies = previewMovies
      .filter((_, idx) => selectedPreview.movies.has(idx));
    const rawSeries = previewSeries
      .filter((_, idx) => selectedPreview.series.has(idx));
    const logs: string[] = [];

    // === FASE 1: Enriquecer com TMDB (buscar poster/backdrop/tmdb_id) ===
    const enrichItem = async (item: any, type: 'movie' | 'series'): Promise<any> => {
      // Se já tem poster TMDB, pula
      if (item.poster && item.poster.includes('tmdb.org') && item.tmdb_id) return item;
      try {
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        const READ_TOKEN = (import.meta as any).env?.VITE_TMDB_READ_TOKEN;
        const searchRes = await fetch(
          `https://api.themoviedb.org/3/search/${endpoint}?query=${encodeURIComponent(item.title)}&language=pt-BR&page=1`,
          { headers: { accept: 'application/json', Authorization: `Bearer ${READ_TOKEN}` } }
        );
        if (!searchRes.ok) return item;
        const searchData = await searchRes.json();
        const match = searchData.results?.[0];
        if (!match) return item;

        return {
          ...item,
          tmdb_id: match.id,
          poster: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : item.poster,
          backdrop: match.backdrop_path ? `https://image.tmdb.org/t/p/original${match.backdrop_path}` : item.backdrop,
          description: item.description || match.overview || '',
          year: item.year || new Date(match.release_date || match.first_air_date || '').getFullYear() || undefined,
          rating: match.vote_average?.toFixed(1) || item.rating,
          genre: (item.genre?.length > 0) ? item.genre : (match.genre_ids || []).map((id: number) => {
            const map: Record<number, string> = {28:'Ação',12:'Aventura',16:'Animação',35:'Comédia',80:'Crime',99:'Documentário',18:'Drama',10751:'Família',14:'Fantasia',36:'História',27:'Terror',10402:'Música',9648:'Mistério',10749:'Romance',878:'Ficção Científica',53:'Suspense',10752:'Guerra',37:'Faroeste',10759:'Ação & Aventura',10765:'Sci-Fi & Fantasia',10766:'Novela'};
            return map[id] || 'Outros';
          }),
        };
      } catch {
        return item;
      }
    };

    // Enriquecer em lotes de 8 (rate limit TMDB)
    const enrichBatch = async (items: any[], type: 'movie' | 'series', label: string) => {
      const enriched: any[] = [];
      const batchSize = 8;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(item => enrichItem(item, type)));
        results.forEach(r => {
          if (r.status === 'fulfilled') enriched.push(r.value);
        });
        const pct = Math.min(100, Math.round(((i + batchSize) / items.length) * 100));
        setImportProgress(prev => ({ ...prev, logs: [`\u2728 Enriquecendo ${label}: ${pct}% (${Math.min(i + batchSize, items.length)}/${items.length})`] }));
        // Pausa entre lotes para não bater rate limit
        if (i + batchSize < items.length) await new Promise(r => setTimeout(r, 300));
      }
      return enriched;
    };

    let enrichedMovies = rawMovies;
    let enrichedSeries = rawSeries;

    if (rawMovies.length > 0) {
      logs.push(`\u2728 Enriquecendo ${rawMovies.length} filmes com TMDB...`);
      setImportProgress(prev => ({ ...prev, logs: [...logs] }));
      enrichedMovies = await enrichBatch(rawMovies, 'movie', 'filmes');
      const withPoster = enrichedMovies.filter(m => m.poster && m.poster.includes('tmdb.org')).length;
      logs.push(`\u2705 Filmes enriquecidos: ${withPoster}/${enrichedMovies.length} com imagens TMDB`);
    }
    if (rawSeries.length > 0) {
      logs.push(`\u2728 Enriquecendo ${rawSeries.length} séries com TMDB...`);
      setImportProgress(prev => ({ ...prev, logs: [...logs] }));
      enrichedSeries = await enrichBatch(rawSeries, 'series', 'séries');
      const withPoster = enrichedSeries.filter(s => s.poster && s.poster.includes('tmdb.org')).length;
      logs.push(`\u2705 Séries enriquecidas: ${withPoster}/${enrichedSeries.length} com imagens TMDB`);
    }

    // === FASE 2: Sanitizar e inserir no banco ===
    setImportProgress(prev => ({ ...prev, step: 'Inserindo no banco...', logs: [...logs, '\ud83d\udcbe Inserindo conteúdo no Supabase...'] }));

    const moviesToInsert = enrichedMovies.map(x => sanitizeForDB(x, 'movies'));
    const seriesToInsert = enrichedSeries.map(x => sanitizeForDB(x, 'series'));

    // Garantir status published
    moviesToInsert.forEach(m => { if (!m.status) m.status = 'published'; });
    seriesToInsert.forEach(s => { if (!s.status) s.status = 'published'; });

    // Inserir filmes em lotes de 50
    if (moviesToInsert.length > 0) {
      let insertedMovies = 0;
      // Separar itens COM tmdb_id (upsert) e SEM tmdb_id (insert direto)
      const moviesWithTmdb = moviesToInsert.filter(m => m.tmdb_id && m.tmdb_id > 0);
      const moviesWithoutTmdb = moviesToInsert.filter(m => !m.tmdb_id || m.tmdb_id <= 0);

      // Upsert filmes COM tmdb_id
      for (let i = 0; i < moviesWithTmdb.length; i += 50) {
        const batch = moviesWithTmdb.slice(i, i + 50);
        const { error } = await supabase.from('movies').upsert(batch, { onConflict: 'tmdb_id', ignoreDuplicates: true });
        if (error) {
          let batchInserted = 0;
          for (const item of batch) {
            const { error: singleErr } = await supabase.from('movies').insert([item]);
            if (!singleErr) batchInserted++;
          }
          insertedMovies += batchInserted;
          if (batchInserted > 0) logs.push(`⚠️ Filmes (tmdb) lote ${Math.floor(i/50)+1}: ${batchInserted}/${batch.length}`);
        } else {
          insertedMovies += batch.length;
        }
      }
      // Insert filmes SEM tmdb_id (insert individual para evitar erro de unique constraint)
      for (const item of moviesWithoutTmdb) {
        delete item.tmdb_id; // Remover tmdb_id null/0 para não conflitar
        const { error } = await supabase.from('movies').insert([item]);
        if (!error) insertedMovies++;
      }

      setImportProgress(prev => ({ ...prev, logs: [...logs], movies: insertedMovies }));
      if (insertedMovies > 0) logs.push(`✅ Filmes inseridos: ${insertedMovies}`);
    }

    // Inserir séries em lotes de 50
    if (seriesToInsert.length > 0) {
      let insertedSeries = 0;
      const seriesWithTmdb = seriesToInsert.filter(s => s.tmdb_id && s.tmdb_id > 0);
      const seriesWithoutTmdb = seriesToInsert.filter(s => !s.tmdb_id || s.tmdb_id <= 0);

      for (let i = 0; i < seriesWithTmdb.length; i += 50) {
        const batch = seriesWithTmdb.slice(i, i + 50);
        const { error } = await supabase.from('series').upsert(batch, { onConflict: 'tmdb_id', ignoreDuplicates: true });
        if (error) {
          let batchInserted = 0;
          for (const item of batch) {
            const { error: singleErr } = await supabase.from('series').insert([item]);
            if (!singleErr) batchInserted++;
          }
          insertedSeries += batchInserted;
          if (batchInserted > 0) logs.push(`⚠️ Séries (tmdb) lote ${Math.floor(i/50)+1}: ${batchInserted}/${batch.length}`);
        } else {
          insertedSeries += batch.length;
        }
      }
      for (const item of seriesWithoutTmdb) {
        delete item.tmdb_id;
        const { error } = await supabase.from('series').insert([item]);
        if (!error) insertedSeries++;
      }

      setImportProgress(prev => ({ ...prev, logs: [...logs], series: insertedSeries }));
      if (insertedSeries > 0) logs.push(`✅ Séries inseridas: ${insertedSeries}`);
    }

    if (moviesToInsert.length === 0 && seriesToInsert.length === 0) {
      logs.push('⚠️ Nenhum item selecionado para inserir.');
    }

    setImportProgress(prev => ({ ...prev, step: 'Finalizado', logs }));
    await loadData();
    setImporting(false);
  };
  // Batch upload
  const handleBatchUpload = async () => {
    if (batchFiles.length === 0) return;
    setUploadingBatch(true);
    setBatchProgress({ processed: 0, total: batchFiles.length, logs: [], matched: 0 });
    setBatchResults([]);
    const logs: string[] = [];
    let processed = 0;
    let matched = 0;

    const normalizeString = (s: string) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/gi, ' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const tokenize = (s: string) => normalizeString(s).split(' ').filter(Boolean);
    const jaccard = (a: string[], b: string[]) => {
      const A = new Set(a);
      const B = new Set(b);
      const inter = [...A].filter(x => B.has(x)).length;
      const union = new Set([...a, ...b]).size;
      return union === 0 ? 0 : inter / union;
    };

    const findBestMatch = (query: string, candidates: Media[]) => {
      const qNorm = normalizeString(query);
      const qTokens = tokenize(query);
      let best: { item: Media; score: number } | null = null;
      for (const it of candidates) {
        const titleNorm = normalizeString(it.title || '');
        const titleTokens = tokenize(it.title || '');

        // Calcular múltiplos scores e pegar o melhor
        const jaccardScore = jaccard(qTokens, titleTokens);
        const containsScore = titleNorm.includes(qNorm) || qNorm.includes(titleNorm) ? 0.7 : 0;

        // Score por tokens em comum (mais flexível que Jaccard)
        const commonTokens = qTokens.filter(t => titleTokens.includes(t)).length;
        const tokenRatio = qTokens.length > 0 ? commonTokens / Math.max(qTokens.length, titleTokens.length) : 0;

        const score = Math.max(jaccardScore, containsScore, tokenRatio);
        if (!best || score > best.score) best = { item: it, score };
      }
      if (best && best.score >= 0.40) return best.item;
      return null;
    };

    for (const originalFile of batchFiles) {
      let file = originalFile;
      try {
        if (typeof window !== 'undefined' && isConvertibleImage(file)) {
          try {
            logs.push(`Convertendo ${file.name} para WebP...`);
            file = await convertToWebP(file);
          } catch (err) {
            console.warn('Falha conversão WebP, usando original', err);
            logs.push(`Falha ao converter ${file.name}, usando original.`);
          }
        } else if ((file.type || '').toLowerCase() === 'image/webp' || file.name.toLowerCase().endsWith('.webp')) {
          logs.push(`Imagem ${file.name} já em WEBP, pulando conversão.`);
        }

        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        const cleanName = nameWithoutExt.replace(/[-_]/g, ' ').trim();

        let imageType: 'poster' | 'backdrop' | 'logo' = 'poster';
        let searchName = cleanName;

        if (/backdrop|horizontal|fanart/i.test(cleanName)) {
          imageType = 'backdrop';
          searchName = cleanName.replace(/backdrop|horizontal|fanart/gi, '').trim();
        } else if (/logo|clearart/i.test(cleanName)) {
          imageType = 'logo';
          searchName = cleanName.replace(/logo|clearart/gi, '').trim();
        } else if (/poster|vertical/i.test(cleanName)) {
          imageType = 'poster';
          searchName = cleanName.replace(/poster|vertical/gi, '').trim();
        } else if (typeof window !== 'undefined') {
          // measure dimensions
          try {
            const dims = await new Promise<{ width: number; height: number }>((res, rej) => {
              const img = new Image();
              img.onload = () => res({ width: img.width, height: img.height });
              img.onerror = rej;
              img.src = URL.createObjectURL(file);
            });
            imageType = dims.width > dims.height ? 'backdrop' : 'poster';
          } catch (e) {
            // fallback poster
            imageType = 'poster';
          }
        }

        // find match (flexível PT/EN)
        let match = findBestMatch(searchName, items) || findBestMatch(cleanName, items);

        if (!match) {
          // fallback TMDB: busca em pt-BR e en-US, cruza tmdb_id com catálogo
          try {
            const results = await searchAnyLang(searchName);
            if (results && results.length > 0) {
              // Primeiro: verificar se algum resultado do TMDB tem tmdb_id que existe no catálogo
              for (const r of results) {
                const tmdbId = r.id;
                const type = r.media_type === 'tv' ? 'series' : 'movie';
                const foundById = items.find(i => i.tmdb_id === tmdbId);
                if (foundById) {
                  match = foundById;
                  logs.push(`✅ Match via TMDB ID: "${foundById.title}" (tmdb_id: ${tmdbId})`);
                  break;
                }
              }
              // Segundo: se não achou por tmdb_id, tenta por título do resultado TMDB
              if (!match) {
                for (const r of results.slice(0, 5)) {
                  const tmdbTitle = r.title || r.name || '';
                  const foundByTitle = findBestMatch(tmdbTitle, items);
                  if (foundByTitle) {
                    match = foundByTitle;
                    logs.push(`✅ Match via TMDB título: "${foundByTitle.title}" (buscou: "${tmdbTitle}")`);
                    break;
                  }
                }
              }
              if (!match) {
                logs.push(`⚠️ TMDB retornou resultados mas nenhum corresponde ao catálogo local: "${searchName}"`);
              }
            } else {
              logs.push(`⚠️ Não encontrado no TMDB: "${searchName}" (arquivo: ${file.name})`);
            }
          } catch (e) {
            console.warn('Falha na busca TMDB fallback:', e);
            logs.push(`❌ Falha TMDB ao buscar "${searchName}"`);
          }
        }

        if (!match) {
          setBatchResults(prev => [...prev, { fileName: file.name, imageType, status: 'nao_encontrado' }]);
          await insertImageUpdate({ media_id: 'unknown', media_type: 'movie', image_type: imageType, file_name: file.name, status: 'nao_encontrado' });
        } else if (match) {
          logs.push(`Encontrado: "${match.title}" (ID: ${match.id})`);
          matched++;
          const bucket = imageType === 'logo' ? 'logos' : imageType === 'backdrop' ? 'backdrops' : 'posters';
          const publicUrl = await uploadImage(file, bucket);
          if (!publicUrl) {
            logs.push(`Erro no upload de ${file.name}`);
            setBatchResults(prev => [...prev, { fileName: file.name, imageType, matchedId: String(match.id), matchedTitle: match.title, status: 'upload_erro' }]);
            await insertImageUpdate({ media_id: String(match.id), media_type: match.type, image_type: imageType, file_name: file.name, status: 'upload_erro' });
          } else {
            const updates: any = {};
            if (imageType === 'poster') updates.poster = publicUrl;
            if (imageType === 'backdrop') updates.backdrop = publicUrl;
            if (imageType === 'logo') updates.logo_url = publicUrl;

            let success = false;
            if (match.type === 'movie') {
              const res = await updateMovie(match.id, updates);
              success = !!res;
            } else {
              const res = await updateSeries(match.id, updates);
              success = !!res;
            }

            if (success) {
              logs.push(`Imagem ${imageType} atualizada com sucesso para "${match.title}"`);
              setItems(prev => prev.map(i => i.id === match.id ? { ...i, ...updates } : i));
              setBatchResults(prev => [...prev, { fileName: file.name, imageType, matchedId: String(match.id), matchedTitle: match.title, status: 'atualizado', url: publicUrl }]);
              await insertImageUpdate({ media_id: String(match.id), media_type: match.type, image_type: imageType, file_name: file.name, storage_url: publicUrl, status: 'atualizado' });
            } else {
              logs.push(`Erro ao atualizar registro para "${match.title}"`);
              setBatchResults(prev => [...prev, { fileName: file.name, imageType, matchedId: String(match.id), matchedTitle: match.title, status: 'update_erro', url: publicUrl }]);
              await insertImageUpdate({ media_id: String(match.id), media_type: match.type, image_type: imageType, file_name: file.name, storage_url: publicUrl, status: 'update_erro' });
            }
          }
        }
      } catch (err) {
        console.error('Erro no processamento batch:', err);
        logs.push(`Erro crítico processando ${originalFile.name}`);
        setBatchResults(prev => [...prev, { fileName: originalFile.name, imageType: 'poster', status: 'upload_erro' }]);
      } finally {
        processed++;
        setBatchProgress(prev => ({ ...prev, processed, matched, logs: [...logs] }));
      }
    }

    setUploadingBatch(false);
  };

  // Edit handlers
  const handleEdit = (item: Media) => {
    setEditingItem(item);
    setEditForm({
      title: item.title || '',
      description: item.description || '',
      poster: item.poster || '',
      backdrop: item.backdrop || '',
      logo_url: item.logo_url || '',
      stream_url: item.stream_url || '',
      trailer_url: (item as any).trailer_url || '',
      use_trailer: (item as any).use_trailer || false,
      platform: item.platform || '',
      status: item.status || 'published'
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    try {
      let success = false;
      if (deletingItem.type === 'movie') {
        success = await deleteMovie(deletingItem.id);
      } else {
        success = await deleteSeries(deletingItem.id);
      }

      if (success) {
        setItems(prev => prev.filter(i => i.id !== deletingItem.id));
        setStats(prev => ({
          movies: deletingItem.type === 'movie' ? Math.max(0, prev.movies - 1) : prev.movies,
          series: deletingItem.type === 'series' ? Math.max(0, prev.series - 1) : prev.series
        }));
        setDeletingItem(null);
      } else {
        alert('Erro ao excluir item. Verifique o console.');
      }
    } catch (error) {
      console.error('Erro crítico ao excluir:', error);
      alert('Erro crítico ao excluir.');
    }
  };

  const handleSave = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const updates = {
        title: editForm.title,
        description: editForm.description,
        poster: editForm.poster,
        backdrop: editForm.backdrop,
        logo_url: editForm.logo_url,
        stream_url: editForm.stream_url,
        trailer_url: editForm.trailer_url,
        use_trailer: editForm.use_trailer,
        platform: editForm.platform,
        status: editForm.status
      };

      let updated = null;
      if (editingItem.type === 'movie') {
        updated = await updateMovie(editingItem.id, updates);
      } else {
        updated = await updateSeries(editingItem.id, updates);
      }

      if (updated) {
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...updates } : i));
        setEditingItem(null);
      } else {
        alert('Falha ao salvar alterações. Veja console.');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  // Filtragem
  const filteredItems = items.filter(item => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q || (item.title || '').toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q);
    const matchesType = filterType === 'Todos' || item.type === filterType;
    const matchesYear = filterYear === 'Todos' || (item.year?.toString() === filterYear);
    const matchesPlatform = filterPlatform === 'Todos' || item.platform === filterPlatform;
    const matchesStatus = filterStatus === 'Todos' || (item.status || 'published') === filterStatus;
    const matchesGenre = filterGenre === 'Todos' || (item.genre || []).includes(filterGenre);
    return matchesSearch && matchesType && matchesYear && matchesPlatform && matchesStatus && matchesGenre;
  });

  const years = Array.from(new Set(items.map(i => i.year).filter(Boolean))).sort((a, b) => (b as number) - (a as number));
  const platforms = Array.from(new Set(items.map(i => i.platform).filter(Boolean))).sort();
  const genres = Array.from(new Set(items.flatMap(i => i.genre || []).filter(Boolean))).sort();

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredItems.map(i => i.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Tem certeza que deseja excluir ${selectedIds.size} itens selecionados? Esta ação é irreversível.`)) return;

    setLoading(true);
    try {
      // Split by type for efficiency if needed, or just iterate. 
      // Optimized: group by type
      const ids = Array.from(selectedIds);
      const itemsToDelete = items.filter(i => selectedIds.has(i.id));
      const moviesToDelete = itemsToDelete.filter(i => i.type === 'movie').map(i => i.id);
      const seriesToDelete = itemsToDelete.filter(i => i.type === 'series').map(i => i.id);

      // We can use the existing delete functions in loop or bulk if available. 
      // Currently supabaseService has deleteMovie/deleteSeries single. 
      // Let's use a loop or Promise.all for now as it's safer without backend change, 
      // but ideally we should have bulkDelete in service. 
      // Wait, I previously added `batchDeleteContent` but that was by filter. 
      // Let's add a quick loop here, it's fine for "management" quantity (hundreds). 
      // For thousands, we'd want a `in` query.

      // Let's use supabase directly for `in` delete to be efficient
      if (moviesToDelete.length > 0) {
        await supabase.from('movies').delete().in('id', moviesToDelete);
      }
      if (seriesToDelete.length > 0) {
        await supabase.from('series').delete().in('id', seriesToDelete);
      }

      // Update local state
      setItems(prev => prev.filter(i => !selectedIds.has(i.id)));
      setStats(prev => ({
        movies: prev.movies - moviesToDelete.length,
        series: prev.series - seriesToDelete.length
      }));
      setSelectedIds(new Set());
      alert('Itens excluídos com sucesso.');

    } catch (error) {
      console.error('Erro na exclusão em massa:', error);
      alert('Erro ao excluir itens. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">Catálogo VOD</h1>
            <p className="text-white/60 mt-1">Gerencie filmes, séries e metadados.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowCreateModal(true)} className="px-6 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all flex items-center gap-2">
              <Plus size={18} /> Novo Conteúdo
            </button>
            <button onClick={() => setShowBatchUpload(true)} className="px-6 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex items-center gap-2">
              <Upload size={18} /> Upload em Massa
            </button>
            <button onClick={() => setShowImportUpload(true)} className="px-6 py-3 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white transition-all flex items-center gap-2">
              <Upload size={18} /> Importar M3U/JSON
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#121217] p-4 rounded-2xl border border-white/5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Total Filmes</p>
            <p className="text-2xl font-bold text-white">{loading ? '...' : stats.movies.toLocaleString()}</p>
          </div>
          <div className="bg-[#121217] p-4 rounded-2xl border border-white/5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Total Séries</p>
            <p className="text-2xl font-bold text-white">{loading ? '...' : stats.series.toLocaleString()}</p>
          </div>
          <div className="bg-[#121217] p-4 rounded-2xl border border-white/5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-500">0</p>
          </div>
          <div className="bg-[#121217] p-4 rounded-2xl border border-white/5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Erros TMDB</p>
            <p className="text-2xl font-bold text-red-500">0</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#121217] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar título..." className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm">
              <option value="Todos">Tipo: Todos</option>
              <option value="movie">Filmes</option>
              <option value="series">Séries</option>
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm">
              <option value="Todos">Ano: Todos</option>
              {years.map(year => <option key={year as any} value={year as any}>{year}</option>)}
            </select>
            <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm">
              <option value="Todos">Plataforma: Todas</option>
              {platforms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm">
              <option value="Todos">Gênero: Todos</option>
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm">
              <option value="Todos">Status: Todos</option>
              <option value="published">Publicados</option>
              <option value="draft">Rascunhos</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar - Shows when items are selected */}
        {selectedIds.size > 0 && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-2 fade-in">
            <div className="flex items-center gap-3">
              <div className="bg-red-500 text-white font-bold w-8 h-8 rounded-lg flex items-center justify-center text-sm">
                {selectedIds.size}
              </div>
              <span className="text-white font-medium">Itens selecionados</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <Trash2 size={16} /> Excluir Selecionados
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-[#121217] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      className="rounded border-white/20 bg-black/20 text-red-600 focus:ring-offset-0 focus:ring-red-500"
                    />
                  </th>
                  <th className="px-6 py-4">Mídia</th>
                  <th className="px-6 py-4">Título</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Ano</th>
                  <th className="px-6 py-4">Rating</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8">Carregando...</td></tr>
                ) : filteredItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-white/5 transition-colors group ${selectedIds.has(item.id) ? 'bg-white/5' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => handleSelect(item.id)}
                        className="rounded border-white/20 bg-black/20 text-red-600 focus:ring-offset-0 focus:ring-red-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-16 h-[5.6rem] bg-white/10 rounded overflow-hidden relative group-hover:scale-105 transition-transform duration-300">
                        {item.poster ? <img src={item.poster} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/20">Sem Imagem</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold">{item.title}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`flex items-center gap-2 text-xs font-bold px-2 py-1 rounded-md w-fit ${item.type === 'movie' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          {item.type === 'movie' ? <Film size={12} /> : <Tv size={12} />}
                          {item.type === 'movie' ? 'Filme' : 'Série'}
                        </span>
                        {item.platform && <span className="text-[10px] text-white/40 uppercase tracking-widest">{item.platform}</span>}
                        <span className={`text-[10px] uppercase font-bold ${item.status === 'draft' ? 'text-yellow-500' : 'text-green-500'}`}>{item.status === 'draft' ? 'Rascunho' : 'Publicado'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/60">{item.year || '-'}</td>
                    <td className="px-6 py-4 flex items-center gap-1 text-yellow-500 font-bold"><Star size={12} fill="currentColor" /> {item.rating ?? '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(item)} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white" title="Editar"><Edit2 size={16} /></button>
                        <button onClick={() => setDeletingItem(item)} className="p-2 hover:bg-red-500/20 rounded-lg text-white/60 hover:text-red-500" title="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Batch Upload Modal */}
        {showBatchUpload && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a20] w-full max-w-3xl rounded-2xl border border-white/10 shadow-2xl p-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Upload className="text-blue-500" /> Upload Inteligente em Massa</h3>
              <p className="text-white/40 text-sm mb-6">Arraste várias imagens de uma vez. O sistema identificará automaticamente se é Poster (Vertical) ou Backdrop (Horizontal) e associará ao filme correto pelo nome do arquivo.</p>

              {!uploadingBatch && batchProgress.processed === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-12 bg-black/20 mb-6">
                  <Upload size={48} className="text-white/20 mb-4" />
                  <p className="text-lg font-bold text-white/60 mb-2">Arraste seus arquivos aqui</p>
                  <p className="text-sm text-white/40 mb-6">ou clique para selecionar</p>
                  <input id="batch-file-input" type="file" multiple accept="image/*" onChange={(e) => e.target.files && setBatchFiles(Array.from(e.target.files))} className="hidden" />
                  <label htmlFor="batch-file-input" className="px-6 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">Selecionar Imagens</label>
                  {batchFiles.length > 0 && <div className="mt-4 text-center"><p className="font-bold text-green-400">{batchFiles.length} arquivos selecionados</p></div>}
                </div>
              )}

              {(uploadingBatch || batchProgress.processed > 0) && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2 font-bold"><span>Processando...</span><span>{batchProgress.processed} / {batchProgress.total}</span></div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${batchProgress.total ? (batchProgress.processed / batchProgress.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="flex-1 bg-black/40 rounded-xl p-4 overflow-y-auto font-mono text-xs space-y-2 border border-white/5 max-h-[300px]">
                    {batchProgress.logs.length === 0 ? <p className="text-center text-white/20 py-8">Aguardando início...</p> : batchProgress.logs.map((log, i) => <div key={i} className="p-2 rounded text-white/80">{log}</div>)}
                  </div>
                  {batchProgress.processed > 0 && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-[#121217] p-4 rounded-2xl border border-white/5">
                          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Encontrados</p>
                          <p className="text-2xl font-bold text-white">{batchResults.filter(r => r.status !== 'nao_encontrado').length}</p>
                        </div>
                        <div className="bg-[#121217] p-4 rounded-2xl border border-white/5">
                          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Atualizados</p>
                          <p className="text-2xl font-bold text-green-500">{batchResults.filter(r => r.status === 'atualizado').length}</p>
                        </div>
                        <div className="bg-[#121217] p-4 rounded-2xl border border-white/5">
                          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Não encontrados</p>
                          <p className="text-2xl font-bold text-yellow-500">{batchResults.filter(r => r.status === 'nao_encontrado').length}</p>
                        </div>
                        <div className="bg-[#121217] p-4 rounded-2xl border border-white/5">
                          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Erros</p>
                          <p className="text-2xl font-bold text-red-500">{batchResults.filter(r => r.status === 'upload_erro' || r.status === 'update_erro').length}</p>
                        </div>
                      </div>
                      {batchProgress.processed === batchProgress.total && batchResults.length > 0 && (
                        <div className="bg-[#121217] border border-white/5 rounded-2xl">
                          <div className="flex items-center justify-between p-4">
                            <p className="text-xs uppercase tracking-widest text-white/40">Resumo</p>
                            <div className="flex items-center gap-2">
                              <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value as any)} className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white">
                                <option value="Todos">Mostrar: Todos</option>
                                <option value="atualizado">Atualizados</option>
                                <option value="nao_encontrado">Não encontrados</option>
                                <option value="erros">Erros</option>
                              </select>
                              <button onClick={handleExportCSV} className="px-3 py-2 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white">Exportar CSV</button>
                            </div>
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-white/5 text-white/40 uppercase tracking-wider font-bold">
                                <tr>
                                  <th className="px-4 py-2">Arquivo</th>
                                  <th className="px-4 py-2">Tipo</th>
                                  <th className="px-4 py-2">Título</th>
                                  <th className="px-4 py-2">Status</th>
                                  <th className="px-4 py-2">URL</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {(batchFilter === 'Todos' ? batchResults : batchResults.filter(r => batchFilter === 'erros' ? (r.status === 'upload_erro' || r.status === 'update_erro') : r.status === batchFilter)).map((r, i) => (
                                  <tr key={i}>
                                    <td className="px-4 py-2">{r.fileName}</td>
                                    <td className="px-4 py-2">{r.imageType}</td>
                                    <td className="px-4 py-2">{r.matchedTitle || '-'}</td>
                                    <td className={`px-4 py-2 ${r.status === 'atualizado' ? 'text-green-500' : r.status === 'nao_encontrado' ? 'text-yellow-500' : 'text-red-500'}`}>{r.status}</td>
                                    <td className="px-4 py-2">{r.url ? <a href={r.url} target="_blank" className="text-blue-400">abrir</a> : '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 mt-6 pt-6 border-t border-white/5">
                <button onClick={() => { setShowBatchUpload(false); setBatchFiles([]); setBatchProgress({ processed: 0, total: 0, logs: [], matched: 0 }); }} className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-white">Fechar</button>
                {!uploadingBatch && batchFiles.length > 0 && batchProgress.processed === 0 && <button onClick={handleBatchUpload} className="flex-1 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white">Iniciar Processamento</button>}
              </div>
            </div>
          </div>
        )}

        {showImportUpload && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a20] w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl p-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Upload className="text-purple-500" /> Importar Conteúdo M3U/JSON</h3>
              {!importing && importProgress.step === '' && !importProgress.logs.length && (
                <>
                  {/* Abas: Upload de Arquivo / Importar via URL */}
                  <div className="flex gap-2 mb-6">
                    <button onClick={() => setImportMode('file')} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${importMode === 'file' ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.2)]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>
                      <Upload size={18} /> Upload de Arquivo
                    </button>
                    <button onClick={() => setImportMode('url')} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${importMode === 'url' ? 'bg-cyan-600/20 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>
                      <Globe size={18} /> Importar via URL
                    </button>
                  </div>

                  {importMode === 'file' && (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-12 bg-black/20 mb-6">
                      <Upload size={48} className="text-white/20 mb-4" />
                      <p className="text-lg font-bold text-white/60 mb-2">Arraste o arquivo aqui</p>
                      <p className="text-sm text-white/40 mb-6">ou clique para selecionar (.m3u, .m3u8, .json)</p>
                      <input id="import-file-input" type="file" accept=".m3u,.m3u8,.json,application/json,text/plain" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="hidden" />
                      <label htmlFor="import-file-input" className="px-6 py-3 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white cursor-pointer">Selecionar Arquivo</label>
                      {importFile && <div className="mt-4 text-center"><p className="font-bold text-green-400">{importFile.name}</p></div>}
                    </div>
                  )}

                  {importMode === 'url' && (
                    <div className="flex-1 flex flex-col border-2 border-dashed border-white/10 rounded-2xl p-8 bg-black/20 mb-6">
                      <Globe size={48} className="text-white/20 mb-4 mx-auto" />
                      <p className="text-lg font-bold text-white/60 mb-2 text-center">Cole a URL da lista M3U ou JSON</p>
                      <p className="text-sm text-white/40 mb-6 text-center">Ex: http://servidor.com/playlist/usuario/senha/m3u_plus</p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={importUrl}
                          onChange={e => setImportUrl(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleImportFromUrl()}
                          placeholder="https://servidor.com/playlist/...m3u_plus"
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50 placeholder:text-white/20"
                        />
                      </div>
                      {importUrl.trim() && (
                        <div className="mt-4 bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-3 flex items-start gap-2">
                          <Globe size={14} className="text-cyan-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-white/50">A URL será acessada diretamente pelo navegador. Se houver erro de CORS, baixe o arquivo e use a aba "Upload de Arquivo".</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {/* Logs de erro (CORS, etc) */}
              {!importing && importProgress.step === '' && importProgress.logs.length > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-2">
                    {importProgress.logs.map((log, i) => <p key={i} className="text-sm text-red-400">{log}</p>)}
                  </div>
                  <button onClick={() => setImportProgress({ step: '', logs: [], movies: 0, series: 0 })} className="text-xs text-white/40 hover:text-white/60 underline">Tentar novamente</button>
                </div>
              )}
              {importProgress.step === 'Pronto para inserir' && (
                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                  {/* Barra de resumo com contadores por tipo */}
                  <div className="grid grid-cols-5 gap-2">
                    <div className="bg-blue-600/10 border border-blue-600/20 rounded-xl p-3 text-center">
                      <p className="text-xl font-black text-blue-400">{previewMovies.length + previewSeries.length}</p>
                      <p className="text-[9px] uppercase tracking-widest text-white/40">Total</p>
                    </div>
                    <div className="bg-red-600/10 border border-red-600/20 rounded-xl p-3 text-center">
                      <p className="text-xl font-black text-red-400">{previewMovies.length}</p>
                      <p className="text-[9px] uppercase tracking-widest text-white/40">Filmes</p>
                    </div>
                    <div className="bg-purple-600/10 border border-purple-600/20 rounded-xl p-3 text-center">
                      <p className="text-xl font-black text-purple-400">{previewSeries.length}</p>
                      <p className="text-[9px] uppercase tracking-widest text-white/40">Séries</p>
                    </div>
                    <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-xl p-3 text-center">
                      <p className="text-xl font-black text-yellow-400">{importKidsCount}</p>
                      <p className="text-[9px] uppercase tracking-widest text-white/40">Kids</p>
                    </div>
                    <div className="bg-green-600/10 border border-green-600/20 rounded-xl p-3 text-center">
                      <p className="text-xl font-black text-green-400">{selectedPreview.movies.size + selectedPreview.series.size}</p>
                      <p className="text-[9px] uppercase tracking-widest text-white/40">Selecionados</p>
                    </div>
                  </div>

                  {/* Painel de Filtros */}
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-3">
                    <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Filtros — escolha o que deseja importar</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {/* Tipo */}
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Tipo</label>
                        <select value={importFilterType} onChange={(e) => setImportFilterType(e.target.value as any)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                          <option value="Todos">Todos</option>
                          <option value="movie">Filmes</option>
                          <option value="series">Séries</option>
                        </select>
                      </div>
                      {/* Kids */}
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Público</label>
                        <select value={importFilterKids} onChange={(e) => setImportFilterKids(e.target.value as any)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                          <option value="Todos">Todos</option>
                          <option value="kids">🧒 Apenas Kids</option>
                          <option value="adult">🎬 Apenas Adulto</option>
                        </select>
                      </div>
                      {/* Gênero */}
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Gênero</label>
                        <select value={importFilterGenre} onChange={(e) => setImportFilterGenre(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                          <option value="Todos">Todos</option>
                          {importAvailableGenres.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      {/* Ano mínimo */}
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Ano mínimo</label>
                        <input type="number" value={importFilterYearMin} onChange={(e) => setImportFilterYearMin(parseInt(e.target.value) || 1900)} min={importMinYear} max={importMaxYear} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
                      </div>
                      {/* Ano máximo */}
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Ano máximo</label>
                        <input type="number" value={importFilterYearMax} onChange={(e) => setImportFilterYearMax(parseInt(e.target.value) || 2030)} min={importMinYear} max={importMaxYear} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Categoria/Grupo */}
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Categoria M3U</label>
                        <select value={importFilterGroup} onChange={(e) => setImportFilterGroup(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                          <option value="Todos">Todas</option>
                          {importAvailableGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      {/* Busca por nome */}
                      <div className="relative">
                        <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Busca</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                          <input type="text" placeholder="Buscar por título..." value={importFilterSearch} onChange={(e) => setImportFilterSearch(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 placeholder:text-white/20" />
                        </div>
                      </div>
                    </div>
                    {/* Atalhos de seleção rápida por ano */}
                    <div className="flex flex-wrap gap-2">
                      <p className="text-[10px] text-white/30 mr-1 self-center">Rápido:</p>
                      {[2026, 2024, 2022, 2020, 2015, 2010].map(y => (
                        <button key={y} onClick={() => { setImportFilterYearMin(y); setImportFilterYearMax(2030); }} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${importFilterYearMin === y ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                          {y}+
                        </button>
                      ))}
                      <button onClick={() => { setImportFilterYearMin(1900); setImportFilterYearMax(2030); }} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${importFilterYearMin === 1900 ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                        Todos
                      </button>
                    </div>
                    {/* Botões de seleção em massa */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                      <button onClick={selectOnlyFiltered} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-all">
                        ✅ Selecionar filtrados ({filteredImportItems.length})
                      </button>
                      <button onClick={selectAllFiltered} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-all">
                        + Adicionar filtrados
                      </button>
                      <button onClick={deselectAllFiltered} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-all">
                        − Remover filtrados
                      </button>
                      <button onClick={() => setSelectedPreview({ movies: new Set(), series: new Set() })} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-white/40 hover:bg-white/10 transition-all ml-auto">
                        Limpar tudo
                      </button>
                    </div>
                  </div>

                  {/* Info de distribuição */}
                  {(selectedPreview.movies.size + selectedPreview.series.size) > 0 && (
                    <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3">
                      <p className="text-xs text-white/60">📌 <strong className="text-white/80">Distribuição automática:</strong> Filmes vão para <span className="text-red-400">pág. Filmes</span> + <span className="text-blue-400">Home</span> • Séries vão para <span className="text-purple-400">pág. Séries</span> + <span className="text-blue-400">Home</span> • Conteúdo kids vai para <span className="text-yellow-400">pág. Kids</span></p>
                    </div>
                  )}

                  {/* Lista filtrada com detalhes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                    {/* Filmes */}
                    {(importFilterType === 'Todos' || importFilterType === 'movie') && (
                      <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-bold text-white flex items-center gap-2"><Film size={14} className="text-red-400" /> Filmes</p>
                          <p className="text-white/40 text-xs">{filteredImportMovies.length} filtrados • <span className="text-green-400">{selectedPreview.movies.size} selecionados</span></p>
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-1 flex-1 custom-scrollbar pr-1">
                          {filteredImportMovies.length === 0 && <p className="text-white/20 text-xs text-center py-4">Nenhum filme com esses filtros</p>}
                          {filteredImportMovies.map((m) => (
                            <label key={`m-${m._idx}`} className={`flex items-center gap-3 text-xs py-2 px-3 rounded-xl cursor-pointer transition-all border ${selectedPreview.movies.has(m._idx) ? 'bg-green-600/10 border-green-500/20' : 'border-transparent hover:bg-white/5'}`}>
                              <input type="checkbox" checked={selectedPreview.movies.has(m._idx)} onChange={() => togglePreviewSelect('movies', m._idx)} className="accent-green-500 shrink-0" />
                              {m.logo_url && <img src={m.logo_url} className="w-7 h-10 rounded object-cover shrink-0 bg-white/5" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold line-clamp-1">{m.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {m.year && <span className="text-white/40">{m.year}</span>}
                                  {m.kids && <span className="text-yellow-400 text-[10px]">🧒 Kids</span>}
                                  {Array.isArray(m.genre) && m.genre.length > 0 && <span className="text-white/25 line-clamp-1">{m.genre.slice(0, 3).join(', ')}</span>}
                                </div>
                              </div>
                              {m.platform && <span className="text-[10px] text-white/20 shrink-0 max-w-20 truncate">{m.platform}</span>}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Séries */}
                    {(importFilterType === 'Todos' || importFilterType === 'series') && (
                      <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-bold text-white flex items-center gap-2"><Tv size={14} className="text-purple-400" /> Séries</p>
                          <p className="text-white/40 text-xs">{filteredImportSeries.length} filtrados • <span className="text-green-400">{selectedPreview.series.size} selecionados</span></p>
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-1 flex-1 custom-scrollbar pr-1">
                          {filteredImportSeries.length === 0 && <p className="text-white/20 text-xs text-center py-4">Nenhuma série com esses filtros</p>}
                          {filteredImportSeries.map((s) => (
                            <label key={`s-${s._idx}`} className={`flex items-center gap-3 text-xs py-2 px-3 rounded-xl cursor-pointer transition-all border ${selectedPreview.series.has(s._idx) ? 'bg-purple-600/10 border-purple-500/20' : 'border-transparent hover:bg-white/5'}`}>
                              <input type="checkbox" checked={selectedPreview.series.has(s._idx)} onChange={() => togglePreviewSelect('series', s._idx)} className="accent-purple-500 shrink-0" />
                              {s.logo_url && <img src={s.logo_url} className="w-7 h-10 rounded object-cover shrink-0 bg-white/5" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold line-clamp-1">{s.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {s.year && <span className="text-white/40">{s.year}</span>}
                                  {s.kids && <span className="text-yellow-400 text-[10px]">🧒 Kids</span>}
                                  {Array.isArray(s.genre) && s.genre.length > 0 && <span className="text-white/25 line-clamp-1">{s.genre.slice(0, 3).join(', ')}</span>}
                                </div>
                              </div>
                              {s.platform && <span className="text-[10px] text-white/20 shrink-0 max-w-20 truncate">{s.platform}</span>}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {(importing || importProgress.step === 'Inserindo no banco' || importProgress.step === 'Finalizado') && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2 font-bold">
                      <span className={importProgress.step === 'Finalizado' ? 'text-green-400' : ''}>{importProgress.step === 'Finalizado' ? '✅ Importação Concluída' : importProgress.step || 'Processando...'}</span>
                      <span>{importProgress.movies} filmes • {importProgress.series} séries</span>
                    </div>
                    {/* Barra de progresso */}
                    {importing && (
                      <div className="space-y-2">
                        <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden border border-white/10">
                          {downloadProgress.total > 0 ? (
                            <div className="h-full rounded-full bg-gradient-to-r from-purple-600 via-cyan-500 to-purple-600 transition-all duration-300 ease-out" style={{ width: `${Math.min((downloadProgress.loaded / downloadProgress.total) * 100, 100)}%` }} />
                          ) : importProgress.step === 'Inserindo no banco' && (importProgress.movies + importProgress.series) > 0 ? (
                            <div className="h-full rounded-full bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 transition-all duration-300 ease-out" style={{ width: `${Math.min(((importProgress.movies + importProgress.series) / Math.max((previewMovies.length > 0 || previewSeries.length > 0 ? selectedPreview.movies.size + selectedPreview.series.size : 1), 1)) * 100, 100)}%` }} />
                          ) : (
                            <div className="h-full rounded-full bg-gradient-to-r from-purple-600 via-cyan-500 to-purple-600 animate-pulse" style={{ width: '100%', animation: 'pulse 1.5s ease-in-out infinite, shimmer 2s linear infinite' }} />
                          )}
                        </div>
                        <div className="flex justify-between text-[11px] text-white/40">
                          {downloadProgress.phase && <span>{downloadProgress.phase}</span>}
                          {downloadProgress.total > 0 && <span>{formatBytes(downloadProgress.loaded)} / {formatBytes(downloadProgress.total)} ({Math.round((downloadProgress.loaded / downloadProgress.total) * 100)}%)</span>}
                          {downloadProgress.total === 0 && downloadProgress.phase && <span className="animate-pulse">Aguarde, processando...</span>}
                          {importProgress.step === 'Inserindo no banco' && <span>Inserindo lotes no Supabase...</span>}
                          {importProgress.step === 'Lendo arquivo' && <span>Lendo e analisando arquivo...</span>}
                        </div>
                      </div>
                    )}
                    {importProgress.step === 'Finalizado' && (
                      <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden border border-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-600 to-emerald-400" style={{ width: '100%' }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 bg-black/40 rounded-xl p-4 overflow-y-auto font-mono text-xs space-y-2 border border-white/5 max-h-75">
                    {importProgress.logs.length === 0 ? <p className="text-center text-white/20 py-8">Aguardando...</p> : importProgress.logs.map((log, i) => <div key={i} className="p-2 rounded text-white/80">{log}</div>)}
                  </div>
                </div>
              )}
              <div className="flex gap-4 mt-6 pt-6 border-t border-white/5">
                <button onClick={() => { setShowImportUpload(false); setImportFile(null); setImportUrl(''); setImportMode('file'); setImportProgress({ step: '', logs: [], movies: 0, series: 0 }); setPreviewMovies([]); setPreviewSeries([]); setSelectedPreview({ movies: new Set(), series: new Set() }); setImportFilterType('Todos'); setImportFilterKids('Todos'); setImportFilterYearMin(1900); setImportFilterYearMax(2030); setImportFilterGroup('Todos'); setImportFilterGenre('Todos'); setImportFilterSearch(''); }} className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-white">Fechar</button>
                {!importing && importMode === 'file' && importFile && importProgress.step === '' && !importProgress.logs.length && <button onClick={handleImportParse} className="flex-1 py-3 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white">Ler Arquivo</button>}
                {!importing && importMode === 'url' && importUrl.trim() && importProgress.step === '' && !importProgress.logs.length && <button onClick={handleImportFromUrl} disabled={fetchingUrl} className="flex-1 py-3 rounded-xl font-bold text-sm bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 flex items-center justify-center gap-2">{fetchingUrl ? 'Baixando...' : <><Globe size={16} /> Ler da URL</>}</button>}
                {!importing && importProgress.step === 'Pronto para inserir' && (selectedPreview.movies.size + selectedPreview.series.size) > 0 && <button onClick={handleImportInsert} className="flex-1 py-3 rounded-xl font-bold text-sm bg-green-600 hover:bg-green-700 text-white">Inserir {selectedPreview.movies.size + selectedPreview.series.size} Selecionados</button>}
              </div>
            </div>
          </div>
        )}

        {/* Create New Content Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a20] w-full max-w-6xl max-h-[95vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl">
              <div className="sticky top-0 bg-[#1a1a20] p-6 border-b border-white/5 flex justify-between items-center z-10">
                <h3 className="text-xl font-bold flex items-center gap-2"><Plus size={20} className="text-green-500" /> Novo Conteúdo</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
              </div>

              <div className="p-8 space-y-8">
                {/* Tipo */}
                <div className="flex gap-3">
                  <button onClick={() => setCreateType('movie')} className={`flex-1 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border ${createType === 'movie' ? 'bg-red-600/20 border-red-500 text-red-400 shadow-[0_0_20px_rgba(220,38,38,0.2)]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>
                    <Film size={20} /> Filme
                  </button>
                  <button onClick={() => setCreateType('series')} className={`flex-1 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border ${createType === 'series' ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>
                    <Tv size={20} /> Série
                  </button>
                </div>

                {/* Busca TMDB - Preencher automaticamente */}
                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Buscar no TMDB (opcional — preenche automaticamente)</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tmdbSearchQuery}
                      onChange={e => setTmdbSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleTmdbSearch()}
                      placeholder={`Buscar ${createType === 'movie' ? 'filme' : 'série'} no TMDB...`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600/50 placeholder:text-white/20"
                    />
                    <button onClick={handleTmdbSearch} disabled={searchingTmdb} className="px-6 py-3 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/20 text-white disabled:opacity-50">
                      {searchingTmdb ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  {tmdbSearchResults.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 max-h-64 overflow-y-auto custom-scrollbar">
                      {tmdbSearchResults.map((r: any) => (
                        <button key={r.id} onClick={() => fillFromTmdb(r)} className="bg-white/5 hover:bg-white/10 rounded-xl p-2 text-left transition-all group border border-transparent hover:border-red-500/30">
                          <div className="aspect-[2/3] bg-white/10 rounded-lg overflow-hidden mb-2">
                            {r.poster_path ? <img src={`https://image.tmdb.org/t/p/w200${r.poster_path}`} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">Sem imagem</div>}
                          </div>
                          <p className="text-xs font-bold line-clamp-2 group-hover:text-red-400 transition-colors">{r.title || r.name}</p>
                          <p className="text-[10px] text-white/40 mt-0.5">{new Date(r.release_date || r.first_air_date || '').getFullYear() || '—'} • ⭐ {r.vote_average?.toFixed(1) || '—'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Formulário */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Coluna esquerda — Dados */}
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Título *</label>
                      <input type="text" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600/50" placeholder="Nome do filme ou série" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Descrição</label>
                      <textarea rows={4} value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white resize-none focus:outline-none focus:border-red-600/50" placeholder="Sinopse..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Ano</label>
                        <input type="number" value={createForm.year} onChange={e => setCreateForm({ ...createForm, year: parseInt(e.target.value) || 0 })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600/50" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">TMDB ID</label>
                        <input type="text" value={createForm.tmdb_id} onChange={e => setCreateForm({ ...createForm, tmdb_id: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-red-600/50" placeholder="Ex: 550" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Gêneros (vírgula)</label>
                        <input type="text" value={createForm.genre} onChange={e => setCreateForm({ ...createForm, genre: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600/50" placeholder="Ação, Drama, Ficção" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Nota</label>
                        <input type="text" value={createForm.rating} onChange={e => setCreateForm({ ...createForm, rating: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600/50" placeholder="8.5" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">URL do Stream</label>
                      <input type="text" value={createForm.stream_url} onChange={e => setCreateForm({ ...createForm, stream_url: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs focus:outline-none focus:border-red-600/50" placeholder="https://... .mp4 ou .m3u8" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Poster (URL)</label>
                      <div className="flex gap-2">
                        <input type="text" value={createForm.poster} onChange={e => setCreateForm({ ...createForm, poster: e.target.value })} className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-red-600/50" placeholder="URL da imagem vertical" />
                        <label className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center cursor-pointer shrink-0">
                          <Upload size={16} className="text-white/60" />
                          <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                            if (!e.target.files?.[0]) return;
                            setCreating(true);
                            const url = await uploadImage(e.target.files[0], 'posters');
                            if (url) setCreateForm(prev => ({ ...prev, poster: url }));
                            setCreating(false);
                          }} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Backdrop (URL)</label>
                      <div className="flex gap-2">
                        <input type="text" value={createForm.backdrop} onChange={e => setCreateForm({ ...createForm, backdrop: e.target.value })} className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-red-600/50" placeholder="URL da imagem horizontal" />
                        <label className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center cursor-pointer shrink-0">
                          <Upload size={16} className="text-white/60" />
                          <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                            if (!e.target.files?.[0]) return;
                            setCreating(true);
                            const url = await uploadImage(e.target.files[0], 'backdrops');
                            if (url) setCreateForm(prev => ({ ...prev, backdrop: url }));
                            setCreating(false);
                          }} />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Plataforma</label>
                        <select value={createForm.platform} onChange={e => setCreateForm({ ...createForm, platform: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600/50">
                          <option value="">Nenhuma</option>
                          <option value="Netflix">Netflix</option>
                          <option value="Prime Video">Prime Video</option>
                          <option value="Disney+">Disney+</option>
                          <option value="HBO Max">HBO Max</option>
                          <option value="Apple TV+">Apple TV+</option>
                          <option value="Globoplay">Globoplay</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Status</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setCreateForm({ ...createForm, status: 'published' })} className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${createForm.status === 'published' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black/20 border-white/10 text-white/40'}`}>Publicado</button>
                          <button type="button" onClick={() => setCreateForm({ ...createForm, status: 'draft' })} className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${createForm.status === 'draft' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-black/20 border-white/10 text-white/40'}`}>Rascunho</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coluna direita — Preview */}
                  <div className="space-y-6">
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                      <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Preview</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-white/30 mb-2">Poster Vertical</p>
                          <div className="aspect-[2/3] bg-white/5 rounded-lg overflow-hidden">
                            {createForm.poster ? <img src={createForm.poster} className="w-full h-full object-cover" alt="Preview poster" /> : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">Sem imagem</div>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/30 mb-2">Backdrop Horizontal</p>
                          <div className="aspect-video bg-white/5 rounded-lg overflow-hidden">
                            {createForm.backdrop ? <img src={createForm.backdrop} className="w-full h-full object-cover" alt="Preview backdrop" /> : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">Sem imagem</div>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resumo */}
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-white/40">Dados Preenchidos</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${createForm.title ? 'bg-green-500' : 'bg-white/20'}`} />
                          <span className={createForm.title ? 'text-white' : 'text-white/30'}>Título</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${createForm.description ? 'bg-green-500' : 'bg-white/20'}`} />
                          <span className={createForm.description ? 'text-white' : 'text-white/30'}>Descrição</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${createForm.poster ? 'bg-green-500' : 'bg-white/20'}`} />
                          <span className={createForm.poster ? 'text-white' : 'text-white/30'}>Poster</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${createForm.backdrop ? 'bg-green-500' : 'bg-white/20'}`} />
                          <span className={createForm.backdrop ? 'text-white' : 'text-white/30'}>Backdrop</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${createForm.stream_url ? 'bg-green-500' : 'bg-yellow-500'}`} />
                          <span className={createForm.stream_url ? 'text-white' : 'text-yellow-500/60'}>Stream URL</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${createForm.tmdb_id ? 'bg-green-500' : 'bg-white/20'}`} />
                          <span className={createForm.tmdb_id ? 'text-white' : 'text-white/30'}>TMDB ID</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${createForm.genre ? 'bg-green-500' : 'bg-white/20'}`} />
                          <span className={createForm.genre ? 'text-white' : 'text-white/30'}>Gêneros</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${createForm.year ? 'bg-green-500' : 'bg-white/20'}`} />
                          <span className={createForm.year ? 'text-white' : 'text-white/30'}>Ano</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 flex justify-end gap-3 sticky bottom-0 bg-[#1a1a20]">
                <button onClick={() => setShowCreateModal(false)} className="px-6 py-3 rounded-xl font-bold text-sm hover:bg-white/10 text-white/60 transition-all">Cancelar</button>
                <button onClick={handleCreate} disabled={creating || !createForm.title.trim()} className="px-8 py-3 rounded-xl font-bold text-sm bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                  {creating ? 'Salvando...' : <><Plus size={18} /> Criar {createType === 'movie' ? 'Filme' : 'Série'}</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a20] w-full max-w-6xl max-h-[95vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl">
              <div className="sticky top-0 bg-[#1a1a20] p-6 border-b border-white/5 flex justify-between items-center z-10">
                <h3 className="text-xl font-bold flex items-center gap-2"><Edit2 size={20} className="text-red-500" /> Editar {editingItem.type === 'movie' ? 'Filme' : 'Série'}</h3>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
              </div>

              <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Left column */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Título</label>
                    <input type="text" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Descrição</label>
                    <textarea rows={5} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 resize-none"></textarea>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Poster Vertical</label>
                    <div className="flex gap-2">
                      <input type="text" value={editForm.poster} onChange={e => setEditForm({ ...editForm, poster: e.target.value })} className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono" placeholder="URL ou Upload" />
                      <label className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center cursor-pointer">
                        <Upload size={16} className="text-white/60" />
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'posters', 'poster')} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Backdrop Horizontal</label>
                    <div className="flex gap-2">
                      <input type="text" value={editForm.backdrop} onChange={e => setEditForm({ ...editForm, backdrop: e.target.value })} className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono" placeholder="URL ou Upload" />
                      <label className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center cursor-pointer">
                        <Upload size={16} className="text-white/60" />
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'backdrops', 'backdrop')} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Logo</label>
                    <div className="flex gap-2">
                      <input type="text" value={editForm.logo_url} onChange={e => setEditForm({ ...editForm, logo_url: e.target.value })} className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono" placeholder="URL ou Upload" />
                      <label className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center cursor-pointer">
                        <Upload size={16} className="text-white/60" />
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logos', 'logo_url')} />
                      </label>
                    </div>
                    <p className="text-[10px] text-white/30 mt-1">Logo em PNG transparente que substitui o título texto.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Plataforma</label>
                    <select value={editForm.platform} onChange={e => setEditForm({ ...editForm, platform: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3">
                      <option value="">Nenhuma</option>
                      <option value="Netflix">Netflix</option>
                      <option value="Prime Video">Prime Video</option>
                      <option value="Disney+">Disney+</option>
                      <option value="HBO Max">HBO Max</option>
                      <option value="Apple TV+">Apple TV+</option>
                      <option value="Hulu">Hulu</option>
                      <option value="Paramount+">Paramount+</option>
                      <option value="Globoplay">Globoplay</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Status</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditForm({ ...editForm, status: 'published' })} className={`flex-1 py-3 rounded-xl text-xs font-bold ${editForm.status === 'published' ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-black/20 border-white/10 text-white/40'}`}>Publicado</button>
                      <button type="button" onClick={() => setEditForm({ ...editForm, status: 'draft' })} className={`flex-1 py-3 rounded-xl text-xs font-bold ${editForm.status === 'draft' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-black/20 border-white/10 text-white/40'}`}>Rascunho</button>
                    </div>
                  </div>

                  {editingItem.type === 'movie' && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Stream (URL)</label>
                      <input type="text" value={editForm.stream_url} onChange={e => setEditForm({ ...editForm, stream_url: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono" />
                      <p className="text-[10px] text-white/30 mt-1">URL do vídeo MP4 ou M3U8.</p>
                    </div>
                  )}
                </div>

                {/* Right column: previews */}
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                      <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Vertical</p>
                      <div className="w-full aspect-[2/3] bg-white/5 rounded-lg overflow-hidden">
                        {editForm.poster ? <img src={editForm.poster} className="w-full h-full object-cover" alt="Poster" /> : <div className="w-full h-full flex items-center justify-center text-white/20">Sem Imagem</div>}
                        {editForm.logo_url && <img src={editForm.logo_url} className="absolute bottom-4 left-0 right-0 w-3/4 mx-auto object-contain h-12" alt="Logo" />}
                      </div>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                      <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Horizontal (Hover)</p>
                      <div className="w-full aspect-video bg-white/5 rounded-lg overflow-hidden relative">
                        {editForm.use_trailer && editForm.trailer_url ? (
                          <div className="w-full h-full bg-black flex items-center justify-center">
                            <div className="absolute inset-0 opacity-50 bg-cover bg-center" style={{ backgroundImage: `url(${editForm.backdrop})` }} />
                            <div className="z-10 bg-red-600/20 p-2 rounded-full border border-red-500" />
                          </div>
                        ) : editForm.backdrop ? (
                          <img src={editForm.backdrop} className="w-full h-full object-cover opacity-60" alt="Backdrop" />
                        ) : <div className="w-full h-full flex items-center justify-center text-white/20">Sem Imagem</div>}
                        {!editForm.use_trailer && <div className="absolute bottom-4 left-4">{editForm.logo_url ? <img src={editForm.logo_url} className="h-8 object-contain mb-2" alt="Logo" /> : <h3 className="text-sm font-bold mb-1 line-clamp-1">{editForm.title}</h3>}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-white/40">Mídia de Destaque (Hover)</p>
                      <label className="flex items-center cursor-pointer gap-2">
                        <span className="text-xs text-white/60">{editForm.use_trailer ? 'Trailer' : 'Imagem'}</span>
                        <div className="relative">
                          <input type="checkbox" className="sr-only" checked={editForm.use_trailer} onChange={e => setEditForm({ ...editForm, use_trailer: e.target.checked })} />
                          <div className={`block w-10 h-6 rounded-full ${editForm.use_trailer ? 'bg-red-600' : 'bg-white/10'}`}></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full ${editForm.use_trailer ? 'transform translate-x-4' : ''}`}></div>
                        </div>
                      </label>
                    </div>

                    {editForm.use_trailer && (
                      <div>
                        <input type="text" value={editForm.trailer_url} onChange={e => setEditForm({ ...editForm, trailer_url: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono" placeholder="URL do Trailer (MP4/YouTube)" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 flex justify-end gap-3 sticky bottom-0 bg-[#1a1a20]">
                <button onClick={() => setEditingItem(null)} className="px-6 py-3 rounded-xl font-bold text-sm hover:bg-white/10 text-white/60">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="px-8 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
                  {saving ? <>Salvando...</> : <><Save size={18} /> Salvar Alterações</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {deletingItem && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a20] w-full max-w-md rounded-2xl border border-red-500/20 shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} className="text-red-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Excluir Conteúdo?</h3>
              <p className="text-white/60 mb-8">Tem certeza que deseja excluir <strong>{deletingItem.title}</strong>? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-4">
                <button onClick={() => setDeletingItem(null)} className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-white">Cancelar</button>
                <button onClick={handleDeleteConfirm} className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white">Sim, Excluir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default VOD;
