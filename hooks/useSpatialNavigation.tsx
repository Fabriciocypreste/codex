import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { playNavigateSound, playSelectSound, playBackSound, initAudio } from '../utils/soundEffects';

/* ============================================================
   SPATIAL NAVIGATION SYSTEM FOR ANDROID TV / TV BOX
   - DOM-based row/col navigation via data attributes
   - Focus memory per row (restores col on return)
   - Save/restore position for page transitions
   - Sound effects on navigation and selection
   - Only active when data-nav-row elements exist
   ============================================================ */

interface SpatialNavContextType {
  focusedRow: number;
  focusedCol: number;
  setPosition: (row: number, col: number) => void;
  savePosition: (key: string) => void;
  restorePosition: (key: string) => void;
  setEnabled: (enabled: boolean) => void;
}

const SpatialNavContext = createContext<SpatialNavContextType>({
  focusedRow: 0,
  focusedCol: 0,
  setPosition: () => { },
  savePosition: () => { },
  restorePosition: () => { },
  setEnabled: () => { },
});

export const useSpatialNav = () => useContext(SpatialNavContext);

// ---- DOM Helpers ----

function getAllRows(): number[] {
  const rows = new Set<number>();
  document.querySelectorAll('[data-nav-row]').forEach(el => {
    const r = parseInt(el.getAttribute('data-nav-row') || '-1');
    if (r >= 0) rows.add(r);
  });
  return Array.from(rows).sort((a, b) => a - b);
}

function getItemsInRow(row: number): HTMLElement[] {
  const rowEl = document.querySelector(`[data-nav-row="${row}"]`);
  if (!rowEl) return [];
  const items = Array.from(rowEl.querySelectorAll('[data-nav-item]')) as HTMLElement[];
  return items.sort((a, b) => {
    const ca = parseInt(a.getAttribute('data-nav-col') || '0');
    const cb = parseInt(b.getAttribute('data-nav-col') || '0');
    return ca - cb;
  });
}

function focusDomElement(row: number, col: number): number {
  const items = getItemsInRow(row);
  if (items.length === 0) return col;
  const safeCol = Math.max(0, Math.min(col, items.length - 1));
  const el = items[safeCol];
  if (el) {
    el.focus({ preventScroll: true });
    // Horizontal auto-scroll within the row's scroll container
    const scrollContainer = el.closest('[data-nav-scroll]') as HTMLElement;
    if (scrollContainer) {
      const elRect = el.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const offset = el.offsetLeft - containerRect.width / 2 + elRect.width / 2;
      scrollContainer.scrollTo({ left: Math.max(0, offset), behavior: 'instant' });
    }
    // Vertical auto-scroll
    el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }
  return safeCol;
}

// ---- Provider ----

interface SpatialNavProviderProps {
  children: React.ReactNode;
}

export const SpatialNavProvider: React.FC<SpatialNavProviderProps> = ({ children }) => {
  const rowRef = useRef(0);
  const colRef = useRef(0);
  const enabledRef = useRef(true);
  const memoryRef = useRef<Record<number, number>>({});
  const savedRef = useRef<Record<string, { row: number; col: number }>>({});

  const [focusedRow, setFocusedRow] = useState(0);
  const [focusedCol, setFocusedCol] = useState(0);

  const setPosition = useCallback((row: number, col: number) => {
    rowRef.current = row;
    colRef.current = col;
    memoryRef.current[row] = col;
    setFocusedRow(row);
    setFocusedCol(col);
    const actualCol = focusDomElement(row, col);
    if (actualCol !== col) {
      colRef.current = actualCol;
      setFocusedCol(actualCol);
    }
  }, []);

  const savePosition = useCallback((key: string) => {
    savedRef.current[key] = { row: rowRef.current, col: colRef.current };
  }, []);

  const restorePosition = useCallback((key: string) => {
    const s = savedRef.current[key];
    if (s) {
      // Delay to allow DOM to render the target page
      setTimeout(() => setPosition(s.row, s.col), 200);
      delete savedRef.current[key];
    }
  }, [setPosition]);

  const setEnabled = useCallback((e: boolean) => {
    enabledRef.current = e;
  }, []);

  // ---- Global Key Handler ----
  useEffect(() => {
    // Init audio on first keypress (unlock autoplay policy)
    let audioInitialized = false;

    const handler = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;

      // Init audio once
      if (!audioInitialized) {
        initAudio();
        audioInitialized = true;
      }

      // Don't process if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Only handle navigation when data-nav-row elements exist on the page
      const rows = getAllRows();
      if (rows.length === 0) return;

      const r = rowRef.current;
      const c = colRef.current;
      const ridx = rows.indexOf(r);

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          if (ridx > 0) {
            const newRow = rows[ridx - 1];
            const savedCol = memoryRef.current[newRow] ?? c;
            setPosition(newRow, savedCol);
            playNavigateSound();
          } else if (ridx === -1 && rows.length > 0) {
            setPosition(rows[0], 0);
            playNavigateSound();
          }
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (ridx < rows.length - 1) {
            const newRow = rows[ridx + 1];
            const savedCol = memoryRef.current[newRow] ?? c;
            setPosition(newRow, savedCol);
            playNavigateSound();
          } else if (ridx === -1 && rows.length > 0) {
            setPosition(rows[0], 0);
            playNavigateSound();
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (c > 0) {
            setPosition(r, c - 1);
            playNavigateSound();
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const items = getItemsInRow(r);
          if (c < items.length - 1) {
            setPosition(r, c + 1);
            playNavigateSound();
          }
          break;
        }
        case 'Enter': {
          // Play select sound — actual action handled by component
          playSelectSound();
          break;
        }
        // Escape/Backspace handled by individual components and App.tsx
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setPosition]);

  // Initial focus after page renders
  useEffect(() => {
    const t = setTimeout(() => {
      const rows = getAllRows();
      if (rows.length > 0 && !savedRef.current['__initial_done']) {
        setPosition(rows[0], 0);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [setPosition]);

  return (
    <SpatialNavContext.Provider value={{ focusedRow, focusedCol, setPosition, savePosition, restorePosition, setEnabled }}>
      {children}
    </SpatialNavContext.Provider>
  );
};
