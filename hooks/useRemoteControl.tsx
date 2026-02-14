import { useEffect, useRef, useCallback } from 'react';
import { playNavigateSound, playSelectSound, playBackSound, playErrorSound, initAudio } from '../utils/soundEffects';

/* ============================================================
   useRemoteControl — Controle remoto unificado para TV Box
   
   Captura e unifica inputs de:
   • Teclado (Arrow Keys, Enter, Escape, media keys)
   • Controle remoto IR (mapeado como teclado pelo Android)
   • Gamepad API (controles Bluetooth/USB)
   
   Funcionalidades:
   • Navegação direcional com debounce adaptativo
   • Navegação circular (wrap-around) opcional
   • Controles de mídia (Play/Pause, Seek, Volume)
   • Context menu (long-press / botão dedicado)
   • Atalhos customizáveis
   • Haptic feedback via Web Audio API
   ============================================================ */

// ── Tipos ──

export interface RemoteControlConfig {
  /** Callback ao pressionar Cima */
  onUp?: () => void;
  /** Callback ao pressionar Baixo */
  onDown?: () => void;
  /** Callback ao pressionar Esquerda */
  onLeft?: () => void;
  /** Callback ao pressionar Direita */
  onRight?: () => void;
  /** Callback ao pressionar Enter / OK */
  onEnter?: () => void;
  /** Callback ao pressionar Voltar / Escape */
  onBack?: () => void;
  /** Callback ao pressionar Play/Pause ou barra de espaço */
  onPlayPause?: () => void;
  /** Callback ao pressionar Stop */
  onStop?: () => void;
  /** Callback ao avançar (Fast Forward) */
  onFastForward?: () => void;
  /** Callback ao retroceder (Rewind) */
  onRewind?: () => void;
  /** Callback ao aumentar volume */
  onVolumeUp?: () => void;
  /** Callback ao diminuir volume */
  onVolumeDown?: () => void;
  /** Callback ao silenciar/dessilenciar */
  onMute?: () => void;
  /** Callback para menu de contexto (long-press ou tecla dedicada) */
  onContextMenu?: () => void;
  /** Callback para tecla Home */
  onHome?: () => void;
  /** Callback para tecla Info / Guide */
  onInfo?: () => void;
  /** Atalhos customizados: mapa de tecla → callback */
  customShortcuts?: Record<string, () => void>;
  /** Habilitar navegação circular (volta ao início/fim) */
  enableCircular?: boolean;
  /** Habilitar feedback sonoro (default: true) */
  enableSound?: boolean;
  /** Intervalo de debounce em ms (default: 120ms) */
  debounceMs?: number;
  /** Habilitar suporte a Gamepad (default: true) */
  enableGamepad?: boolean;
  /** Habilitar long-press detection (default: true) */
  enableLongPress?: boolean;
  /** Tempo para detectar long-press em ms (default: 600ms) */
  longPressMs?: number;
  /** Intervalo de repeat para key held em ms (default: 200ms) */
  repeatIntervalMs?: number;
  /** Desabilitar o hook completamente */
  disabled?: boolean;
  /** Ignorar eventos quando foco está em inputs */
  ignoreInputFocus?: boolean;
}

export interface RemoteControlState {
  /** Última tecla pressionada */
  lastKey: string | null;
  /** Gamepad conectado */
  gamepadConnected: boolean;
  /** Long-press ativo */
  isLongPress: boolean;
  /** Timestamp da última ação */
  lastActionTime: number;
}

// ── Mapeamento de teclas Android TV / controles remotos IR ──

