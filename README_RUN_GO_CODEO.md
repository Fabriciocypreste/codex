Getting started: run `populate_supabase.go` with GoCodeo/Go

1) Pré-requisitos
- Instalar Go SDK (https://go.dev/dl/) e adicionar `go` ao PATH.
- Instalar a extensão GoCodeo (ou a extensão oficial `golang.go`) no VS Code.

2) Abrir o projeto no VS Code

3) Executar via Run/Debug
- Abra a paleta (F1) → `Debug: Open` e selecione `Run populate_supabase.go`.
- O `launch.json` usa `envFile` apontando para `.env`, então as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` serão carregadas como `SUPABASE_URL` e `SUPABASE_KEY` no processo Go.

4) Ou executar a task
- Abra `Terminal → Run Task...` → escolha `Run populate (Windows PowerShell)`.

5) Segurança
- Recomendo usar a Service Role Key apenas em ambiente local seguro. Se você usar a anon key e tiver RLS, o upsert pode falhar.
