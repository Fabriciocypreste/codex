# Análise: Controle Remoto não funciona na TV Box

## Fluxo atual

```
Controle Remoto (D-pad) 
    → Android System 
    → Activity.dispatchKeyEvent() [MainActivity]
    → injectKeyEvent() 
    → WebView.evaluateJavascript("window.__dispatchTVKey__('ArrowUp')")
    → index.html: __dispatchTVKey__()
    → new KeyboardEvent('keydown', {key: 'ArrowUp'})
    → document.dispatchEvent(ev) / window.dispatchEvent(ev)
    → useSpatialNavigation (window.addEventListener('keydown'))
    → Navegação
```

## Possíveis causas

### 1. **Activity não recebe eventos**
- O foco pode estar em outro view (launcher, overlay)
- A janela pode não estar recebendo eventos de teclado
- **Solução**: `getWindow().getDecorView().setFocusable(true)` e `requestFocus()` no onCreate

### 2. **Bridge/WebView não disponível**
- `getBridge()` ou `getWebView()` retorna null no momento da injeção
- **Solução**: Verificar se Bridge está pronto; Capacitor pode criar o WebView tarde

### 3. **__dispatchTVKey__ não definido**
- O script em index.html pode estar depois do app carregar
- O dist/index.html pode estar desatualizado (sem window.dispatchEvent)
- **Solução**: Colocar __dispatchTVKey__ no **início do head** (antes de qualquer outro script)

### 4. **Evento não chega aos listeners**
- O KeyboardEvent sintético pode não disparar listeners em alguns WebViews
- `isTrusted: false` em eventos sintéticos pode ser bloqueado
- **Solução**: `document.dispatchEvent` + `window.dispatchEvent`; usar capture phase

### 5. **Key codes diferentes**
- Alguns controles remotos usam códigos não padrão
- **Solução**: Mapear mais key codes (82=MENU, 3=HOME, etc.)

### 6. **Capacitor consome eventos**
- BridgeActivity pode ter lógica que intercepta antes do nosso código
- **Solução**: Garantir que nosso dispatchKeyEvent é chamado; verificar ordem de override

### 7. **SpatialNav desabilitado**
- Player, LiveTV, Settings chamam `setEnabled(false)`
- Na Login, Home, etc. deve estar habilitado
- **Verificar**: enabledRef.current no handler

### 8. **dist/index.html desatualizado**
- O build pode não ter copiado o index.html atualizado
- O __dispatchTVKey__ no dist pode ser versão antiga
- **Solução**: npm run build + npx cap sync

## Correções implementadas

1. **MainActivity.java**
   - `getWindow().getDecorView().setFocusableInTouchMode(true)` e `requestFocus()` no `onCreate` para garantir que a Activity receba eventos de teclado
   - Mapeamento de mais key codes: `KEYCODE_NUMPAD_ENTER` (160), `KEYCODE_ESCAPE` (111), `KEYCODE_MEDIA_PLAY` (126), `KEYCODE_MEDIA_PAUSE` (127)
   - `setOnKeyListener` no WebView em `onResume` como fallback (caso `dispatchKeyEvent` não receba)

2. **index.html**
   - `__dispatchTVKey__` movido para o **início do `<head>`** (primeiro script) para existir antes de qualquer outro script
   - Script removido do `<body>` (evitar duplicação)
   - `document.dispatchEvent(ev)` — o evento propaga até `window`, onde `useSpatialNavigation` escuta

3. **Build**
   - `npm run build` e `npx cap sync android` executados — `dist/index.html` e assets Android atualizados

## Como testar

1. Gerar APK: `cd android && ./gradlew assembleRelease` (ou `gradlew.bat` no Windows)
2. Instalar na TV Box e testar D-pad, Enter, Back, Play/Pause
3. Se ainda não funcionar: verificar se o controle envia key codes diferentes (adicionar `Log.d` no `dispatchKeyEvent` para debug)