/** Códigos de tecla usados por controles remotos Android TV */
const REMOTE_KEY_MAP: Record<string, string> = {
  // Navegação
  'ArrowUp': 'up',
  'ArrowDown': 'down',
  'ArrowLeft': 'left',
  'ArrowRight': 'right',
  'Enter': 'enter',
  'Escape': 'back',
  'Backspace': 'back',
  'GoBack': 'back',

  // Media controls — W3C MediaSession API keys
  'MediaPlayPause': 'playPause',
  'MediaPlay': 'playPause',
  'MediaPause': 'playPause',
  'MediaStop': 'stop',
  'MediaTrackNext': 'fastForward',
  'MediaTrackPrevious': 'rewind',
  'MediaFastForward': 'fastForward',
  'MediaRewind': 'rewind',
  ' ': 'playPause', // Barra de espaço

  // Volume
  'AudioVolumeUp': 'volumeUp',
  'AudioVolumeDown': 'volumeDown',
  'AudioVolumeMute': 'mute',

  // Extras
  'ContextMenu': 'contextMenu',
  'F1': 'info',
  'Home': 'home',
  'Info': 'info',
  'Guide': 'info',

  // Teclado numérico para seek rápido (0-9)
  // (mapeados em customShortcuts se necessário)
};

// Mapeamento de Gamepad buttons (padrão Standard Gamepad)
const GAMEPAD_BUTTON_MAP: Record<number, string> = {
  0: 'enter',      // A / Cross
  1: 'back',       // B / Circle
  2: 'contextMenu', // X / Square
  3: 'info',       // Y / Triangle
  4: 'rewind',     // L1
  5: 'fastForward', // R1
  8: 'back',       // Select / Back
  9: 'playPause',  // Start / Options
  12: 'up',        // D-Pad Up
  13: 'down',      // D-Pad Down
  14: 'left',      // D-Pad Left
  15: 'right',     // D-Pad Right
};

// Threshold do analog stick para detectar direção
const AXIS_THRESHOLD = 0.5;

// ── Hook principal ──

