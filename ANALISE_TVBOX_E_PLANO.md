# Análise: Por que o app não funciona na TV Box e plano de correção

## Resumo executivo

O projeto **REDX (React + Vite + Capacitor)** já tem:

- **AndroidManifest** com `LEANBACK_LAUNCHER` e `touchscreen required=false`
- **Navegação espacial em JS** (`useSpatialNavigation`) com `ArrowUp/Down/Left/Right`, `Enter`, `Escape`/`Backspace`
- **UI preparada para D-pad** (`data-nav-row`, `data-nav-item`, `data-nav-col`)

Na **TV Box**, o app não responde ao controle remoto porque **os eventos do D-pad não chegam ao JavaScript**: no Android, o WebView **não recebe** por padrão as teclas do controle (KEYCODE_DPAD_*). Elas são consumidas pela camada nativa antes de chegarem ao `keydown` no browser.  
A correção principal é **interceptar essas teclas na Activity e injetá-las no WebView** (por exemplo via `evaluateJavascript`), mantendo o resto da lógica em JS.

---

## 1. Comparação com repositórios de referência

### 1.1 [android/tv-samples](https://github.com/android/tv-samples) (Leanback, ReferenceAppKotlin)

| Aspecto | tv-samples (Leanback / Reference) | Nosso projeto |
|--------|-----------------------------------|----------------|
| **Tipo de UI** | Nativa (Leanback SDK, RecyclerView, fragments) | WebView (Capacitor) com React |
| **D-pad** | Tratado nativamente (focus, setOnKeyListener) | Só em JS (`keydown`), que **não recebe** D-pad no WebView na TV |
| **Manifest** | `android.software.leanback` **required=true**; só `LEANBACK_LAUNCHER` na Activity TV | `leanback` **required=false**; mesma Activity com `LAUNCHER` + `LEANBACK_LAUNCHER` |
| **Orientação TV** | `screenOrientation="landscape"` na Activity TV | Não definido |
| **Banner** | `android:banner` para ícone na home da TV | Tem `banner` |
| **Dependências** | `leanback`, `leanback-preference`, ExoPlayer extension-leanback | Nenhuma lib Leanback (não obrigatório para app WebView) |

Conclusão: nos samples a navegação é **toda nativa**. No nosso caso, a lógica de navegação já está em JS; o que falta é **fazer as teclas do D-pad chegarem ao WebView**.

### 1.2 VLC for Android / IPTV players (nativos)

- **VLC Android** e **IPTV players** (ex.: iptv-android, AndroidTVMediaPlayer) são apps **nativos** (Kotlin/Java).
- Controle remoto (D-pad, Enter, Back) é tratado com:
  - `dispatchKeyEvent()` / `onKeyDown()` na Activity
  - `setOnKeyListener` em views
  - CEC/Bluetooth/IR no sistema.
- Não usam WebView para a UI principal; por isso não precisam “injetar” teclas no JS.

Para nosso projeto (híbrido WebView), a abordagem correta é: **manter a UI em React e, no Android, apenas repassar os key events do D-pad para o WebView** (injeção de eventos ou de chamadas JS).

### 1.3 Jellyfin (plataformas no repo)

- Em `platforms/jellyfin-web` há **focusManager**, **keyboardNavigation**, **gamepadtokey** (mapeamento de D-pad/gamepad para teclado).
- Isso funciona em **browsers** (onde `keydown` recebe setas e Enter). Na **TV Box**, o problema não é o mapeamento em JS, e sim o fato de o **WebView não receber** os eventos do D-pad; então a solução continua sendo no lado nativo (Activity).

---

## 2. O que está errado / o que falta

### 2.1 Causa raiz: D-pad não chega ao WebView

