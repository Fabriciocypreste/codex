import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { Trash2, Upload, AlertTriangle, Play, RefreshCw, CheckCircle, Database } from 'lucide-react';
import { supabase } from '../../services/supabaseService';
import { discoverContent } from '../../services/tmdbCatalog';

const Ingestion: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'cleanup' | 'import' | 'manual'>('manual');

    // --- CLEANUP STATE ---
    const [cleanupType, setCleanupType] = useState<'movie' | 'series' | 'all'>('all');
    const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
    const [catalogYears, setCatalogYears] = useState<{ year: number; movies: number; series: number }[]>([]);
    const [loadingYears, setLoadingYears] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);
    const [cleanupLog, setCleanupLog] = useState<string[]>([]);

    // Fetch available years from catalog
    const loadCatalogYears = useCallback(async () => {
        setLoadingYears(true);
        try {
            const { data: moviesData } = await supabase.from('movies').select('year');
            const { data: seriesData } = await supabase.from('series').select('year');

            const yearMap = new Map<number, { movies: number; series: number }>();
            (moviesData || []).forEach((m: any) => {
                const y = m.year;
                if (!y) return;
                const entry = yearMap.get(y) || { movies: 0, series: 0 };
                entry.movies++;
                yearMap.set(y, entry);
            });
            (seriesData || []).forEach((s: any) => {
                const y = s.year;
                if (!y) return;
                const entry = yearMap.get(y) || { movies: 0, series: 0 };
                entry.series++;
                yearMap.set(y, entry);
            });

            const sorted = Array.from(yearMap.entries())
                .map(([year, counts]) => ({ year, ...counts }))
                .sort((a, b) => b.year - a.year);

            setCatalogYears(sorted);
        } catch (err) {
            console.error('Erro ao carregar anos:', err);
        } finally {
            setLoadingYears(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'cleanup') loadCatalogYears();
    }, [activeTab, loadCatalogYears]);

    const toggleYear = (year: number) => {
        setSelectedYears(prev => {
            const next = new Set(prev);
            if (next.has(year)) next.delete(year); else next.add(year);
            return next;
        });
    };

    const selectAllYears = () => {
        if (selectedYears.size === catalogYears.length) {
            setSelectedYears(new Set());
        } else {
            setSelectedYears(new Set(catalogYears.map(y => y.year)));
        }
    };

    // --- IMPORT STATE ---
    const [importType, setImportType] = useState<'movie' | 'series'>('movie');
    const [importYearMode, setImportYearMode] = useState<'single' | 'range'>('single');
    const [importYearStart, setImportYearStart] = useState('2024');
    const [importGenre, setImportGenre] = useState('Todos');
    const [pagesToFetch, setPagesToFetch] = useState(1); // 1 page ~ 20 items

    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0, added: 0 });
    const [importLogs, setImportLogs] = useState<string[]>([]);

    // --- MANUAL INSERT STATE ---
    const [manualType, setManualType] = useState<'movie' | 'series'>('movie');
    const [manualForm, setManualForm] = useState({
        title: '',
        description: '',
        stream_url: '',
        year: new Date().getFullYear(),
        duration: '',
        seasons: 1,
        genre: 'Drama',
        poster: '',
        backdrop: '',
        rating: '7.0',
        tmdb_id: ''
    });
    const [isManualInserting, setIsManualInserting] = useState(false);
    const [manualInsertLog, setManualInsertLog] = useState<string>('');

    // GENRES (Hardcoded for simplicity or could be fetched)
    const genres = [
        { id: '28', name: 'Ação' }, { id: '12', name: 'Aventura' }, { id: '16', name: 'Animação' },
        { id: '35', name: 'Comédia' }, { id: '80', name: 'Crime' }, { id: '99', name: 'Documentário' },
        { id: '18', name: 'Drama' }, { id: '10751', name: 'Família' }, { id: '14', name: 'Fantasia' },
        { id: '27', name: 'Terror' }, { id: '878', name: 'Ficção Científica' }, { id: '53', name: 'Suspense' }
    ];

    // --- HANDLERS ---

    const handleCleanup = async () => {
        if (selectedYears.size === 0) {
            alert('Selecione pelo menos um ano para apagar.');
            return;
        }
        const yearsArr = Array.from(selectedYears).sort();
        if (!window.confirm(`TEM CERTEZA? Vai apagar ${cleanupType === 'all' ? 'filmes e séries' : cleanupType === 'movie' ? 'filmes' : 'séries'} dos anos: ${yearsArr.join(', ')}. Essa ação é IRREVERSÍVEL.`)) return;

        setIsCleaning(true);
        setCleanupLog([]);

        try {
            for (const year of yearsArr) {
                if (cleanupType === 'movie' || cleanupType === 'all') {
                    const { error } = await supabase.from('movies').delete().eq('year', year);
                    if (error) {
                        setCleanupLog(prev => [...prev, `❌ Erro ao apagar filmes de ${year}: ${error.message}`]);
                    } else {
                        setCleanupLog(prev => [...prev, `✅ Filmes de ${year} apagados.`]);
                    }
                }
                if (cleanupType === 'series' || cleanupType === 'all') {
                    const { error } = await supabase.from('series').delete().eq('year', year);
                    if (error) {
                        setCleanupLog(prev => [...prev, `❌ Erro ao apagar séries de ${year}: ${error.message}`]);
                    } else {
                        setCleanupLog(prev => [...prev, `✅ Séries de ${year} apagadas.`]);
                    }
                }
            }

            setCleanupLog(prev => [...prev, `🎉 Limpeza concluída! Anos processados: ${yearsArr.join(', ')}`]);
            setSelectedYears(new Set());
            await loadCatalogYears();
        } catch (err) {
            console.error(err);
            setCleanupLog(prev => [...prev, `❌ Erro: ${(err as any).message}`]);
        } finally {
            setIsCleaning(false);
        }
    };

    const handleImport = async () => {
        setIsImporting(true);
        setImportLogs([]);
        setImportProgress({ current: 0, total: 0, added: 0 });

        const startYear = parseInt(importYearStart);
        const endYear = importYearMode === 'range' ? new Date().getFullYear() : startYear;

        let totalAdded = 0;
        let logs: string[] = [];

        try {
            // Loop Years
            for (let year = startYear; year <= endYear; year++) {
                logs.push(`🔍 Buscando ${importType} de ${year}...`);
                setImportLogs([...logs]);

                // Fetch Pages
                for (let page = 1; page <= pagesToFetch; page++) {
                    const content = await discoverContent(importType, {
                        year,
                        genreId: importGenre,
                        page
                    });

                    if (content.length === 0) {
                        logs.push(`⚠️ Nenhum conteúdo encontrado na página ${page} de ${year}.`);
                        continue;
                    }

                    // Insert to Supabase upserting by tmdb_id
                    // We remove 'id' to let Postgres generate one if needed, or use tmdb_id logic
                    const toInsert = content.map(c => {
                        const { id, ...rest } = c; // remove temp id
                        return { ...rest, status: 'published' };
                    });

                    const table = importType === 'movie' ? 'movies' : 'series';
                    const { error } = await supabase.from(table).upsert(toInsert, { onConflict: 'tmdb_id', ignoreDuplicates: true });

                    if (error) {
                        logs.push(`❌ Erro ao inserir lote ${page}/${year}: ${error.message}`);
                    } else {
                        totalAdded += content.length;
                        logs.push(`✅ +${content.length} ${importType}s de ${year} (Pág ${page})`);
                    }
                    setImportLogs([...logs]);
                    setImportProgress(prev => ({ ...prev, added: totalAdded }));

                    // Delay polite to TMDB
                    await new Promise(r => setTimeout(r, 200));
                }
            }
            logs.push(`🎉 IMPORTAÇÃO CONCLUÍDA! Total de ${totalAdded} itens processados.`);
            setImportLogs([...logs]);

        } catch (err) {
            logs.push(`❌ Erro crítico: ${(err as any).message}`);
            setImportLogs([...logs]);
        } finally {
            setIsImporting(false);
        }
    };

    const handleManualInsert = async () => {
        if (!manualForm.title.trim()) {
            setManualInsertLog('❌ ERRO: Título é obrigatório!');
            return;
        }
        if (!manualForm.stream_url.trim()) {
            setManualInsertLog('❌ ERRO: URL do stream é obrigatória!');
            return;
        }

        setIsManualInserting(true);
        setManualInsertLog('⏳ Processando...');

        try {
            const dataToInsert = {
                title: manualForm.title.trim(),
                description: manualForm.description || null,
                stream_url: manualForm.stream_url.trim(),
                year: manualForm.year || new Date().getFullYear(),
                genre: [manualForm.genre] || ['Drama'],
                poster: manualForm.poster || '',
                backdrop: manualForm.backdrop || '',
                rating: manualForm.rating || '7.0',
                ...(manualForm.tmdb_id && { tmdb_id: parseInt(manualForm.tmdb_id) || null }),
                ...(manualType === 'movie' && { duration: manualForm.duration || null }),
                ...(manualType === 'series' && { seasons: manualForm.seasons || 1 }),
                status: 'published'
            };

            const table = manualType === 'movie' ? 'movies' : 'series';
            const { data, error } = await supabase
                .from(table)
                .insert([dataToInsert])
                .select();

            if (error) {
                setManualInsertLog(`❌ ERRO ao inserir: ${error.message}`);
                console.error('Supabase error:', error);
            } else if (data && data.length > 0) {
                setManualInsertLog(`✅ ${manualType === 'movie' ? 'Filme' : 'Série'} "${manualForm.title}" inserido com sucesso!`);
                // Resetar formulário
                setManualForm({
                    title: '',
                    description: '',
                    stream_url: '',
                    year: new Date().getFullYear(),
                    duration: '',
                    seasons: 1,
                    genre: 'Drama',
                    poster: '',
                    backdrop: '',
                    rating: '7.0',
                    tmdb_id: ''
                });
            } else {
                setManualInsertLog('⚠️ Nenhum dado retornado após insert');
            }
        } catch (err) {
            setManualInsertLog(`❌ ERRO: ${(err as any).message}`);
            console.error(err);
        } finally {
            setIsManualInserting(false);
        }
    };

    return (
        <AdminLayout>
            <div className="p-8 max-w-6xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">Gestão de Conteúdo</h1>
                    <p className="text-white/60 mt-1">Ferramentas de Importação em Massa e Limpeza de Banco de Dados.</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b border-white/10">
                    <button onClick={() => setActiveTab('manual')} className={`pb-4 px-4 font-bold ${activeTab === 'manual' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-white/40'}`}>
                        Inserção Manual
                    </button>
                    <button onClick={() => setActiveTab('import')} className={`pb-4 px-4 font-bold ${activeTab === 'import' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-white/40'}`}>
                        Importação Inteligente
                    </button>
                    <button onClick={() => setActiveTab('cleanup')} className={`pb-4 px-4 font-bold ${activeTab === 'cleanup' ? 'text-red-500 border-b-2 border-red-500' : 'text-white/40'}`}>
                        Limpeza e Manutenção
                    </button>
                </div>

                {/* --- MANUAL TAB --- */}
                {activeTab === 'manual' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="bg-[#121217] border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Upload size={20} className="text-purple-500" /> Inserir {manualType === 'movie' ? 'Filme' : 'Série'}</h3>

                                <div className="space-y-4">
                                    {/* Type */}
                                    <div>
                                        <label className="block text-xs uppercase text-white/40 font-bold mb-2">Tipo de Conteúdo</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => setManualType('movie')} className={`flex-1 py-3 rounded-xl border ${manualType === 'movie' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-white/10 hover:bg-white/5'}`}>Filme</button>
                                            <button onClick={() => setManualType('series')} className={`flex-1 py-3 rounded-xl border ${manualType === 'series' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'border-white/10 hover:bg-white/5'}`}>Série</button>
                                        </div>
                                    </div>

                                    {/* Title - OBRIGATÓRIO */}
                                    <div>
                                        <label className="block text-xs uppercase text-white/40 font-bold mb-2">Título *</label>
                                        <input
                                            type="text"
                                            value={manualForm.title}
                                            onChange={e => setManualForm({...manualForm, title: e.target.value})}
                                            placeholder="ex: The Dark Knight"
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-purple-500 outline-none"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-xs uppercase text-white/40 font-bold mb-2">Descrição</label>
                                        <textarea
                                            value={manualForm.description}
                                            onChange={e => setManualForm({...manualForm, description: e.target.value})}
                                            placeholder="ex: Uma épica história..."
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-purple-500 outline-none h-24 resize-none"
                                        />
                                    </div>

                                    {/* Stream URL - OBRIGATÓRIO */}
                                    <div>
                                        <label className="block text-xs uppercase text-white/40 font-bold mb-2">URL do Stream *</label>
                                        <input
                                            type="url"
                                            value={manualForm.stream_url}
                                            onChange={e => setManualForm({...manualForm, stream_url: e.target.value})}
                                            placeholder="https://..."
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-purple-500 outline-none"
                                        />
                                    </div>

                                    {/* Year & Genre */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs uppercase text-white/40 font-bold mb-2">Ano</label>
                                            <input
                                                type="number"
                                                value={manualForm.year}
                                                onChange={e => setManualForm({...manualForm, year: parseInt(e.target.value)})}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                                                min="1900"
                                                max="2050"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase text-white/40 font-bold mb-2">Gênero</label>
                                            <select value={manualForm.genre} onChange={e => setManualForm({...manualForm, genre: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none">
                                                {genres.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Duration/Seasons */}
                                    <div>
                                        <label className="block text-xs uppercase text-white/40 font-bold mb-2">{manualType === 'movie' ? 'Duração (ex: 140 min)' : 'Número de Temporadas'}</label>
                                        <input
                                            type="text"
                                            value={manualType === 'movie' ? manualForm.duration : manualForm.seasons}
                                            onChange={e => manualType === 'movie' ? setManualForm({...manualForm, duration: e.target.value}) : setManualForm({...manualForm, seasons: parseInt(e.target.value) || 1})}
                                            placeholder={manualType === 'movie' ? '140 min' : '1'}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-purple-500 outline-none"
                                        />
                                    </div>

                                    {/* Rating & TMDB ID */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs uppercase text-white/40 font-bold mb-2">Avaliação (0-10)</label>
                                            <input
                                                type="number"
                                                value={manualForm.rating}
                                                onChange={e => setManualForm({...manualForm, rating: e.target.value})}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                                                min="0"
                                                max="10"
                                                step="0.1"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase text-white/40 font-bold mb-2">TMDB ID (opcional)</label>
                                            <input
                                                type="number"
                                                value={manualForm.tmdb_id}
                                                onChange={e => setManualForm({...manualForm, tmdb_id: e.target.value})}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* URLs de Imagem */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs uppercase text-white/40 font-bold mb-2">URL Poster</label>
                                            <input
                                                type="url"
                                                value={manualForm.poster}
                                                onChange={e => setManualForm({...manualForm, poster: e.target.value})}
                                                placeholder="https://..."
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-purple-500 outline-none text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase text-white/40 font-bold mb-2">URL Backdrop</label>
                                            <input
                                                type="url"
                                                value={manualForm.backdrop}
                                                onChange={e => setManualForm({...manualForm, backdrop: e.target.value})}
                                                placeholder="https://..."
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-purple-500 outline-none text-xs"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleManualInsert}
                                        disabled={isManualInserting || !manualForm.title.trim() || !manualForm.stream_url.trim()}
                                        className={`w-full py-4 rounded-xl font-bold mt-6 flex items-center justify-center gap-2 ${isManualInserting || !manualForm.title.trim() || !manualForm.stream_url.trim() ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20'}`}
                                    >
                                        {isManualInserting ? <span className="animate-spin text-2xl">⏳</span> : <CheckCircle size={20} />}
                                        {isManualInserting ? 'Inserindo...' : 'INSERIR AGORA'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Status / Preview */}
                        <div className="bg-[#0b0b0f] border border-white/10 rounded-2xl p-6 flex flex-col">
                            <h4 className="font-bold text-white/60 font-mono text-xs uppercase mb-4">Status & Pré-visualização</h4>
                            
                            {/* Status Message */}
                            <div className={`p-4 rounded-xl mb-4 font-mono text-sm ${manualInsertLog.includes('❌') ? 'bg-red-500/10 border border-red-500/30 text-red-300' : manualInsertLog.includes('✅') ? 'bg-green-500/10 border border-green-500/30 text-green-300' : 'bg-blue-500/10 border border-blue-500/30 text-blue-300'}`}>
                                {manualInsertLog || 'Preencha os campos e clique em INSERIR AGORA'}
                            </div>

                            {/* Form Preview */}
                            <div className="flex-1 space-y-3 overflow-y-auto">
                                {manualForm.poster && (
                                    <div>
                                        <p className="text-xs uppercase text-white/40 font-bold mb-2">Poster Preview</p>
                                        <img src={manualForm.poster} alt="poster" className="w-full max-h-40 object-cover rounded-lg" onError={() => {}} />
                                    </div>
                                )}
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Título:</span>
                                        <span className="text-white font-bold">{manualForm.title || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Tipo:</span>
                                        <span className="text-white font-bold">{manualType === 'movie' ? '🎬 Filme' : '📺 Série'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Ano:</span>
                                        <span className="text-white font-bold">{manualForm.year}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Gênero:</span>
                                        <span className="text-white font-bold">{manualForm.genre}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/40">Avaliação:</span>
                                        <span className="text-white font-bold">⭐ {manualForm.rating}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/40">{manualType === 'movie' ? 'Duração:' : 'Temporadas:'}</span>
                                        <span className="text-white font-bold">{manualType === 'movie' ? manualForm.duration || '—' : manualForm.seasons}</span>
                                    </div>
                                    <div className="pt-2 border-t border-white/10">
                                        <span className="text-white/40">Stream URL:</span>
                                        <p className="text-white/60 text-xs mt-1 break-all">{manualForm.stream_url || 'Obrigatório'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- IMPORT TAB --- */}
                {activeTab === 'import' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="bg-[#121217] border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Database size={20} className="text-blue-500" /> Configuração</h3>

                                <div className="space-y-4">
                                    {/* Type */}
                                    <div>
                                        <label className="block text-xs uppercase text-white/40 font-bold mb-2">Tipo de Conteúdo</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => setImportType('movie')} className={`flex-1 py-3 rounded-xl border ${importType === 'movie' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-white/10 hover:bg-white/5'}`}>Filmes</button>
                                            <button onClick={() => setImportType('series')} className={`flex-1 py-3 rounded-xl border ${importType === 'series' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'border-white/10 hover:bg-white/5'}`}>Séries</button>
                                        </div>
                                    </div>

                                    {/* Filters */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs uppercase text-white/40 font-bold mb-2">Gênero</label>
                                            <select value={importGenre} onChange={e => setImportGenre(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white">
                                                <option value="Todos">Todos os Gêneros</option>
                                                {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase text-white/40 font-bold mb-2">Páginas por Ano</label>
                                            <select value={pagesToFetch} onChange={e => setPagesToFetch(parseInt(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white">
                                                <option value={1}>1 Pág (~20 itens)</option>
                                                <option value={5}>5 Págs (~100 itens)</option>
                                                <option value={10}>10 Págs (~200 itens)</option>
                                                <option value={50}>50 Págs (~1000 itens)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Year Logic */}
                                    <div>
                                        <label className="block text-xs uppercase text-white/40 font-bold mb-2">Período</label>
                                        <div className="flex items-center gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                                            <select value={importYearMode} onChange={e => setImportYearMode(e.target.value as any)} className="bg-transparent text-white font-bold outline-none border-b border-white/20 pb-1">
                                                <option value="single">Apenas no ano</option>
                                                <option value="range">Deste ano até hoje</option>
                                            </select>
                                            <input
                                                type="number"
                                                value={importYearStart}
                                                onChange={e => setImportYearStart(e.target.value)}
                                                className="bg-transparent border-b border-white/20 w-24 text-center pb-1 text-white font-mono"
                                                min="1900"
                                                max="2030"
                                            />
                                        </div>
                                        {importYearMode === 'range' && (
                                            <p className="text-xs text-green-400 mt-2 flex items-center gap-1"><RefreshCw size={12} /> O sistema irá buscar de <b>{importYearStart}</b> até <b>{new Date().getFullYear()}</b> sequencialmente.</p>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleImport}
                                        disabled={isImporting}
                                        className={`w-full py-4 rounded-xl font-bold mt-4 flex items-center justify-center gap-2 ${isImporting ? 'bg-white/10 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20'}`}
                                    >
                                        {isImporting ? <span className="animate-spin text-2xl">⏳</span> : <Play size={20} />}
                                        {isImporting ? 'Importando...' : 'INICIAR IMPORTAÇÃO'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Logs Console */}
                        <div className="bg-[#0b0b0f] border border-white/10 rounded-2xl p-6 flex flex-col h-[500px]">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-white/60 font-mono text-xs uppercase">Terminal de Execução</h4>
                                <span className="text-green-500 font-mono text-xs">{importProgress.added} itens adicionados</span>
                            </div>
                            <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 p-2">
                                {importLogs.length === 0 && <p className="text-white/20 italic text-center mt-20">Aguardando comando...</p>}
                                {importLogs.map((log, i) => (
                                    <div key={i} className={`p-1 border-l-2 pl-2 ${log.includes('Erro') ? 'border-red-500 text-red-400' : log.includes('✅') ? 'border-green-500 text-green-300' : 'border-blue-500 text-white/70'}`}>
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CLEANUP TAB --- */}
                {activeTab === 'cleanup' && (
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-red-900/10 border border-red-500/30 p-8 rounded-3xl space-y-6">
                            <div className="flex items-center gap-4 text-red-500 mb-4">
                                <AlertTriangle size={40} strokeWidth={1.5} />
                                <div>
                                    <h2 className="text-2xl font-bold">Zona de Perigo</h2>
                                    <p className="text-red-300/60 text-sm">Ações aqui são irreversíveis e destrutivas.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase text-white/40 font-bold mb-2">O que apagar?</label>
                                    <select value={cleanupType} onChange={(e) => setCleanupType(e.target.value as any)} className="w-full bg-black/40 border border-red-500/20 rounded-xl px-4 py-3 text-white">
                                        <option value="movie">Apenas Filmes</option>
                                        <option value="series">Apenas Séries</option>
                                        <option value="all">TUDO (Filmes e Séries)</option>
                                    </select>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs uppercase text-white/40 font-bold">Selecionar Anos para Apagar</label>
                                        <button onClick={selectAllYears} className="text-xs text-red-400 hover:text-red-300 font-bold">
                                            {selectedYears.size === catalogYears.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                        </button>
                                    </div>

                                    {loadingYears ? (
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-8 text-center text-white/30">Carregando anos do catálogo...</div>
                                    ) : catalogYears.length === 0 ? (
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-8 text-center text-white/30">Nenhum conteúdo no catálogo.</div>
                                    ) : (
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-4 max-h-64 overflow-y-auto space-y-1">
                                            {catalogYears.map(({ year, movies, series }) => (
                                                <label key={year} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors ${selectedYears.has(year) ? 'bg-red-500/10 border border-red-500/20' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedYears.has(year)}
                                                        onChange={() => toggleYear(year)}
                                                        className="rounded border-white/20 bg-black/20 text-red-600 focus:ring-offset-0 focus:ring-red-500"
                                                    />
                                                    <span className="font-bold text-white flex-1">{year}</span>
                                                    <span className="text-xs text-white/40">
                                                        {movies > 0 && <span className="text-red-400">{movies} filme{movies > 1 ? 's' : ''}</span>}
                                                        {movies > 0 && series > 0 && <span className="mx-1">•</span>}
                                                        {series > 0 && <span className="text-blue-400">{series} série{series > 1 ? 's' : ''}</span>}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {selectedYears.size > 0 && (
                                        <p className="text-xs text-red-400 mt-2 font-bold">
                                            {selectedYears.size} ano{selectedYears.size > 1 ? 's' : ''} selecionado{selectedYears.size > 1 ? 's' : ''} para exclusão
                                        </p>
                                    )}
                                </div>

                                <button
                                    onClick={handleCleanup}
                                    disabled={isCleaning || selectedYears.size === 0}
                                    className={`w-full py-4 font-bold rounded-xl mt-4 flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 ${selectedYears.size === 0 ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                                >
                                    {isCleaning ? 'Apagando...' : <Trash2 size={20} />}
                                    {isCleaning ? 'Processando...' : `EXECUTAR LIMPEZA (${selectedYears.size} ano${selectedYears.size !== 1 ? 's' : ''})`}
                                </button>
                            </div>

                            {/* Cleanup Logs */}
                            {cleanupLog.length > 0 && (
                                <div className="mt-6 bg-black/40 rounded-xl p-4 font-mono text-xs space-y-1 max-h-40 overflow-y-auto">
                                    {cleanupLog.map((l, i) => <p key={i} className="text-red-300">{l}</p>)}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default Ingestion;