export function useRemoteControl(config: RemoteControlConfig = {}): RemoteControlState {
  const {
    onUp,
    onDown,
    onLeft,
    onRight,
    onEnter,
    onBack,
    onPlayPause,
    onStop,
    onFastForward,
    onRewind,
    onVolumeUp,
    onVolumeDown,
    onMute,
    onContextMenu,
    onHome,
    onInfo,
    customShortcuts,
    enableCircular = false,
    enableSound = true,
    debounceMs = 120,
    enableGamepad = true,
    enableLongPress = true,
    longPressMs = 600,
    repeatIntervalMs = 200,
    disabled = false,
    ignoreInputFocus = true,
  } = config;

  // Refs para callbacks atuais (evita re-subscribe no listener)
  const callbacksRef = useRef(config);
  callbacksRef.current = config;

  // Estado do controle
  const stateRef = useRef<RemoteControlState>({
    lastKey: null,
    gamepadConnected: false,
    isLongPress: false,
    lastActionTime: 0,
  });

  // Refs de controle interno
  const lastNavTimeRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heldKeyRef = useRef<string | null>(null);
  const gamepadRafRef = useRef<number | null>(null);
  const prevGamepadButtonsRef = useRef<boolean[]>([]);
  const prevGamepadAxesRef = useRef<string | null>(null);
  const audioInitRef = useRef(false);

  // ── Debounce adaptativo ──
  const shouldProcess = useCallback((): boolean => {
    const now = Date.now();
    if (now - lastNavTimeRef.current < debounceMs) return false;
    lastNavTimeRef.current = now;
    return true;
  }, [debounceMs]);

  // ── Inicializar áudio na primeira interação ──
  const ensureAudio = useCallback(() => {
    if (!audioInitRef.current) {
      initAudio();
      audioInitRef.current = true;
    }
  }, []);

  // ── Despachar ação baseada no nome mapeado ──
  const dispatchAction = useCallback((action: string, isRepeat = false) => {
    const cfg = callbacksRef.current;
    const sound = cfg.enableSound !== false;

    // Atualizar estado
    stateRef.current.lastKey = action;
    stateRef.current.lastActionTime = Date.now();

    switch (action) {
      case 'up':
        cfg.onUp?.();
        if (sound && !isRepeat) playNavigateSound();
        break;
      case 'down':
        cfg.onDown?.();
        if (sound && !isRepeat) playNavigateSound();
        break;
      case 'left':
        cfg.onLeft?.();
        if (sound && !isRepeat) playNavigateSound();
        break;
      case 'right':
        cfg.onRight?.();
        if (sound && !isRepeat) playNavigateSound();
        break;
      case 'enter':
        cfg.onEnter?.();
        if (sound) playSelectSound();
        break;
      case 'back':
        cfg.onBack?.();
        if (sound) playBackSound();
        break;
      case 'playPause':
        cfg.onPlayPause?.();
        break;
      case 'stop':
        cfg.onStop?.();
        break;
      case 'fastForward':
        cfg.onFastForward?.();
        break;
      case 'rewind':
        cfg.onRewind?.();
        break;
      case 'volumeUp':
        cfg.onVolumeUp?.();
        break;
      case 'volumeDown':
        cfg.onVolumeDown?.();
        break;
      case 'mute':
        cfg.onMute?.();
        break;
      case 'contextMenu':
        cfg.onContextMenu?.();
        break;
      case 'home':
        cfg.onHome?.();
        break;
      case 'info':
        cfg.onInfo?.();
        break;
      default:
        // Verificar atalhos customizados
        cfg.customShortcuts?.[action]?.();
        break;
    }
  }, []);

  // ── Limpar timers de long-press/repeat ──
  const clearTimers = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    heldKeyRef.current = null;
    stateRef.current.isLongPress = false;
  }, []);

  // ── Keyboard handler ──
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      ensureAudio();

      // Ignorar se foco está em campo de input
      if (ignoreInputFocus) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }

      // Verificar atalhos customizados primeiro
      const cfg = callbacksRef.current;
      if (cfg.customShortcuts?.[e.key]) {
        e.preventDefault();
        if (shouldProcess()) {
          cfg.customShortcuts[e.key]();
        }
        return;
      }

      // Mapear tecla para ação
      const action = REMOTE_KEY_MAP[e.key];
      if (!action) return;

      // Prevenir comportamento padrão para teclas mapeadas
      e.preventDefault();

      // Se é o mesmo key sendo segurado (repeat), tratar como long-press
      if (e.repeat) {
        if (heldKeyRef.current === e.key) return; // Já processando repeat
        return;
      }

      // Debounce
      if (!shouldProcess()) return;

      // Despachar ação imediata
      dispatchAction(action);

      // Iniciar detecção de long-press para teclas de navegação
      if (enableLongPress && ['up', 'down', 'left', 'right'].includes(action)) {
        heldKeyRef.current = e.key;

        longPressTimerRef.current = setTimeout(() => {
          stateRef.current.isLongPress = true;

          // Iniciar repeat automático enquanto tecla está pressionada
          repeatTimerRef.current = setInterval(() => {
            if (heldKeyRef.current === e.key) {
              dispatchAction(action, true);
            } else {
              clearTimers();
            }
          }, repeatIntervalMs);
        }, longPressMs);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Limpar long-press quando tecla é solta
      if (heldKeyRef.current === e.key) {
        clearTimers();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      clearTimers();
    };
  }, [disabled, ignoreInputFocus, enableLongPress, longPressMs, repeatIntervalMs, shouldProcess, dispatchAction, clearTimers, ensureAudio]);

  // ── Gamepad polling ──
  useEffect(() => {
    if (disabled || !enableGamepad) return;

    // Detectar conexão/desconexão de gamepads
    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log(`[RemoteControl] Gamepad conectado: ${e.gamepad.id}`);
      stateRef.current.gamepadConnected = true;
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log(`[RemoteControl] Gamepad desconectado: ${e.gamepad.id}`);
      stateRef.current.gamepadConnected = false;
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    // Polling loop para ler estado do gamepad
    let isActive = true;

    const pollGamepad = () => {
      if (!isActive) return;

      const gamepads = navigator.getGamepads?.() ?? [];
      const gp = gamepads[0]; // Usar primeiro gamepad encontrado

      if (gp) {
        stateRef.current.gamepadConnected = true;

        // ── Processar botões ──
        const currentButtons = gp.buttons.map(b => b.pressed);
        const prevButtons = prevGamepadButtonsRef.current;

        for (let i = 0; i < currentButtons.length; i++) {
          // Detectar botão recém-pressionado (borda de subida)
          if (currentButtons[i] && !prevButtons[i]) {
            const action = GAMEPAD_BUTTON_MAP[i];
            if (action) {
              ensureAudio();
              dispatchAction(action);
            }
          }
        }
        prevGamepadButtonsRef.current = currentButtons;

        // ── Processar analog sticks (L-Stick = navegação) ──
        const lx = gp.axes[0] ?? 0; // Horizontal
        const ly = gp.axes[1] ?? 0; // Vertical
        let axisAction: string | null = null;

        if (ly < -AXIS_THRESHOLD) axisAction = 'up';
        else if (ly > AXIS_THRESHOLD) axisAction = 'down';
        else if (lx < -AXIS_THRESHOLD) axisAction = 'left';
        else if (lx > AXIS_THRESHOLD) axisAction = 'right';

        const axisKey = axisAction ?? 'neutral';
        if (axisKey !== prevGamepadAxesRef.current) {
          prevGamepadAxesRef.current = axisKey;
          if (axisAction && shouldProcess()) {
            ensureAudio();
            dispatchAction(axisAction);
          }
        }

        // ── Processar triggers (R2 = Fast Forward, L2 = Rewind) ──
        const l2 = gp.buttons[6]?.value ?? 0;
        const r2 = gp.buttons[7]?.value ?? 0;
        if (r2 > 0.5 && shouldProcess()) {
          dispatchAction('fastForward');
        } else if (l2 > 0.5 && shouldProcess()) {
          dispatchAction('rewind');
        }
      }

      gamepadRafRef.current = requestAnimationFrame(pollGamepad);
    };

    // Iniciar polling apenas se há gamepad conectado ou se queremos detectar
    gamepadRafRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      isActive = false;
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      if (gamepadRafRef.current) {
        cancelAnimationFrame(gamepadRafRef.current);
        gamepadRafRef.current = null;
      }
    };
  }, [disabled, enableGamepad, shouldProcess, dispatchAction, ensureAudio]);

  // Retorna estado de leitura
  return stateRef.current;
}

