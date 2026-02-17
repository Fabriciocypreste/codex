# Comparação: REDX vs repositórios Android TV / IPTV — plano consolidado

Análise dos repositórios solicitados e comparação com o projeto REDX, com o que já foi feito e o que ainda falta.

---

## 1. Repositórios analisados

| Repositório | Tipo | Código útil para REDX? |
|-------------|------|-------------------------|
| [android/tv-samples](https://github.com/android/tv-samples/tree/main) | Samples oficiais Android TV (Leanback, ReferenceAppKotlin, JetStreamCompose) | **Referência de manifesto e padrões**; UI é 100% nativa (não WebView). |
| [videolan/vlc-android](https://github.com/videolan/vlc-android) | Player de mídia (Media3, libVLC), Android + Android TV | **Nativo**; controle remoto via `dispatchKeyEvent`/views; **não usa WebView**. |
| [KristianBicba/AndroidTVMediaPlayer](https://github.com/KristianBicba/AndroidTVMediaPlayer) | App TV (reproduz mídia) + app phone (controle remoto) + lib de comunicação | **Referência de manifesto TV**; arquitetura app_tv + app_phone diferente da nossa (WebView único). |
| [iptv-org/iptv](https://github.com/iptv-org/iptv) | Listas M3U/M3U8 (canais), não é app | **Só listas**; útil para testes de fonte, não para código do app. |
| JuliaPashkovskaya/IPTV-Player, iptv-android/iptv | Apps IPTV (citados) | **Não encontrados** (404 ou nome diferente); alternativas: [GeetMark/IPTV-Player-S](https://github.com/GeetMark/IPTV-Player-S), [oxyroid/M3UAndroid](https://github.com/oxyroid/M3UAndroid). |

---

## 2. Como cada um trata Android TV

### 2.1 [android/tv-samples](https://github.com/android/tv-samples) (Leanback)

- **Manifest (Leanback sample):**
  - `android.software.leanback` **required=true**
  - `android.hardware.touchscreen` **required=false**
  - Activity TV: **só** `LEANBACK_LAUNCHER` (sem `LAUNCHER`), `screenOrientation="landscape"`, `android:banner` e `android:logo`
  - Activity **separada** para mobile: `MobileWelcomeActivity` com `LAUNCHER`
- **UI:** Leanback SDK (BrowseFragment, DetailsFragment, PlaybackActivity), RecyclerView, foco nativo (D-pad tratado pelo sistema e pelas views).
- **Conclusão:** Padrão “app só TV” ou “TV + mobile em módulos separados”. REDX é um único APK com WebView; o que importa é **manifesto** (leanback, touchscreen, banner) e garantir que o **input** chegue ao WebView (já resolvido com injeção).

### 2.2 [VLC for Android](https://github.com/videolan/vlc-android)

- **Stack:** Nativo (Kotlin/Java), módulos `application`, `medialibrary`, buildsystem; player com libVLC/Media3.
- **Controle remoto:** Tratado em código nativo (`KeyEvent`, `dispatchKeyEvent`, listeners em views). Não há WebView na UI principal.
- **Conclusão:** Nada para copiar diretamente (arquitetura diferente). Reforça que em app **nativo** o D-pad é tratado na Activity/views; no REDX a solução é **injetar** no WebView (já implementado).

### 2.3 [AndroidTVMediaPlayer](https://github.com/KristianBicba/AndroidTVMediaPlayer)

- **Estrutura:** `app_phone` (controle remoto), `app_tv` (reproduz mídia), `lib_communications`, `lib_vfs`.
- **Manifest do app_tv:**
  - `touchscreen` e `leanback` **required=false**
  - Mesma Activity (`PairingActivity`) com **LAUNCHER** e **LEANBACK_LAUNCHER**
  - `android:banner="@drawable/ic_launcher_tv"`
  - Serviços para rede e player (MainServerService, VideoPlayerLauncherService, KeepaliveService).
- **Conclusão:** Manifest parecido com o REDX (um APK, LAUNCHER + LEANBACK_LAUNCHER, banner). Não usam WebView; o que aproveitamos é o **padrão de manifesto** (já seguimos).

### 2.4 iptv-org/iptv e apps IPTV

- **iptv-org/iptv:** Apenas listas M3U (URLs de canais). Servem para **testar fontes** no seu backend ou no player; não trazem código de app.
- **Apps IPTV (IPTV-Player-S, M3UAndroid, etc.):** Em geral são nativos (Kotlin/Compose ou Flutter), com suporte a M3U/M3U8, EPG, controle remoto. Para REDX o ganho é **conceitual** (fluxo de listas, EPG, favoritos), não copiar código, já que REDX é React + Capacitor.

---

## 3. Comparação direta: REDX vs referências

| Aspecto | android/tv-samples (Leanback) | VLC-android | AndroidTVMediaPlayer | REDX (atual) |
|--------|--------------------------------|-------------|----------------------|--------------|
| **UI** | Nativa (Leanback) | Nativa | Nativa | **WebView (React)** |
| **D-pad** | Sistema + views | Activity/views | Activity/views | **Injetado no WebView** (MainActivity → `__dispatchTVKey__`) |
| **Back** | Nativo | Nativo | Nativo | **onBackPressed → Escape no JS** |
| **Manifest leanback** | required=true | N/A | required=false | required=false |
| **Manifest touchscreen** | required=false | N/A | required=false | required=false |
| **LEANBACK_LAUNCHER** | Sim (só TV) | N/A | Sim (com LAUNCHER) | Sim (com LAUNCHER) |
| **Banner** | Sim | N/A | Sim | Sim (@mipmap/ic_launcher) |
| **screenOrientation** | landscape (TV) | N/A | Não | landscape |
| **Foco WebView** | N/A | N/A | N/A | **onResume: setFocusable + requestFocus** |
| **Tecla Play/Pause** | N/A | Nativo | N/A | **KEYCODE_MEDIA_PLAY_PAUSE → Space** |

---

## 4. O que estava errado / o que faltava (resumo)

- **Causa raiz:** No Android TV, o WebView **não recebe** eventos de D-pad (KEYCODE_DPAD_* e Enter) por padrão; o sistema consome. Por isso a navegação espacial em JS não respondia ao controle.
- **Faltava:** Interceptar D-pad e Back na Activity, injetar no WebView (ArrowUp/Down/Left/Right, Enter, Escape, Space), WebView focusable + foco em `onResume`, e (opcional) orientação landscape e tecla Media Play/Pause.

---

## 5. Plano — status e próximos passos

### 5.1 Já implementado (concluído)

- [x] **MainActivity:** `dispatchKeyEvent` para KEYCODE_DPAD_UP/DOWN/LEFT/RIGHT, ENTER, DPAD_CENTER → injeção no WebView.
- [x] **MainActivity:** KEYCODE_MEDIA_PLAY_PAUSE → injeção de Space (play/pause no Player).
- [x] **MainActivity:** `onBackPressed` → quando não há `goBack()`, injetar Escape (handleTVBack no App).
- [x] **MainActivity:** `onResume` → WebView `setFocusable(true)`, `requestFocus()`.
- [x] **index.html:** `window.__dispatchTVKey__` para disparar `KeyboardEvent('keydown')` com a tecla correta.
- [x] **AndroidManifest:** `screenOrientation="landscape"` na MainActivity (opcional para phone; pode remover se fizer build só phone).
- [x] **useSpatialNavigation:** Foco inicial com retries (200/600/1200 ms); `focusToFirstRow()` ao trocar de página; scroll no foco (`scrollRowToElement`, `scrollToFocusedElement`).
- [x] **App.tsx:** Chamada a `focusToFirstRow()` quando `currentPage` muda para telas com rows.

### 5.2 Opcional (melhorias)

- [ ] **Leanback required=true:** Só se quiser que o app apareça **apenas** em dispositivos TV (um APK só TV).
- [x] **Banner dedicado para TV:** Criado `res/drawable/tv_banner.xml` (proporção 320x180, cor #E50914) e `android:banner="@drawable/tv_banner"` no manifest.
- [ ] **Long-press OK:** Se o dispositivo enviar long-press, mapear para menu/Configurações (ex.: abrir Settings).
- [x] **Teclas numéricas (1–9):** Implementado: MainActivity injeta "1".."9", useSpatialNavigation foca o item 1–9 da row atual (atalho tipo players IPTV).
- [ ] **Plugin Capacitor:** Extrair a lógica de D-pad para um plugin (manter MainActivity mais limpo).

### 5.3 Validação obrigatória

- [ ] **Testar em TV Box ou emulador Android TV** com controle remoto físico (setas, OK, Back, Play/Pause).
- [ ] Confirmar que Back volta corretamente (Details → Home, Player → Home, etc.) e que o primeiro item recebe foco ao abrir a Home.

---

## 6. Referências rápidas

- [android/tv-samples](https://github.com/android/tv-samples/tree/main) — Amostras oficiais (Leanback, ReferenceAppKotlin, Compose for TV).
- [Documentação Android TV — Controllers](https://developer.android.com/training/tv/get-started/controllers).
- [VLC-android](https://github.com/videolan/vlc-android) — Player nativo (referência de arquitetura, não WebView).
- [AndroidTVMediaPlayer](https://github.com/KristianBicba/AndroidTVMediaPlayer) — App TV + app controle remoto (manifest e estrutura).
- [iptv-org/iptv](https://github.com/iptv-org/iptv) — Listas M3U (fontes para testes).
- **ANALISE_TVBOX_E_PLANO.md** — Análise detalhada da causa raiz e do plano de implementação já executado.

Com o que está implementado, o REDX deve responder ao controle remoto na TV Box. O próximo passo crítico é **testar em dispositivo ou emulador Android TV** e ajustar apenas o que faltar (ex.: long-press, teclas numéricas, banner TV).
