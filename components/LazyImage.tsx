import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * LazyImage — Carregamento progressivo de imagens para TV Box
 * ═══════════════════════════════════════════════════════════════
 * - Intersection Observer (carrega apenas quando visível)
 * - LQIP placeholder blur → imagem full
 * - Fade-in suave ao carregar
 * - Decode async (não bloqueia main thread)
 * - Fallback em caso de erro
 * - Skeleton loader enquanto não renderiza
 * - WebP detection com fallback JPEG
 */

// ═══════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════

const PLACEHOLDER_SVG = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">' +
  '<rect fill="#16161e" width="400" height="600"/>' +
  '<rect fill="#1e1e2e" x="150" y="240" width="100" height="120" rx="10"/>' +
  '<circle fill="#2a2a3e" cx="200" cy="280" r="22"/>' +
  '<polygon fill="#2a2a3e" points="165,340 200,305 235,340"/>' +
  '</svg>'
);

const ERROR_SVG = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">' +
  '<rect fill="#1a1a2e" width="400" height="600"/>' +
  '<text fill="#444" font-family="Arial" font-size="14" text-anchor="middle" x="200" y="310">Sem Imagem</text>' +
  '</svg>'
);

// Cache de suporte WebP
let webpSupported: boolean | null = null;

async function checkWebPSupport(): Promise<boolean> {
  if (webpSupported !== null) return webpSupported;
  try {
    const img = new Image();
    const result = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(img.width > 0 && img.height > 0);
      img.onerror = () => resolve(false);
      img.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
    });
    webpSupported = result;
    return result;
  } catch {
    webpSupported = false;
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

/** Gera URL LQIP (Low Quality Image Placeholder) via TMDB */
function getLQIP(src: string): string | null {
  if (!src) return null;
  // TMDB: trocar /w500/ ou /original/ por /w92/ (miniatura borrada)
  if (src.includes('image.tmdb.org')) {
    return src.replace(/\/w\d+\/|\/original\//g, '/w92/');
  }
  return null;
}

/** Tenta converter URL para WebP se TMDB */
function getWebPUrl(src: string): string | null {
  // TMDB não suporta WebP nativamente, mas CDNs proxy podem
  // Retorna null para usar a URL original
  return null;
}

// ═══════════════════════════════════════════════════════
// COMPONENTE
// ═══════════════════════════════════════════════════════

export interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Proporção (ex: '2/3', '16/9', '1/1') */
  aspectRatio?: string;
  /** Distância para pré-carregar (px) */
  rootMargin?: string;
  /** URL de fallback em caso de erro */
  fallbackSrc?: string;
  /** Mostrar skeleton com blur */
  showSkeleton?: boolean;
  /** Callback ao carregar */
  onLoad?: () => void;
  /** Callback ao errar */
  onError?: () => void;
  /** object-fit */
  objectFit?: 'cover' | 'contain' | 'fill';
  /** Desabilitar lazy (forçar carregamento imediato) */
  eager?: boolean;
  /** Estilo inline adicional */
  style?: React.CSSProperties;
}

const LazyImage: React.FC<LazyImageProps> = React.memo(({
  src,
  alt,
  className = '',
  aspectRatio,
  rootMargin = '300px',
  fallbackSrc,
  showSkeleton = true,
  onLoad,
  onError,
  objectFit = 'cover',
  eager = false,
  style,
}) => {
  const [loadState, setLoadState] = useState<'idle' | 'lqip' | 'loading' | 'loaded' | 'error'>(
    eager ? 'loading' : 'idle'
  );
  const [currentSrc, setCurrentSrc] = useState<string>(PLACEHOLDER_SVG);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ── Intersection Observer — dispara carregamento quando visível ──
  useEffect(() => {
    if (eager || !containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoadState('lqip');
          observerRef.current?.disconnect();
        }
      },
      { rootMargin }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [rootMargin, eager]);

  // ── Pipeline de carregamento: LQIP → Full ──
  useEffect(() => {
    if (loadState === 'idle' || loadState === 'loaded' || loadState === 'error') return;
    if (!src) {
      setCurrentSrc(fallbackSrc || ERROR_SVG);
      setLoadState('error');
      return;
    }

    let cancelled = false;

    const loadImage = async () => {
      // 1. LQIP — miniatura borrada (se disponível)
      if (loadState === 'lqip') {
        const lqip = getLQIP(src);
        if (lqip) {
          setCurrentSrc(lqip);
        }
        // Avançar para carregamento full
        if (!cancelled) setLoadState('loading');
        return;
      }

      // 2. Full image — decode assíncrono
      if (loadState === 'loading') {
        try {
          const img = new Image() as HTMLImageElement;

          // decode() não bloqueia a main thread
          if (typeof img.decode === 'function') {
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('load_failed'));
              img.src = src;
            });
            await img.decode();
          } else {
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('load_failed'));
              img.src = src;
            });
          }

          if (!cancelled) {
            setCurrentSrc(src);
            setLoadState('loaded');
            onLoad?.();
          }
        } catch {
          if (!cancelled) {
            setCurrentSrc(fallbackSrc || ERROR_SVG);
            setLoadState('error');
            onError?.();
          }
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [loadState, src, fallbackSrc, onLoad, onError]);

  // Eager: disparar carregamento imediato
  useEffect(() => {
    if (eager && loadState === 'loading') {
      // A cadeia de loading já trata
    }
  }, [eager, loadState]);

  const isBlurred = loadState === 'lqip' || loadState === 'idle';
  const isLoaded = loadState === 'loaded';

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: aspectRatio || undefined,
        ...style,
      }}
    >
      {/* Skeleton loader */}
      {showSkeleton && !isLoaded && loadState !== 'error' && (
        <div className="absolute inset-0 bg-[rgba(255,255,255,0.03)] z-[1]">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        </div>
      )}

      {/* Imagem principal */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={`w-full h-full transition-all duration-700 ease-out ${
          isBlurred ? 'scale-110 blur-lg opacity-60' : ''
        } ${
          isLoaded ? 'scale-100 blur-0 opacity-100' : ''
        } ${
          loadState === 'error' ? 'scale-100 blur-0 opacity-50' : ''
        }`}
        style={{ objectFit }}
        draggable={false}
      />

      {/* Fade-in overlay que desaparece ao carregar */}
      <div
        className={`absolute inset-0 bg-[#0B0B0F] transition-opacity duration-500 pointer-events-none ${
          isLoaded ? 'opacity-0' : 'opacity-30'
        }`}
      />
    </div>
  );
});

LazyImage.displayName = 'LazyImage';
export default LazyImage;
export { PLACEHOLDER_SVG, ERROR_SVG };
