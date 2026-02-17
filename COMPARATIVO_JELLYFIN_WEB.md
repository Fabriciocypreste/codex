# Análise: Jellyfin Web vs REDX — o que usar no seu projeto

Referência: [jellyfin/jellyfin-web](https://github.com/jellyfin/jellyfin-web) (cliente web oficial do Jellyfin, usado em browser, Android, iOS e TVs).

---

## 1. Como o Jellyfin Web funciona (resumo)

### 1.1 Arquitetura

- **Stack**: JavaScript/TypeScript, Webpack/Vite, React em partes novas, controllers/elements legados.
- **Estrutura** (trecho do [README](https://github.com/jellyfin/jellyfin-web)):
  - `src/apps/` — apps (dashboard, experimental, stable, wizard)
  - `src/components/` — componentes de UI e **focusManager**, scrollManager, etc.
  - `src/scripts/` — **inputManager**, **keyboardNavigation**, **gamepadtokey**, scrollHelper
  - `src/elements/` — web components (emby-scroller, emby-button, etc.) com suporte a foco
  - `src/controllers/` — views legadas

### 1.2 Detecção de TV e layout

- **`layoutManager`** (`src/components/layoutManager.js`):
  - `tv`, `mobile`, `desktop` definidos por layout salvo ou `autoLayout()`.
  - `autoLayout()` usa **`browser.tv`** (ou `browser.xboxOne`, `browser.ps4`) para definir modo TV.
- **`browser`** (`src/scripts/browser.js`):
  - `browser.tv = isTv()`: user-agent com `tv`, `samsungbrowser`, `viera`, ou Web0s (LG).
  - Em **Capacitor/WebView Android TV** o user-agent pode não ter "tv"; no seu caso a injeção de D-pad na Activity já resolve o input.

### 1.3 Navegação por teclado / D-pad (fluxo)

1. **keyboardNavigation.js**
   - Escuta `keydown` global.
   - Só trata setas/navegação se **`layoutManager.tv`** for true (em desktop ignora setas para não conflitar com scroll).
   - Converte `keyCode` em nome (`KeyNames`: 37→ArrowLeft, 38→ArrowUp, etc.) e trata também **Back** (461 WebOS, 10009 Tizen), **Escape**, **MediaPlay**, etc.
   - Chama **`inputManager.handleCommand('left'|'right'|'up'|'down'|'back'|'select'|...)`.

2. **inputManager.js**
   - `handleCommand(commandName)`:
     - Define `sourceElement` (elemento focado ou dialog ativo).
     - Dispara evento `command` (custom) para listeners opcionais.
     - Objeto **keyActions**: `'up'` → `focusManager.moveUp(sourceElement)`, `'down'` → `focusManager.moveDown`, etc.; `'back'` → `appRouter.back()` ou `appHost.exit()`; `'select'` → `select(sourceElement)` (click).

3. **focusManager.js**
   - **Navegação espacial por proximidade** (estilo “nearest neighbor”):
     - `moveUp` / `moveDown` / `moveLeft` / `moveRight(sourceElement, options)`.
     - Usa **containers** (`.focuscontainer`, `.focuscontainer-x`, `.focuscontainer-y`) e **elementos focáveis**: `BUTTON`, `A`, `INPUT`, etc. ou classe `.focusable`.
     - Calcula distância geométrica (getBoundingClientRect) e interseção para achar o próximo elemento na direção (0=left, 1=right, 2=up, 3=down).
   - `autoFocus(view)`, `focus(element)`, `focusableParent`, `getFocusableElements`, `moveFocus` (lista linear com offset).

4. **gamepadtokey.js**
   - Lazy-loaded quando `gamepadconnected` dispara.
   - Mapeia botões do gamepad (D-pad 12–15, A, B, thumbstick) para **keydown** sintéticos (keyCode 37–40, 13, 27), que caem no mesmo fluxo do **keyboardNavigation** → **inputManager** → **focusManager**.

5. **scrollHelper.ts**
   - `toCenter(container, elem, horizontal)`: centraliza o elemento no scroll (horizontal ou vertical).
   - Usado em **emby-scroller**: no `focus` do elemento, chama `toCenter` para manter o item focado visível e centralizado.

### 1.4 Padrões de UI para TV

- Elementos focáveis: `tabindex` não `-1`, ou classe **`.focusable`**.
- Containers: **`.focuscontainer`**, **`.focuscontainer-x`**, **`.focuscontainer-y`** para delimitar regiões de navegação.
- **emby-scroller**: atributos `data-navcommands`, `data-centerfocus`; ao receber foco, centraliza o item no scroll.
- **show-focus**: classe para exibir anel de foco em TV (`layoutManager.tv`).
- **data-id** em listas para restaurar foco por item (ex.: ItemsContainer).

---

## 2. Comparação: Jellyfin Web vs REDX

| Aspecto | Jellyfin Web | REDX (seu projeto) |
|---------|--------------|---------------------|
| **Framework UI** | Híbrido (legado + React) | React + Vite |
| **Navegação espacial** | focusManager (proximidade por rect + focuscontainer) | useSpatialNavigation (data-nav-row / data-nav-item / data-nav-col + proximidade) |
| **Entrada de comandos** | inputManager.handleCommand('up'|'down'|…) | keydown → useSpatialNavigation (ArrowUp/Down/Left/Right, Enter, Escape) + handleTVBack no App |
| **Teclas de mídia** | Sim (MediaPlay, Pause, Rewind, etc.) no inputManager | Parcial (Player trata setas/Enter; sem mapa de mídia global) |
| **Gamepad** | gamepadtokey.js converte gamepad → keydown | Não (no WebView Android TV o D-pad vem pela injeção nativa) |
| **Back** | inputManager 'back' → appRouter.back() ou appHost.exit() | onBackPressed injeta Escape → handleTVBack() no App |
| **Modo TV** | layoutManager.tv (browser.tv + appHost) | Implícito (sempre “pronto para TV” com D-pad injetado) |
| **Scroll no foco** | scrollHelper.toCenter + emby-scroller | tvScroll.scrollToFocusedElement / scrollRowToElement + useSpatialNavigation |
| **Marcação de foco** | .focusable, .focuscontainer, autofocus | data-nav-row, data-nav-item, data-nav-col |
| **Detecção TV (UA)** | browser.tv (user-agent) | Não usado (foco em Android TV via native) |

---

## 3. O que vale a pena usar / adaptar do Jellyfin no REDX

### 3.1 Já alinhado com o que você tem

- **Injeção de D-pad no Android** (MainActivity + `__dispatchTVKey__`): já implementado; no Jellyfin o input chega por keydown (Tizen/WebOS) ou por gamepadtokey; no seu caso o fluxo é equivalente após a injeção.
- **Navegação por setas + Enter + Back**: você já tem (useSpatialNavigation + handleTVBack). O Jellyfin faz o mesmo via inputManager + focusManager.

### 3.2 Ideias que você pode incorporar

1. **Detecção explícita de “modo TV” (opcional)**  
   - No Jellyfin, `layoutManager.tv` desliga navegação por setas em desktop. No seu app, se no futuro rodar em desktop e TV, pode:
     - Detectar TV por user-agent (ex.: lógica tipo `browser.tv` do Jellyfin) ou por Capacitor (ex.: `Capacitor.getPlatform() === 'android'` + flag).
     - Só então ativar comportamento “só D-pad” (ex.: prevenir scroll com setas na Home) ou classes `.show-focus`.
   - Arquivo de referência: `platforms/jellyfin-web/src/scripts/browser.js` (isTv), `platforms/jellyfin-web/src/components/layoutManager.js`.

2. **Mapa de teclas de mídia (Player)**  
   - Jellyfin mapeia MediaPlay, Pause, MediaRewind, MediaFastForward, etc. para comandos de playback.  
   - No seu Player pode adicionar um `keydown` (ou usar os eventos já injetados) para:
     - Space / MediaPlayPause → play/pause
     - MediaRewind / MediaFastForward (ou teclas que a TV enviar) → seek
   - Referência: `platforms/jellyfin-web/src/scripts/keyboardNavigation.js` (KeyNames + switch) e `platforms/jellyfin-web/src/scripts/inputManager.js` (keyActions play/pause/rewind/…).

3. **Centralizar scroll no foco (rows)**  
   - Você já tem `scrollRowToElement` em `utils/tvScroll.ts`. O Jellyfin faz algo parecido com `scrollHelper.toCenter` + listener de `focus` no scroller.  
   - Vale garantir que **todas as rows** (MediaRow, etc.) chamem `scrollRowToElement` (ou equivalente) quando o foco mudar para um item da row, para comportamento consistente com Jellyfin em TV.

4. **Classe `.focusable` + tabindex**  
   - No Jellyfin, elementos focáveis usam `.focusable` e/ou tabindex não -1. No seu projeto, `data-nav-item` já marca itens.  
   - Opcional: em elementos que devem receber foco nativo (ex.: botões dentro de MediaCard), adicionar `tabIndex={0}` e classe `focusable` para acessibilidade e consistência com o que o Jellyfin faz.

5. **Gamepad (navegador / futuras plataformas)**  
   - Se um dia o app rodar em um ambiente onde o gamepad envia eventos (ex.: browser em console), pode carregar um módulo tipo **gamepadtokey**: escutar `gamepadconnected` e converter botões em keydown (Arrow*, Enter, Escape). O Jellyfin faz isso em `platforms/jellyfin-web/src/scripts/gamepadtokey.js`. Não é prioritário para Android TV com injeção nativa.

6. **Comando “Back” unificado**  
   - Jellyfin trata Back (key 461/10009), Escape e, em alguns dispositivos, Backspace como `handleCommand('back')`. Você já unifica Escape e Back no App (handleTVBack). Pode documentar que “Back” = Escape injetado no Android e manter um único ponto de decisão (ex.: handleTVBack) para não duplicar lógica.

---

## 4. O que não é necessário copiar

- **focusManager completo**: sua lógica com `data-nav-row` / `data-nav-item` / `data-nav-col` e algoritmo de proximidade no useSpatialNavigation já cobre o mesmo objetivo. Migrar para o focusManager do Jellyfin exigiria trocar toda a marcação de UI (para .focuscontainer/.focusable) e não traz ganho claro.
- **inputManager + evento `command`**: você já tem fluxo direto keydown → useSpatialNavigation + handleTVBack. O padrão “command” do Jellyfin é útil para muitos clientes (Tizen, WebOS, etc.); no REDX o fluxo atual é suficiente.
- **Estrutura de pastas/controllers do Jellyfin**: é legado e específico do ecossistema Jellyfin; manter a estrutura React atual do REDX é mais coerente.

---

## 5. Checklist prático (o que usar agora)

- [x] Manter injeção D-pad + Back no MainActivity (já feito).
- [ ] (Opcional) Detectar “modo TV” (user-agent ou Capacitor) e usar só para UI (ex.: mostrar anel de foco, desativar scroll por setas em desktop).
- [ ] No Player: mapear teclas de mídia (Space, MediaPlayPause, etc.) se o dispositivo enviar; usar referência do keyboardNavigation + inputManager do Jellyfin.
- [ ] Garantir que ao mudar foco em uma row (MediaRow) seja chamado scrollRowToElement / scrollToFocusedElement para centralizar (já tem em tvScroll; conferir uso em todos os rows).
- [ ] (Opcional) Em botões/cards que precisem de foco nativo: `tabIndex={0}` e classe `focusable` para acessibilidade.
- [ ] (Futuro) Se rodar em ambiente com gamepad no browser: considerar módulo tipo gamepadtokey para converter gamepad → keydown.

Com isso, você mantém o desenho atual do REDX e incorpora só o que o Jellyfin faz de melhor (teclas de mídia, scroll no foco, opcionalmente detecção TV e gamepad) sem reescrever a navegação espacial.
