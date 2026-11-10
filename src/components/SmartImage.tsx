/**
 * SmartImage — صورة ذكية بـ blur placeholder وتحميل تدريجي احترافي
 * - أول صورة في الصفحة: eager load (بدون lazy)
 * - باقي الصور: lazy load
 * - Blur placeholder أثناء التحميل
 * - Fade in smooth بعد التحميل
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Aperture } from "lucide-react";

type SmartImageProps = {
  src: string | null | undefined;
  alt: string;
  /** هل دي أول صورة في الصفحة (فوق الفولد)? → eager load */
  priority?: boolean;
  className?: string;
  fallbackClassName?: string;
  referrerPolicy?: "no-referrer" | "origin" | "strict-origin-when-cross-origin";
};

/** optimize Google photo URLs and external CDNs to request compact WebP size */
export function optimizeImgUrl(url: string, width = 640): string {
  if (!url) return url;
  // Google Maps / Places Photos: lh3.googleusercontent.com
  if (url.includes("googleusercontent.com")) {
    const base = url.split("=")[0];
    const height = Math.round(width * 0.65);
    // k-no: no crop distortion, rw: WebP format, nu: direct
    return `${base}=w${width}-h${height}-k-no-rw`;
  }
  // Supabase Storage: add width and webp transforms
  if ((url.includes("supabase") || url.includes(".co/storage/")) && !url.includes("width=")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}width=${width}&quality=80&format=webp`;
  }
  return url;
}

export function SmartImage({
  src,
  alt,
  priority = false,
  className = "h-full w-full object-cover",
  fallbackClassName,
  referrerPolicy = "no-referrer",
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => setErrored(true), []);

  useEffect(() => {
    if (priority || isInView) return;
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [priority, isInView]);

  if (!src || errored) {
    return (
      <div className={`grid place-items-center bg-muted text-muted-foreground ${fallbackClassName ?? className}`}>
        <Aperture className="h-8 w-8 opacity-40" />
      </div>
    );
  }

  const optimizedSrc = optimizeImgUrl(src, priority ? 640 : 480);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {/* Shimmer placeholder shown until image loads (disabled for priority to never block LCP paint) */}
      {!loaded && !priority && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-amber-950/50 via-stone-800/70 to-amber-900/30"
          style={{
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s ease-in-out infinite",
          }}
          aria-hidden
        />
      )}

      {/* Main image — only rendered when in view to prevent Chromium native lazy-load bandwidth contention */}
      {isInView && (
        <img
          src={optimizedSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "high" : "low"}
          referrerPolicy={referrerPolicy}
          onLoad={handleLoad}
          onError={handleError}
          ref={(node) => {
            if (node?.complete && !loaded) {
              setLoaded(true);
            }
          }}
          className={`${className} ${
            priority
              ? "opacity-100"
              : `transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`
          }`}
        />
      )}
    </div>
  );
}

/** ThumbImage — thumbnail صغير 44-88px بتحسين حجم الـ URL */
export function ThumbImage({
  src,
  alt,
  className = "h-full w-full object-cover",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div className="grid h-full place-items-center bg-muted text-muted-foreground">
        <Aperture className="h-4 w-4 opacity-40" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-amber-950/40 to-stone-800/60" aria-hidden />
      )}
      <img
        src={optimizeImgUrl(src, 120)}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
