# RELATÓRIO DE AUDITORIA TÉCNICA — RED X (TV BOX)

✔ Regra global aplicada. Executarei somente o que você pedir.

---

## DIAGNÓSTICO EXECUTIVO
O projeto RED X apresenta um amadurecimento técnico notável em termos de **experiência de usuário (UX)** e **performance de renderização** (uso de Virtualization e LazyLoading). No entanto, a **arquitetura de pastas** e o **acoplamento de lógica** nos componentes (`God Components`) são os principais gargalos para a escalabilidade e manutenção.

- **Score Técnico Geral**: 7.5 / 10
- **Nível do Projeto**: Transição Beta → Produção
- **Risco para Produção**: Médio (Principalmente por estabilidade de stream e segurança de RLS)

---

## ETAPA 1 — ANÁLISE DE ARQUITETURA

### Problemas Encontrados:
1.  **Estrutura Não-Standard (Crítico)**: Pastas como `pages`, `components` e `services` estão na raiz, fora de `src/`. Isso quebra padrões de tooling e dificulta a gestão de aliases.
2.  **God Components (Alto)**: `LiveTV.tsx` (939 linhas) e `Settings.tsx` (82KB) concentram lógica de UI, navegação D-Pad, requisições Supabase e processamento de dados. 
3.  **Serviços Monolíticos (Médio)**: `supabaseService.ts` contém interfaces, inicialização e lógica de negócio misturadas.

### Correção Recomendada:
- Migrar pastas para `/src`.
- Aplicar **Pattern de Hooks de Domínio**: Extrair lógica de `LiveTV.tsx` para `useLiveTVController.ts`.

---

## ETAPA 2 — PERFORMANCE

### Pontos Positivos:
- Implementação excelente de `VirtualGrid.tsx` e `LazyImage.tsx`.

### Pontos de Risco:
1.  **useSpatialNavigation Indexing (Médio)**: O hook de 31KB realiza cálculos de `getBoundingClientRect` frequentes. Em TV Boxes de 1GB RAM, isso pode causar input lag.
2.  **Falta de `React.memo` em Modais**: Modais de configuração re-renderizam o `HeroBanner` ao fundo sem necessidade.

### Correção Exemplo (Memoization):
```tsx
const MemoizedCard = React.memo(({ data }) => <MediaCard media={data} />);
```

---

## ETAPA 3 — PLAYER DE VÍDEO

### Diagnóstico:
- A remoção do `hls.js` foi positiva para simplicidade, mas a falta de um **Retry-Exponential-Backoff** pode gerar telas pretas em canais com oscilação.

### Estratégia Ideal:
- Manter o modo híbrido atual: **Nativo (ExoPlayer)** para Android TV Box (estabilidade de HLS) e **HTML5** para Web.
- **Implementar Timeout Watchdog**: Se o vídeo não disparar o evento `playing` em 10s, forçar reload ou fallback.

---

## ETAPA 4 — NAVEGAÇÃO D-PAD

### Análise:
- O sistema de proximidade geométrica é robusto, mas sensível a mudanças no DOM.

### Problema:
- **Perda de Foco em Render**: Ao recarregar uma row, o foco "pula" para o topo.
- **Correção**: Implementar `focus-persistence` salvando o `id` do elemento focado e restaurando-o no `useEffect` pós-render.

---

## ETAPA 5 — SEGURANÇA

### Vulnerabilidades:
1.  **Configuração Cleartext (Alta)**: `capacitor.config.ts` com `cleartext: true` permite tráfego HTTP inseguro.
2.  **Supabase RLS (Média)**: Necessário auditar se as tabelas de `UserSettings` possuem políticas que impeçam um UUID de acessar dados de outro.

### Plano de Correção:
- Forçar HTTPS em produção.
- Revisar `supabase_schema.sql` para garantir `policy (auth.uid() = user_id)`.

---

## ETAPA 6 — TAMANHO DO APK

### Diagnóstico:
- **APK Atual**: ~17MB (Bom), mas com risco de inflar.
- **Riscos**: Arquivos `.zip` e `.mp4` na raiz podem estar sendo incluídos no build se não houver `.dockerignore` ou regra de exclusão agressiva no Vite.

### Estratégia:
- Mover `vinheta.mp4` para um CDN ou compactar via FFmpeg (alvo: < 2MB).
- Usar `minify: 'terser'` (já configurado, excelente).

---

## ETAPA 7 — SUPABASE / BACKEND

### Otimizações:
- **Redundância de Queries**: `fetchAllRows` em tabelas grandes sem paginação severa causará lentidão.
- **Recomendação**: Implementar `limit/offset` ou paginação baseada em cursor para o catálogo.

---

## ROADMAP DE 30 DIAS

1.  **Semana 1 (Estabilidade)**: Refatorar `LiveTVVideo` (Concluído) + Implementar Watchdog de Error Recovery no Player.
2.  **Semana 2 (Arquitetura)**: Migrar pastas para `/src` e quebrar `useSpatialNavigation` em sub-hooks menores.
3.  **Semana 3 (Performance)**: Auditar re-renders com React DevTools e aplicar `memo` em UI components.
4.  **Semana 4 (Segurança & Build)**: Revisão final de RLS e build de APK otimizado com exclusão de assets mortos.

**Nível do Projeto**: 🚀 **Quase Pronto para Escala.**
