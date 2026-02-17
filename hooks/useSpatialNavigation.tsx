import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { playNavigateSound, playSelectSound, playBackSound, playErrorSound, initAudio } from '../utils/soundEffects';
import { shouldProcessNavEvent, shouldProcessVerticalNavEvent, resetNavDebounce } from '../utils/dpadDebounce';
import { scrollToFocusedElement, scrollRowToElement } from '../utils/tvScroll';

/* ============================================================
   SPATIAL NAVIGATION SYSTEM v2 — TV Box / Android TV / visionOS
   
   Algoritmo de navegação espacial por proximidade geométrica.
   Encontra o elemento mais próximo na direção do D-Pad usando
   projeção vetorial + distância ponderada.
   
   Features:
   • Navegação espacial por proximidade (nearest-neighbor)
   • Focus trap para modais (mantém foco dentro do container)
   • Focus stack (histórico de foco para restaurar ao fechar)
   • Focus groups (Tab entre seções, arrows dentro)
   • Skip links (pular para seções principais)
   • Auto-scroll quando foco sai da viewport
   • Ripple effect visual ao navegar
   • Indicador de foco com glow animado
   • Navegação circular opcional (wrap-around)
   • Memória de coluna por row
   • Sound effects integrados
   ============================================================ */

// ── Tipos ──

interface FocusableElement {
  el: HTMLElement;
  rect: DOMRect;
  row: number;
  col: number;
  group?: string;
}

interface FocusHistoryEntry {
  element: HTMLElement;
  row: number;
  col: number;
  scrollTop: number;
}

interface SpatialNavContextType {
  focusedRow: number;
  focusedCol: number;
  setPosition: (row: number, col: number) => void;
  savePosition: (key: string) => void;
  restorePosition: (key: string) => void;
  setEnabled: (enabled: boolean) => void;
  /** Inicia um focus trap (modal). Foco fica preso dentro do container */
  pushFocusTrap: (containerId: string) => void;
  /** Remove o focus trap ativo e restaura foco anterior */
  popFocusTrap: () => void;
  /** Navega para o próximo focus group */
  nextFocusGroup: () => void;
  /** Navega para o focus group anterior */
  prevFocusGroup: () => void;
  /** Pula para uma seção específica (skip link) */
  skipToSection: (sectionId: string) => void;
  /** Cria ripple effect visual no elemento */
  triggerRipple: (element: HTMLElement) => void;
  /** Habilitar/desabilitar navegação circular (ambos os eixos) */
  setCircularNav: (enabled: boolean) => void;
  /** Habilitar/desabilitar wrap horizontal (ArrowLeft↔ArrowRight) */
  setCircularH: (enabled: boolean) => void;
  /** Habilitar/desabilitar wrap vertical (ArrowUp↔ArrowDown) */
  setCircularV: (enabled: boolean) => void;
  /** Se a navegação circular horizontal está ativa globalmente */
  circularH: boolean;
  /** Se a navegação circular vertical está ativa globalmente */
  circularV: boolean;
  /** Se qualquer navegação circular está ativa (compat) */
  circularEnabled: boolean;
  /** Profundidade atual do focus trap stack */
  focusTrapDepth: number;
  /** TV Box: foca o primeiro item da primeira row (chamar ao trocar de página) */
  focusToFirstRow: () => void;
}

const SpatialNavContext = createContext<SpatialNavContextType>({
  focusedRow: 0,
  focusedCol: 0,
  setPosition: () => {},
  savePosition: () => {},
  restorePosition: () => {},
  setEnabled: () => {},
  pushFocusTrap: () => {},
  popFocusTrap: () => {},
  nextFocusGroup: () => {},
  prevFocusGroup: () => {},
  skipToSection: () => {},
  triggerRipple: () => {},
  setCircularNav: () => {},
  setCircularH: () => {},
  setCircularV: () => {},
  circularH: false,
  circularV: false,
  circularEnabled: false,
  focusTrapDepth: 0,
  focusToFirstRow: () => {},
});