// ── Utilitários para componentes que usam o hook ──

/**
 * Helper para criar handler de keyDown compatível com o sistema de navegação.
 * Previne propagação quando a ação é tratada localmente.
 */
export function createKeyHandler(handlers: Partial<Record<string, () => void>>) {
  return (e: React.KeyboardEvent) => {
    const action = REMOTE_KEY_MAP[e.key];
    if (action && handlers[action]) {
      e.preventDefault();
      e.stopPropagation();
      handlers[action]!();
    }
  };
}

/**
 * Mapa de teclas numéricas para seek direto na timeline.
 * 0 = 0%, 1 = 10%, 2 = 20%, ..., 9 = 90%
 */
export function getSeekPercentFromKey(key: string): number | null {
  const num = parseInt(key);
  if (isNaN(num) || num < 0 || num > 9) return null;
  return num * 10;
}

/**
 * Verifica se o dispositivo parece ser um TV Box
 * (user agent android + TV ou dispositivo sem touch)
 */
export function isTVBoxDevice(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  const isAndroidTV = ua.includes('android') && (ua.includes('tv') || ua.includes('aftm') || ua.includes('aft'));
  const hasNoTouch = !('ontouchstart' in window) || navigator.maxTouchPoints === 0;
  const isLargeScreen = window.innerWidth >= 1280;
  return isAndroidTV || (hasNoTouch && isLargeScreen);
}

export default useRemoteControl;