- No Android, teclas **KEYCODE_DPAD_UP/DOWN/LEFT/RIGHT** e **KEYCODE_DPAD_CENTER** são muitas vezes tratadas pelo sistema (navegação de foco) e **não disparam** `keydown`/`keyup` normais no conteúdo do WebView.
- O `useSpatialNavigation` escuta `window.addEventListener('keydown', handler)` e reage a `e.key === 'ArrowUp'`, `'ArrowDown'`, etc. Na TV Box, esses eventos **não são gerados** para o conteúdo web.
- **Back** (KEYCODE_BACK): em vários dispositivos também não chega como `keydown` no WebView; o app já trata Back em `MainActivity.onBackPressed()` para `webView.goBack()`, mas não envia um “Escape” para o JS quando não há histórico.

**O que falta:** na **Activity** (ou na Bridge do Capacitor), interceptar **KEYCODE_DPAD_*** e **KEYCODE_BACK** e:

1. Enviar ao WebView um evento de teclado sintético (ou uma chamada JS) que o `useSpatialNavigation` e o `App.tsx` entendam (ArrowUp/Down/Left/Right, Enter, Escape).
2. Garantir que o WebView possa receber foco para que a injeção faça sentido.

### 2.2 Manifest e comportamento em TV

- **leanback required=false**: o app aparece em TVs, mas não se declara “obrigatório leanback”; pode ser mantido assim se quiser rodar em phone e TV com o mesmo APK.
- **Mesma Activity para LAUNCHER e LEANBACK_LAUNCHER**: é válido; amostras como Leanback usam Activities separadas (phone vs TV) por opção de design, não obrigatório.
- **Orientação**: em TV, definir `screenOrientation="landscape"` na Activity principal evita rotação indesejada.
- **Banner**: já existe; conferir se o drawable existe e está visível na home da TV.

### 2.3 Foco e comportamento do WebView

- O WebView precisa ser **focusable** e receber foco para que, após injetar teclas, o conteúdo reaja.
- Em alguns dispositivos, o primeiro foco pode ir para a barra de sistema; garantir que a Activity dê foco ao WebView ao abrir (por exemplo em `onResume` ou após carregar a página) melhora a experiência.

### 2.4 Resumo do que falta

| Item | Prioridade | Descrição |
|------|------------|-----------|
| **Injetar D-pad no WebView** | **Alta** | Override de `dispatchKeyEvent` na Activity (ou Bridge), mapear KEYCODE_DPAD_* e KEYCODE_ENTER para Arrow* e Enter e enviar ao WebView (evento sintético ou `evaluateJavascript`). |
| **Tratar KEYCODE_BACK** | **Alta** | Quando `!webView.canGoBack()`, injetar no JS um evento “Escape”/“Back” para o `handleTVBack()` do App.tsx. |
| **WebView focusable e foco inicial** | **Média** | Garantir `setFocusable(true)` e dar foco ao WebView na abertura. |
| **Orientação landscape (TV)** | **Média** | `screenOrientation="landscape"` na MainActivity para TV. |
| **Leanback required** | **Baixa** | Opcional: `required=true` se quiser declarar app “só TV”. |
| **Testes em dispositivo real** | **Alta** | Validar em TV Box com controle remoto físico. |

---

## 3. Plano de implementação

### Fase 1: D-pad e Back no WebView (obrigatório)

1. **MainActivity (ou subclasse de BridgeActivity)**  
   - Override `dispatchKeyEvent(KeyEvent event)`:
     - KEYCODE_DPAD_UP → injetar `ArrowUp`
     - KEYCODE_DPAD_DOWN → injetar `ArrowDown`
     - KEYCODE_DPAD_LEFT → injetar `ArrowLeft`
     - KEYCODE_DPAD_RIGHT → injetar `ArrowRight`
     - KEYCODE_DPAD_CENTER ou KEYCODE_ENTER → injetar `Enter`
     - KEYCODE_BACK: se `!webView.canGoBack()`, injetar `Escape` (ou `Backspace`) e retornar `true`; senão chamar `super`.
   - Injeção: usar `getBridge().getWebView().evaluateJavascript("...", null)` para executar JS que dispara um `KeyboardEvent` sintético com `key` e `keyCode` corretos, para o mesmo handler que já existe no `useSpatialNavigation` e no `App.tsx`.