export const useSpatialNav = () => useContext(SpatialNavContext);

// ═══════════════════════════════════════════════════════════
// ALGORITMO DE NAVEGAÇÃO ESPACIAL
// ═══════════════════════════════════════════════════════════

/** Encontra todas as rows (data-nav-row) no DOM, ordenadas */
function getAllRows(container?: HTMLElement | null): number[] {
  const root = container || document;
  const rows = new Set<number>();
  root.querySelectorAll('[data-nav-row]').forEach(el => {
    const r = parseInt(el.getAttribute('data-nav-row') || '-1');
    if (r >= 0) rows.add(r);
  });
  return Array.from(rows).sort((a, b) => a - b);
}

/**
 * Lê configuração de wrap circular de uma row via data attributes.
 * Atributos por componente:
 *   data-nav-wrap-h="true"  → wrap horizontal nesta row
 *   data-nav-wrap-v="true"  → wrap vertical nesta row
 *   data-nav-wrap="true"    → wrap em ambos os eixos nesta row
 * Retorna { h, v } onde cada um pode ser true/false/undefined.
 * undefined = usar configuração global.
 */
function getRowWrapConfig(row: number, container?: HTMLElement | null): { h?: boolean; v?: boolean } {
  const root = container || document;
  const rowEl = root.querySelector(`[data-nav-row="${row}"]`);
  if (!rowEl) return {};

  // Atributo "data-nav-wrap" ativa ambos os eixos
  const wrapAll = rowEl.getAttribute('data-nav-wrap');
  if (wrapAll === 'true' || wrapAll === '') {
    return { h: true, v: true };
  }
  if (wrapAll === 'false') {
    return { h: false, v: false };
  }

  // Atributos independentes por eixo
  const wrapH = rowEl.getAttribute('data-nav-wrap-h');
  const wrapV = rowEl.getAttribute('data-nav-wrap-v');

  return {
    h: wrapH === 'true' || wrapH === '' ? true : wrapH === 'false' ? false : undefined,
    v: wrapV === 'true' || wrapV === '' ? true : wrapV === 'false' ? false : undefined,
  };
}

/** Retorna todos os itens navegáveis de uma row */
function getItemsInRow(row: number, container?: HTMLElement | null): HTMLElement[] {
  const root = container || document;
  const rowEl = root.querySelector(`[data-nav-row="${row}"]`);
  if (!rowEl) return [];
  const items = Array.from(rowEl.querySelectorAll('[data-nav-item]')) as HTMLElement[];
  return items.sort((a, b) => {
    const ca = parseInt(a.getAttribute('data-nav-col') || '0');
    const cb = parseInt(b.getAttribute('data-nav-col') || '0');
    return ca - cb;
  });
}

/** Retorna todos os elementos focáveis na página/container */
function getAllFocusables(container?: HTMLElement | null): FocusableElement[] {
  const root = container || document;
  const elements: FocusableElement[] = [];
  root.querySelectorAll('[data-nav-item]').forEach(el => {
    const htmlEl = el as HTMLElement;
    const rowEl = htmlEl.closest('[data-nav-row]');
    if (!rowEl) return;
    const row = parseInt(rowEl.getAttribute('data-nav-row') || '-1');
    if (row < 0) return;
    const col = parseInt(htmlEl.getAttribute('data-nav-col') || '0');
    const group = htmlEl.closest('[data-nav-group]')?.getAttribute('data-nav-group') || undefined;
    elements.push({
      el: htmlEl,
      rect: htmlEl.getBoundingClientRect(),
      row,
      col,
      group,
    });
  });
  return elements;
}

