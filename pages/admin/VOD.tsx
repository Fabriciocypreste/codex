import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { Film, Tv, Search, Edit2, Trash2, Plus, Star, Save, X, Upload, AlertTriangle } from 'lucide-react';
import { getAllMovies, getAllSeries, updateMovie, updateSeries, deleteMovie, deleteSeries, uploadImage, supabase, insertImageUpdate } from '../../services/supabaseService';
import { searchAnyLang } from '../../services/tmdb';
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
  const [importProgress, setImportProgress] = useState<{ step: string; logs: string[]; movies: number; series: number }>({ step: '', logs: [], movies: 0, series: 0 });
  const [previewMovies, setPreviewMovies] = useState<any[]>([]);
  const [previewSeries, setPreviewSeries] = useState<any[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<{ movies: Set<number>; series: Set<number> }>({ movies: new Set(), series: new Set() });

  // Delete
  const [deletingItem, setDeletingItem] = useState<Media | null>(null);

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
  const classifyType = (name: string, group?: string) => {
    const n = normalizeText(name).toLowerCase();
    if (/(s\d+e\d+|temporada|season)/i.test(n)) return 'series';
    if ((group || '').toLowerCase().includes('series')) return 'series';
    return 'movie';
  };
  const extractYear = (name: string) => {
    const m = name.match(/\b(19\d{2}|20\d{2})\b/);
    return m ? parseInt(m[1], 10) : undefined;
  };
  const parseM3UText = (text: string) => {
    const lines = text.split(/\r?\n/);
    const entries: any[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('#EXTINF')) {
        const info = line;
        const url = (lines[i + 1] || '').trim();
        const nameMatch = info.match(/,(.*)$/);
        const name = nameMatch ? nameMatch[1].trim() : 'Sem Título';
        const logoMatch = info.match(/tvg-logo=\"([^\"]*)\"/);
        const groupMatch = info.match(/group-title=\"([^\"]*)\"/);
        const logo = logoMatch ? logoMatch[1] : '';
        const group = groupMatch ? groupMatch[1] : '';
        const type = classifyType(name, group);
        const year = extractYear(name);
        const platform = group || '';
        const e = { title: name, description: '', poster: '', backdrop: '', logo_url: logo, stream_url: url, platform, year, genre: [], status: 'draft', type };
        entries.push(e);
      }
    }
    const movies = entries.filter(e => e.type === 'movie');
    const series = entries.filter(e => e.type === 'series');
    return { movies, series };
  };
  const parseJSONText = (text: string) => {
    let obj: any;
    try { obj = JSON.parse(text); } catch { return { movies: [], series: [] }; }
    const arrMovies = Array.isArray(obj) ? obj.filter((x: any) => classifyType(x.title || '') === 'movie') : (obj.movies || []);
    const arrSeries = Array.isArray(obj) ? obj.filter((x: any) => classifyType(x.title || '') === 'series') : (obj.series || []);
    const normalizeItem = (x: any, type: 'movie' | 'series') => ({
      title: x.title || 'Sem Título',
      description: x.description || '',
      poster: x.poster || '',
      backdrop: x.backdrop || '',
      logo_url: x.logo_url || '',
      stream_url: x.stream_url || '',
      platform: x.platform || '',
      year: x.year || extractYear(x.title || ''),
      genre: Array.isArray(x.genre) ? x.genre : [],
      status: 'draft',
      type
    });
    const movies = arrMovies.map((x: any) => normalizeItem(x, 'movie'));
    const series = arrSeries.map((x: any) => normalizeItem(x, 'series'));
    return { movies, series };
  };
  const handleImportParse = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportProgress({ step: 'Lendo arquivo', logs: [], movies: 0, series: 0 });
    const text = await importFile.text();
    const isM3U = importFile.name.toLowerCase().endsWith('.m3u') || text.startsWith('#EXTM3U');
    const result = isM3U ? parseM3UText(text) : parseJSONText(text);
    setPreviewMovies(result.movies || []);
    setPreviewSeries(result.series || []);
    const selM = new Set<number>();
    const selS = new Set<number>();
    result.movies.forEach((_: any, idx: number) => selM.add(idx));
    result.series.forEach((_: any, idx: number) => selS.add(idx));
    setSelectedPreview({ movies: selM, series: selS });
    setImportProgress({ step: 'Pronto para inserir', logs: [], movies: result.movies.length, series: result.series.length });
    setImporting(false);
  };
  const togglePreviewSelect = (kind: 'movies' | 'series', idx: number) => {
    setSelectedPreview(prev => {
      const next = new Set(prev[kind]);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return { ...prev, [kind]: next };
    });
  };
  const handleImportInsert = async () => {
    setImporting(true);
    setImportProgress(prev => ({ ...prev, step: 'Inserindo no banco' }));
    const moviesToInsert = previewMovies.filter((_, idx) => selectedPreview.movies.has(idx)).map(x => {
      const { type, ...rest } = x;
      return { ...rest, status: 'draft' };
    });
    const seriesToInsert = previewSeries.filter((_, idx) => selectedPreview.series.has(idx)).map(x => {
      const { type, ...rest } = x;
      return { ...rest, status: 'draft' };
    });
    const logs: string[] = [];
    if (moviesToInsert.length > 0) {
      const { error } = await supabase.from('movies').insert(moviesToInsert);
      if (error) logs.push('Erro ao inserir filmes'); else logs.push(`Inseridos filmes: ${moviesToInsert.length}`);
    }
    if (seriesToInsert.length > 0) {
      const { error } = await supabase.from('series').insert(seriesToInsert);
      if (error) logs.push('Erro ao inserir séries'); else logs.push(`Inseridas séries: ${seriesToInsert.length}`);
    }
    setImportProgress(prev => ({ ...prev, step: 'Finalizado', logs, movies: moviesToInsert.length, series: seriesToInsert.length }));
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
      const qTokens = tokenize(query);
      let best: { item: Media; score: number } | null = null;
      for (const it of candidates) {
        const titleTokens = tokenize(it.title || '');
        const score = Math.max(
          jaccard(qTokens, titleTokens),
          normalizeString(it.title || '').includes(normalizeString(query)) ? 0.6 : 0
        );
        if (!best || score > best.score) best = { item: it, score };
      }
      if (best && best.score >= 0.45) return best.item;
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
          // fallback TMDB: busca em pt-BR e en-US
          try {
            const results = await searchAnyLang(searchName);
            const candidates = (results || []).map((r: any) => ({
              id: r.id,
              title: r.title || r.name || '',
              type: r.media_type === 'tv' ? 'series' : 'movie'
            }));
            const bestTmdb = candidates.length > 0 ? candidates.reduce((a: any, b: any) => {
              const scoreA = jaccard(tokenize(searchName), tokenize(a.title));
              const scoreB = jaccard(tokenize(searchName), tokenize(b.title));
              return scoreA >= scoreB ? a : b;
            }) : null;
            if (bestTmdb) {
              const foundById = items.find(i => i.tmdb_id === bestTmdb.id && i.type === bestTmdb.type);
              if (foundById) {
                match = foundById;
                logs.push(`Encontrado via TMDB: "${foundById.title}" (ID: ${foundById.id})`);
              } else {
                logs.push(`TMDB candidato "${bestTmdb.title}" não corresponde ao catálogo local.`);
              }
            } else {
              logs.push(`Não encontrado: "${searchName}" (arquivo: ${file.name})`);
            }
          } catch (e) {
            console.warn('Falha na busca TMDB fallback:', e);
            logs.push(`Falha TMDB ao buscar "${searchName}"`);
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">Catálogo VOD</h1>
            <p className="text-white/60 mt-1">Gerencie filmes, séries e metadados.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowBatchUpload(true)} className="px-6 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex items-center gap-2">
              <Upload size={18} /> Upload em Massa (Auto-Tag)
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
                <button onClick={() => { setShowBatchUpload(false); setBatchFiles([]); setBatchProgress({ processed: 0, total: 0, logs: [] }); }} className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-white">Fechar</button>
                {!uploadingBatch && batchFiles.length > 0 && batchProgress.processed === 0 && <button onClick={handleBatchUpload} className="flex-1 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white">Iniciar Processamento</button>}
              </div>
            </div>
          </div>
        )}

        {showImportUpload && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a20] w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl p-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Upload className="text-purple-500" /> Importar Conteúdo M3U/JSON</h3>
              {!importing && importProgress.step === '' && (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-12 bg-black/20 mb-6">
                  <Upload size={48} className="text-white/20 mb-4" />
                  <p className="text-lg font-bold text-white/60 mb-2">Arraste o arquivo aqui</p>
                  <p className="text-sm text-white/40 mb-6">ou clique para selecionar (.m3u, .json)</p>
                  <input id="import-file-input" type="file" accept=".m3u,.json,application/json,text/plain" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="hidden" />
                  <label htmlFor="import-file-input" className="px-6 py-3 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white cursor-pointer">Selecionar Arquivo</label>
                  {importFile && <div className="mt-4 text-center"><p className="font-bold text-green-400">{importFile.name}</p></div>}
                </div>
              )}
              {importProgress.step === 'Pronto para inserir' && (
                <div className="flex-1 overflow-hidden flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                      <div className="flex items-center justify-between mb-2"><p className="font-bold text-white">Filmes</p><p className="text-white/40">{previewMovies.length}</p></div>
                      <div className="max-h-56 overflow-y-auto space-y-2">
                        {previewMovies.map((m, idx) => (
                          <label key={idx} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={selectedPreview.movies.has(idx)} onChange={() => togglePreviewSelect('movies', idx)} />
                            <span className="line-clamp-1">{m.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                      <div className="flex items-center justify-between mb-2"><p className="font-bold text-white">Séries</p><p className="text-white/40">{previewSeries.length}</p></div>
                      <div className="max-h-56 overflow-y-auto space-y-2">
                        {previewSeries.map((s, idx) => (
                          <label key={idx} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={selectedPreview.series.has(idx)} onChange={() => togglePreviewSelect('series', idx)} />
                            <span className="line-clamp-1">{s.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="flex justify-between text-sm mb-2 font-bold"><span>Itens selecionados</span><span>{selectedPreview.movies.size + selectedPreview.series.size}</span></div>
                  </div>
                </div>
              )}
              {(importing || importProgress.step === 'Inserindo no banco') && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2 font-bold"><span>{importProgress.step || 'Processando...'}</span><span>{importProgress.movies} filmes • {importProgress.series} séries</span></div>
                  </div>
                  <div className="flex-1 bg-black/40 rounded-xl p-4 overflow-y-auto font-mono text-xs space-y-2 border border-white/5 max-h-[300px]">
                    {importProgress.logs.length === 0 ? <p className="text-center text-white/20 py-8">Aguardando...</p> : importProgress.logs.map((log, i) => <div key={i} className="p-2 rounded text-white/80">{log}</div>)}
                  </div>
                </div>
              )}
              <div className="flex gap-4 mt-6 pt-6 border-t border-white/5">
                <button onClick={() => { setShowImportUpload(false); setImportFile(null); setImportProgress({ step: '', logs: [], movies: 0, series: 0 }); setPreviewMovies([]); setPreviewSeries([]); setSelectedPreview({ movies: new Set(), series: new Set() }); }} className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-white">Fechar</button>
                {!importing && importFile && importProgress.step === '' && <button onClick={handleImportParse} className="flex-1 py-3 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white">Ler Arquivo</button>}
                {!importing && importProgress.step === 'Pronto para inserir' && (previewMovies.length + previewSeries.length) > 0 && <button onClick={handleImportInsert} className="flex-1 py-3 rounded-xl font-bold text-sm bg-green-600 hover:bg-green-700 text-white">Inserir Selecionados</button>}
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
