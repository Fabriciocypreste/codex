# Como o Player Funciona (Pure HTML5 - No HLS)

Este documento serve como referência técnica para o funcionamento do player de vídeo do projeto RED X.

## 🚀 Arquitetura Atual
O player foi simplificado para usar **100% HTML5 Nativo** em todas as frentes (Filmes, Séries e Canais), removendo completamente a biblioteca `hls.js` e serviços complexos vinculados a ela.

### Arquivos Principais
- `pages/Player.tsx`: Componente principal para Filmes e Séries (100% HTML5, com vinheta).
- `components/LiveTVVideo.tsx`: Componente para Canais (Híbrido, SEM vinheta).
- `public/vinheta.mp4`: Vídeo de introdução (7.5MB).

## 🎞️ Sistema de Vinheta e Canais
1. **Vinheta**: Executada apenas em **filmes e séries** para garantir uma transição premium ao carregar o conteúdo principal.
2. **Canais (LiveTV)**:
   - **Sem Vinheta**: Removida conforme solicitação para maior agilidade no zapping. 
   - **Canal Padrão**: Globo RJ Capital 4K (se não houver histórico).
   - **Erro Corrigido**: Restabelecido o fallback para `playNative` em dispositivos Android TV, pois o WebView padrão não suporta `.m3u8` de forma estável.
   - **Áudio**: Agora os canais iniciam **desmutados** por padrão, respeitando o uso em TV Box.
   - **Interface**: Adicionado spinner de carregamento e ajuste de proporção (`object-contain`).

## 🛠️ Características do Player
1. **Zero HLS.js**: Nenhuma referência à biblioteca HLS ou `hlsStreamingService.ts`.
2. **Tag `<video>` Nativa**: Utiliza a tag padrão do HTML5 para reprodução de MP4, WebM e M3U8 (em dispositivos/navegadores que possuem suporte nativo).
3. **Controles Customizados**:
   - Play/Pause.
   - Seek (barra de progresso).
   - Controle de Volume e Mute.
   - Alternância de Fullscreen.
4. **Gerenciamento de Estado**:
   - `streamUrl`: Gerencia a URL de reprodução vinda de Props ou Parâmetros de URL.
   - `isLoading`: Estado de buffering/carregamento.
   - `showControls`: Auto-hide dos controles após 3 segundos de inatividade.
5. **Persistência de Progresso**:
   - Salva o progresso automaticamente a cada 10 segundos no Supabase via `userService.saveProgress`.

## 🆘 Como Corrigir se Estragar
Se o player parar de funcionar ou alguém reintroduzir o HLS.js e causar instabilidade:

1. **Verifique o `Player.tsx`**: Ele deve ser curto (~330 linhas) e não deve ter `import Hls from 'hls.js'`.
2. **Mantenha Simples**: A lógica de reprodução deve se basear apenas em setar o `src` da tag `<video>`.
3. **Erros de Build**: Geralmente causados por imports de arquivos deletados (como `hlsStreamingService.ts`). Remova esses imports.
4. **Canais m3u8**: Se os canais pararem de funcionar no Fire Stick/Android, verifique se o WebView do sistema está atualizado, pois ele é quem provê o suporte nativo ao HLS no HTML5.

**Status Final**: O player agora é leve, rápido e fácil de manter.