function getFocusablesNearRow(currentRow: number, rows: number[], container?: HTMLElement | null): FocusableElement[] {
  const root = container || document;
  const ridx = rows.indexOf(currentRow);
  const nearbyRows = new Set<number>();
  for (let i = Math.max(0, ridx - 2); i <= Math.min(rows.length - 1, ridx + 2); i++) {
    nearbyRows.add(rows[i]);
  }
  const elements: FocusableElement[] = [];
  nearbyRows.forEach(r => {
    const rowEl = root.querySelector(`[data-nav-row="${r}"]`);
    if (!rowEl) return;
    rowEl.querySelectorAll('[data-nav-item]').forEach(el => {
      const htmlEl = el as HTMLElement;
      const col = parseInt(htmlEl.getAttribute('data-nav-col') || '0');
      const group = htmlEl.closest('[data-nav-group]')?.getAttribute('data-nav-group') || undefined;
      elements.push({ el: htmlEl, rect: htmlEl.getBoundingClientRect(), row: r, col, group });
    });
  });
  return elements;
}

/** Centro geométrico de um DOMRect */
function rectCenter(r: DOMRect): { x: number; y: number } {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Algoritmo de navegação espacial por proximidade.
 * Encontra o elemento mais próximo na direção especificada usando:
 * 1. Filtro por direção (elimina candidatos atrás)
 * 2. Projeção no eixo principal da direção
 * 3. Score ponderado: distância no eixo principal + penalidade lateral
 */
function findNearestInDirection(
  current: DOMRect,
  direction: 'up' | 'down' | 'left' | 'right',
  candidates: FocusableElement[]
): FocusableElement | null {
  const origin = rectCenter(current);
  let bestCandidate: FocusableElement | null = null;
  let bestScore = Infinity;

  const PRIMARY_WEIGHT = 1.0;
  const LATERAL_WEIGHT = 2.5;
  const OVERLAP_BONUS = -50;

  for (const candidate of candidates) {
    const target = rectCenter(candidate.rect);
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;

    let primaryDist: number;
    let lateralDist: number;
    let isInDirection: boolean;

    switch (direction) {
      case 'up':
        isInDirection = dy < -5;
        primaryDist = Math.abs(dy);
        lateralDist = Math.abs(dx);
        break;
      case 'down':
        isInDirection = dy > 5;
        primaryDist = Math.abs(dy);
        lateralDist = Math.abs(dx);
        break;
      case 'left':
        isInDirection = dx < -5;
        primaryDist = Math.abs(dx);
        lateralDist = Math.abs(dy);
        break;
      case 'right':
        isInDirection = dx > 5;
        primaryDist = Math.abs(dx);
        lateralDist = Math.abs(dy);
        break;
    }

    if (!isInDirection) continue;

    let overlapBonus = 0;
    if (direction === 'up' || direction === 'down') {
      const oL = Math.max(current.left, candidate.rect.left);
      const oR = Math.min(current.right, candidate.rect.right);
      if (oL < oR) overlapBonus = OVERLAP_BONUS;
    } else {
      const oT = Math.max(current.top, candidate.rect.top);
      const oB = Math.min(current.bottom, candidate.rect.bottom);
      if (oT < oB) overlapBonus = OVERLAP_BONUS;
    }

    const score = (primaryDist * PRIMARY_WEIGHT) + (lateralDist * LATERAL_WEIGHT) + overlapBonus;
    if (score < bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

// ═══════════════════════════════════════════════════════════
// RIPPLE EFFECT
// ═══════════════════════════════════════════════════════════

function createRipple(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const ripple = document.createElement('div');
  ripple.className = 'spatial-nav-ripple';

  const size = Math.max(rect.width, rect.height) * 1.4;
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${rect.width / 2 - size / 2}px`;
  ripple.style.top = `${rect.height / 2 - size / 2}px`;

  const computedPos = getComputedStyle(element).position;
  if (computedPos === 'static') {
    element.style.position = 'relative';
  }
  element.style.overflow = 'hidden';

  element.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ═══════════════════════════════════════════════════════════
// FOCUS INDICATOR — DESABILITADO (causava retângulo vermelho visível)
// Os estilos :focus-visible no CSS já cuidam da indicação de foco.
// ═══════════════════════════════════════════════════════════

let focusIndicator: HTMLDivElement | null = null;

function updateFocusIndicator(_element: HTMLElement): void {
  // Desabilitado — o indicador flutuante era redundante e causava artefato visual
}

function hideFocusIndicator(): void {
  // Desabilitado
}

// ═══════════════════════════════════════════════════════════
// FOCUS DOM ELEMENT
// ═══════════════════════════════════════════════════════════

function focusDomElement(row: number, col: number, container?: HTMLElement | null): number {
  const items = getItemsInRow(row, container);
  if (items.length === 0) {
    // TV Box: row existe mas itens não renderizados (lazy rendering)
    // Tenta forçar scroll até o row element para triggerar IntersectionObserver
    const root = container || document;
    const rowEl = root.querySelector(`[data-nav-row="${row}"]`) as HTMLElement;
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Retry focus após 150ms (tempo para lazy rendering ativar)
      setTimeout(() => {
        const retryItems = getItemsInRow(row, container);
        if (retryItems.length > 0) {
          const safeCol = Math.max(0, Math.min(col, retryItems.length - 1));
          const el = retryItems[safeCol];
          if (el) {
            el.focus({ preventScroll: true });
            const scrollContainer = el.closest('[data-nav-scroll]') as HTMLElement;
            if (scrollContainer) scrollRowToElement(scrollContainer, el);
            scrollToFocusedElement(el);
            createRipple(el);
          }
        }
      }, 150);
    }
    return col;
  }
  const safeCol = Math.max(0, Math.min(col, items.length - 1));
  const el = items[safeCol];
  if (el) {
    el.focus({ preventScroll: true });

    const scrollContainer = el.closest('[data-nav-scroll]') as HTMLElement;
    if (scrollContainer) scrollRowToElement(scrollContainer, el);
    scrollToFocusedElement(el);

    createRipple(el);
    updateFocusIndicator(el);
  }
  return safeCol;
}

// ═══════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════

interface SpatialNavProviderProps {
  children: React.ReactNode;
}

export const SpatialNavProvider: React.FC<SpatialNavProviderProps> = ({ children }) => {
  const rowRef = useRef(0);
  const colRef = useRef(0);
  const enabledRef = useRef(true);
  const memoryRef = useRef<Record<number, number>>({});
  const savedRef = useRef<Record<string, { row: number; col: number }>>({});

  // Focus trap stack
  const focusTrapStackRef = useRef<Array<{
    containerId: string;
    previousFocus: FocusHistoryEntry;
  }>>([]);

  // Focus group tracking
  const currentGroupRef = useRef<string | null>(null);

  // Wrap circular independente por eixo
  const circularHRef = useRef(false);
  const circularVRef = useRef(false);

  const [focusedRow, setFocusedRow] = useState(0);
  const [focusedCol, setFocusedCol] = useState(0);
  const [circularH, _setCircularH] = useState(false);
  const [circularV, _setCircularV] = useState(false);
  const [focusTrapDepth, setFocusTrapDepth] = useState(0);

  // Compat: circularEnabled = qualquer eixo ativo
  const circularEnabled = circularH || circularV;

  // ── Container ativo (trap ou document) ──
  const getActiveContainer = useCallback((): HTMLElement | null => {
    const stack = focusTrapStackRef.current;
    if (stack.length === 0) return null;
    return document.getElementById(stack[stack.length - 1].containerId) || null;
  }, []);

  // ── Set Position ──
  const setPosition = useCallback((row: number, col: number) => {
    rowRef.current = row;
    colRef.current = col;
    memoryRef.current[row] = col;
    setFocusedRow(row);
    setFocusedCol(col);
    const container = getActiveContainer();
    const actualCol = focusDomElement(row, col, container);
    if (actualCol !== col) {
      colRef.current = actualCol;
      setFocusedCol(actualCol);
    }
  }, [getActiveContainer]);

  const savePosition = useCallback((key: string) => {
    savedRef.current[key] = { row: rowRef.current, col: colRef.current };
  }, []);

  const restorePosition = useCallback((key: string) => {
    const s = savedRef.current[key];
    if (s) {
      setTimeout(() => setPosition(s.row, s.col), 200);
      delete savedRef.current[key];
    }
  }, [setPosition]);

  const setEnabled = useCallback((e: boolean) => {
    enabledRef.current = e;
    if (!e) hideFocusIndicator();
  }, []);

  // ── Focus Trap ──
  const pushFocusTrap = useCallback((containerId: string) => {
    const activeEl = document.activeElement as HTMLElement;
    focusTrapStackRef.current.push({
      containerId,
      previousFocus: {
        element: activeEl,
        row: rowRef.current,
        col: colRef.current,
        scrollTop: window.scrollY,
      },
    });
    setFocusTrapDepth(focusTrapStackRef.current.length);

    requestAnimationFrame(() => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const rows = getAllRows(container);
      if (rows.length > 0) {
        rowRef.current = rows[0];
        colRef.current = 0;
        setFocusedRow(rows[0]);
        setFocusedCol(0);
        focusDomElement(rows[0], 0, container);
      } else {
        const first = container.querySelector('[data-nav-item], button, a, [tabindex]') as HTMLElement;
        if (first) first.focus();
      }
    });
  }, []);

  const popFocusTrap = useCallback(() => {
    const stack = focusTrapStackRef.current;
    if (stack.length === 0) return;

    const popped = stack.pop()!;
    setFocusTrapDepth(stack.length);

    requestAnimationFrame(() => {
      const { element, row, col, scrollTop } = popped.previousFocus;
      rowRef.current = row;
      colRef.current = col;
      setFocusedRow(row);
      setFocusedCol(col);

      if (element && document.contains(element)) {
        element.focus({ preventScroll: true });
        updateFocusIndicator(element);
      }
      window.scrollTo({ top: scrollTop, behavior: 'smooth' });
    });
  }, []);

  // ── Focus Groups ──
  const getGroups = useCallback((): string[] => {
    const groups: string[] = [];
    document.querySelectorAll('[data-nav-group]').forEach(el => {
      const g = el.getAttribute('data-nav-group');
      if (g && !groups.includes(g)) groups.push(g);
    });
    return groups;
  }, []);

  const focusGroup = useCallback((groupName: string) => {
    currentGroupRef.current = groupName;
    const groupEl = document.querySelector(`[data-nav-group="${groupName}"]`);
    if (!groupEl) return;
    const firstItem = groupEl.querySelector('[data-nav-item]') as HTMLElement;
    if (!firstItem) return;
    const rowEl = firstItem.closest('[data-nav-row]');
    if (!rowEl) return;
    const row = parseInt(rowEl.getAttribute('data-nav-row') || '0');
    const col = parseInt(firstItem.getAttribute('data-nav-col') || '0');
    setPosition(row, col);
    playNavigateSound();
  }, [setPosition]);

  const nextFocusGroup = useCallback(() => {
    const groups = getGroups();
    if (groups.length === 0) return;
    const idx = currentGroupRef.current ? groups.indexOf(currentGroupRef.current) : -1;
    focusGroup(groups[(idx + 1) % groups.length]);
  }, [getGroups, focusGroup]);

  const prevFocusGroup = useCallback(() => {
    const groups = getGroups();
    if (groups.length === 0) return;
    const idx = currentGroupRef.current ? groups.indexOf(currentGroupRef.current) : 0;
    focusGroup(groups[(idx - 1 + groups.length) % groups.length]);
  }, [getGroups, focusGroup]);

  // ── Skip Links ──
  const skipToSection = useCallback((sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const items = section.querySelectorAll('[data-nav-item]');
    if (items.length > 0) {
      const first = items[0] as HTMLElement;
      const rowEl = first.closest('[data-nav-row]');
      if (rowEl) {
        const row = parseInt(rowEl.getAttribute('data-nav-row') || '0');
        setPosition(row, 0);
      }
    }
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    playNavigateSound();
  }, [setPosition]);

  const triggerRipple = useCallback((element: HTMLElement) => {
    createRipple(element);
  }, []);

  const setCircularH = useCallback((enabled: boolean) => {
    circularHRef.current = enabled;
    _setCircularH(enabled);
  }, []);

  const setCircularV = useCallback((enabled: boolean) => {
    circularVRef.current = enabled;
    _setCircularV(enabled);
  }, []);

  /** Ativa/desativa wrap em ambos os eixos de uma vez */
  const setCircularNav = useCallback((enabled: boolean) => {
    setCircularH(enabled);
    setCircularV(enabled);
  }, [setCircularH, setCircularV]);

  // ═══════════════════════════════════════════════════════
  // GLOBAL KEY HANDLER
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    let audioInitialized = false;

    const handler = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      const isVertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
      if (isVertical ? !shouldProcessVerticalNavEvent() : !shouldProcessNavEvent()) return;

      if (!audioInitialized) {
        initAudio();
        audioInitialized = true;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Tab/Shift+Tab para alternar entre focus groups
      if (e.key === 'Tab') {
        const groups = getGroups();
        if (groups.length > 1) {
          e.preventDefault();
          if (e.shiftKey) prevFocusGroup();
          else nextFocusGroup();
          return;
        }
      }

      const container = getActiveContainer();
      const rows = getAllRows(container);
      if (rows.length === 0) return;

      const r = rowRef.current;
      const c = colRef.current;
      const ridx = rows.indexOf(r);

      // Teclas numéricas 1–9: pular ao item 1–9 da row atual (TV Box / players IPTV)
      if (e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key, 10);
        const items = getItemsInRow(r, container);
        const idx = num - 1;
        if (idx >= 0 && items.length > idx) {
          e.preventDefault();
          setPosition(r, idx);
          playNavigateSound();
        }
        return;
      }

      // ── Resolver wrap config: atributo da row > global ──
      // data-nav-wrap-h / data-nav-wrap-v / data-nav-wrap no elemento da row
      // prevalecem sobre a config global (circularHRef / circularVRef)
      const rowWrap = getRowWrapConfig(r, container);
      const wrapH = rowWrap.h ?? circularHRef.current;
      const wrapV = rowWrap.v ?? circularVRef.current;

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          if (ridx > 0) {
            const newRow = rows[ridx - 1];
            setPosition(newRow, memoryRef.current[newRow] ?? c);
            playNavigateSound();
          } else if (wrapV && ridx === 0) {
            // Wrap vertical: primeiro → último
            const newRow = rows[rows.length - 1];
            setPosition(newRow, memoryRef.current[newRow] ?? c);
            playNavigateSound();
          } else if (ridx === -1 && rows.length > 0) {
            setPosition(rows[0], 0);
            playNavigateSound();
          } else {
            // Fallback: algoritmo espacial por proximidade
            const allItems = getFocusablesNearRow(r, rows, container);
            const currentItems = getItemsInRow(r, container);
            const currentEl = currentItems[Math.min(c, currentItems.length - 1)];
            if (currentEl) {
              const nearest = findNearestInDirection(
                currentEl.getBoundingClientRect(), 'up',
                allItems.filter(i => i.el !== currentEl)
              );
              if (nearest) { setPosition(nearest.row, nearest.col); playNavigateSound(); }
              else playErrorSound();
            }
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          if (ridx >= 0 && ridx < rows.length - 1) {
            const newRow = rows[ridx + 1];
            setPosition(newRow, memoryRef.current[newRow] ?? c);
            playNavigateSound();
          } else if (wrapV && ridx === rows.length - 1) {
            // Wrap vertical: último → primeiro
            const newRow = rows[0];
            setPosition(newRow, memoryRef.current[newRow] ?? c);
            playNavigateSound();
          } else if (ridx === -1 && rows.length > 0) {
            setPosition(rows[0], 0);
            playNavigateSound();
          } else {
            const allItems = getFocusablesNearRow(r, rows, container);
            const currentItems = getItemsInRow(r, container);
            const currentEl = currentItems[Math.min(c, currentItems.length - 1)];
            if (currentEl) {
              const nearest = findNearestInDirection(
                currentEl.getBoundingClientRect(), 'down',
                allItems.filter(i => i.el !== currentEl)
              );
              if (nearest) { setPosition(nearest.row, nearest.col); playNavigateSound(); }
              else playErrorSound();
            }
          }
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          const items = getItemsInRow(r, container);
          if (c > 0) {
            setPosition(r, c - 1);
            playNavigateSound();
          } else if (wrapH && items.length > 0) {
            // Wrap horizontal: primeiro → último
            setPosition(r, items.length - 1);
            playNavigateSound();
          } else {
            const allItems = getFocusablesNearRow(r, rows, container);
            const currentEl = items[0];
            if (currentEl) {
              const nearest = findNearestInDirection(
                currentEl.getBoundingClientRect(), 'left',
                allItems.filter(i => i.el !== currentEl)
              );
              if (nearest) { setPosition(nearest.row, nearest.col); playNavigateSound(); }
              else playErrorSound();
            }
          }
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          const items = getItemsInRow(r, container);
          if (c < items.length - 1) {
            setPosition(r, c + 1);
            playNavigateSound();
          } else if (wrapH && items.length > 0) {
            // Wrap horizontal: último → primeiro
            setPosition(r, 0);
            playNavigateSound();
          } else {
            const allItems = getFocusablesNearRow(r, rows, container);
            const currentEl = items[items.length - 1];
            if (currentEl) {
              const nearest = findNearestInDirection(
                currentEl.getBoundingClientRect(), 'right',
                allItems.filter(i => i.el !== currentEl)
              );
              if (nearest) { setPosition(nearest.row, nearest.col); playNavigateSound(); }
              else playErrorSound();
            }
          }
          break;
        }

        case 'Enter':
          playSelectSound();
          break;

        case 'Escape':
        case 'Backspace': {
          if (focusTrapStackRef.current.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            popFocusTrap();
            playBackSound();
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setPosition, getActiveContainer, getGroups, nextFocusGroup, prevFocusGroup, popFocusTrap]);

  // Foco inicial (TV Box: retry para quando a Home/Login ainda está renderizando)
  useEffect(() => {
    const tryFocus = () => {
      if (savedRef.current['__initial_done']) return;
      const rows = getAllRows();
      if (rows.length === 0) return;
      const active = document.activeElement as HTMLElement;
      if (active?.hasAttribute('data-nav-item')) return; // já tem foco em um item
      setPosition(rows[0], 0);
      savedRef.current['__initial_done'] = { row: -1, col: -1 };
    };
    const t1 = setTimeout(tryFocus, 200);
    const t2 = setTimeout(tryFocus, 600);
    const t3 = setTimeout(tryFocus, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [setPosition]);

  // Atualizar indicador no scroll/resize
  useEffect(() => {
    const update = () => {
      const focused = document.activeElement as HTMLElement;
      if (focused?.hasAttribute('data-nav-item')) updateFocusIndicator(focused);
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // TV Box: foca a primeira row (usar ao trocar de página)
  const focusToFirstRow = useCallback(() => {
    delete savedRef.current['__initial_done'];
    requestAnimationFrame(() => {
      const container = getActiveContainer();
      const rows = getAllRows(container);
      if (rows.length > 0) setPosition(rows[0], 0);
    });
  }, [getActiveContainer, setPosition]);

  // Cleanup indicador
  useEffect(() => {
    return () => {
      if (focusIndicator) { focusIndicator.remove(); focusIndicator = null; }
    };
  }, []);

  return (
    <SpatialNavContext.Provider value={{
      focusedRow, focusedCol, setPosition, savePosition, restorePosition, setEnabled,
      pushFocusTrap, popFocusTrap, nextFocusGroup, prevFocusGroup, skipToSection,
      triggerRipple, setCircularNav, setCircularH, setCircularV,
      circularH, circularV, circularEnabled, focusTrapDepth, focusToFirstRow,
    }}>
      {children}
    </SpatialNavContext.Provider>
  );
};