2. **JavaScript (página)**  
   - Expor uma função global (ex.: `window.__dispatchTVKey__({ key: 'ArrowUp' })`) que:
     - Cria um `KeyboardEvent('keydown', { key, keyCode, bubbles: true })` e dispara em `document` ou `window`.
   - Ou: o código nativo injetar diretamente a chamada que dispara esse evento, para não depender de função com nome fixo (por exemplo, um script que chama `document.dispatchEvent(new KeyboardEvent(...))`).

3. **Testes**  
   - Rodar em TV Box ou emulador Android TV e confirmar: setas movem o foco, Enter seleciona, Back volta tela.

### Fase 2: Ajustes de manifesto e foco

4. **AndroidManifest**  
   - Na `<activity>` da MainActivity, adicionar `android:screenOrientation="landscape"` (ou usar `screenOrientation` apenas para variante TV, se no futuro separar build). **Feito.**
   - Revisar se `android:banner` aponta para um recurso existente: **sim** — `@mipmap/ic_launcher` existe. Para ícone mais adequado na home da TV (formato horizontal), pode-se criar depois um drawable 320x180 e referenciar em `android:banner`.

5. **WebView focusable**  
   - No código que configura o WebView (Capacitor/Bridge), garantir que seja focusable e que receba foco ao iniciar (ex.: após `onPageFinished` ou no `onResume` da Activity).

**Nota:** `screenOrientation="landscape"` foi aplicado no manifesto. Em dispositivos apenas phone, se quiser permitir portrait, remova esse atributo ou use um build flavor (ex.: TV vs phone).

### Fase 3: Opcional (melhorias)

6. **Leanback required**  
   - Se quiser que o app seja “só TV”, definir `android.software.leanback` com `required="true"`.

7. **Capacitor plugin**  
   - Opcional: extrair a lógica de D-pad para um plugin Capacitor (Android) que dispare eventos no JS, para manter o MainActivity mais limpo e reutilizável.

8. **Acessibilidade e indicador de foco**  
   - O projeto já tem indicador de foco no `useSpatialNavigation`; em TV é importante que o elemento focado seja bem visível (já considerado).

---

## 4. Checklist rápido

- [x] Override `dispatchKeyEvent` na Activity/Bridge para KEYCODE_DPAD_UP/DOWN/LEFT/RIGHT, ENTER, DPAD_CENTER.
- [x] Mapear KEYCODE_BACK (quando não há goBack) para evento “Escape”/“Back” no JS.
- [x] Injetar eventos no WebView via `evaluateJavascript` (disparar `KeyboardEvent` sintético ou função global).
- [x] Garantir WebView focusable e foco inicial na Activity (`onResume`: setFocusable(true), requestFocus()).
- [x] Adicionar `screenOrientation="landscape"` na Activity (para TV).
- [ ] Testar em TV Box ou emulador Android TV com controle remoto.
- [ ] (Opcional) Declarar `leanback required=true` e/ou criar plugin Capacitor para D-pad.

---

## 5. Referências

- [Handle arrow keys from D-pad on WebView (Stack Overflow)](https://stackoverflow.com/questions/19716840/handle-arrow-keys-from-d-pad-on-webview-google-tv-app)
- [Android TV – Manage TV controllers](https://developer.android.com/training/tv/get-started/controllers)
- [android/tv-samples – Leanback](https://github.com/android/tv-samples/tree/main/Leanback)
- [android/tv-samples – ReferenceAppKotlin](https://github.com/android/tv-samples/tree/main/ReferenceAppKotlin)
- Capacitor: [Android plugins](https://capacitorjs.com/docs/plugins/android) (para eventual plugin de D-pad)

Com a **Fase 1** implementada, o app deve passar a responder ao controle remoto na TV Box usando a mesma lógica de navegação espacial que já existe em JavaScript.
