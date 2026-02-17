# GoCodeo Prompt — Popular Supabase com exemplos 2022+

Instruções para usar com a extensão GoCodeo (cole todo o conteúdo no assistente GoCodeo):

Objetivo
- Gerar/ajustar um script Go que faça upsert em `movies` e `series` no Supabase usando a REST API `/rest/v1`.

Requisitos do projeto
- O repositório tem `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Queremos usar `tmdb_id` como `on_conflict` para evitar duplicatas.

Detalhes do payload
- Campos permitidos (movies): `title, description, poster, backdrop, logo_url, stream_url, year, genre (array), rating, tmdb_id, status`.
- Campos permitidos (series): `title, description, poster, backdrop, year, genre (array), rating, tmdb_id, status, seasons`.

Comportamento desejado
1. Ler `SUPABASE_URL` e `SUPABASE_KEY` das variáveis de ambiente (não hardcodear).
2. Fazer `POST` para `${SUPABASE_URL}/rest/v1/movies?on_conflict=tmdb_id` com header `apikey` e `Authorization: Bearer <key>` e `Prefer: return=representation`.
3. Tratar erros HTTP (401/403/4xx/5xx) e imprimir body para debug.
4. Logar IDs retornados em caso de sucesso.
5. Repetir para `series`.

Melhorias opcionais
- Permitir rodar em modo `--dry-run` que mostra payloads sem enviar.
- Validar formato de `genre` (array) antes de enviar.

Exemplo de prompt curto para GoCodeo
"Crie um script Go que leia SUPABASE_URL e SUPABASE_KEY do ambiente e faça upsert em /rest/v1/movies e /rest/v1/series usando on_conflict=tmdb_id. Use headers apikey/Authorization e Prefer:return=representation. Trate erros e imprima a resposta. Adicione flag --dry-run. Priorize clareza e tratamento de erro robusto." 

Use esse arquivo como ponto de partida para gerar uma versão final com GoCodeo.
