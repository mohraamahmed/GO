import { useEffect, useRef, useState } from "react";

interface HeroVideoBackgroundProps {
  posterSrc?: string;
  videoMp4Src?: string;
  videoWebmSrc?: string;
  framesCount?: number;
  alt?: string;
  className?: string;
}

// Cache-bust version — updated every time the module loads to force fresh assets
const CACHE_BUST = `?v=${Date.now()}`;

export function HeroVideoBackground({
  posterSrc = "/hero-poster.webp",
  videoMp4Src = "/hero-video.mp4",
  videoWebmSrc = "/hero-video.webm",
  framesCount = 20,
  alt = "مقهى دائري فاخر عند الغروب",
  className = "",
}: HeroVideoBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [useCanvasFallback, setUseCanvasFallback] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);

  // 1. Video Autoplay Management
  useEffect(() => {
    const video = videoRef.current;
    if (!video || useCanvasFallback) return;

    let isMounted = true;

    const attemptPlay = async () => {
      try {
        video.muted = true;
        video.defaultMuted = true;
        await video.play();
        if (isMounted) setIsVideoPlaying(true);
      } catch (err) {
        console.warn("Video autoplay prevented, activating Canvas fallback:", err);
        if (isMounted) setUseCanvasFallback(true);
      }
    };

    attemptPlay();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (video.paused && !useCanvasFallback) video.play().catch(() => {});
        } else {
          if (!video.paused) video.pause();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) observer.observe(containerRef.current);

    const handleVisibility = () => {
      if (document.hidden) {
        if (!video.paused) video.pause();
      } else {
        if (video.paused && !useCanvasFallback) video.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [useCanvasFallback]);

  // 2. Canvas Sequence — forward loop only (no ping-pong = no zoom in/out)
  useEffect(() => {
    if (!useCanvasFallback) return;

    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: false });
    if (!ctx) return;

    let isMounted = true;
    let animId = 0;

    // Load frames with cache-bust to always get the latest files
    const loadPromises = Array.from({ length: framesCount }, (_, i) =>
      new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = `/hero-frames/frame_${String(i).padStart(5, "0")}.webp${CACHE_BUST}`;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
      })
    );

    Promise.all(loadPromises).then((imgs) => {
      if (!isMounted) return;

      const stepDuration = 120; // ~8 fps
      const startTime = performance.now();

      const render = (now: number) => {
        animId = requestAnimationFrame(render);
        if (document.hidden || imgs.length === 0) return;

        const elapsed = (now - startTime) % (framesCount * stepDuration);
        const floatIndex = elapsed / stepDuration;
        const currentIdx = Math.floor(floatIndex) % framesCount;
        const nextIdx = (currentIdx + 1) % framesCount;
        const blend = floatIndex - Math.floor(floatIndex);

        const img1 = imgs[currentIdx]!;
        const img2 = imgs[nextIdx]!;
        if (!img1.complete || !img2.complete) return;

        const cw = cv.width;
        const ch = cv.height;
        const iw = img1.naturalWidth || 1280;
        const ih = img1.naturalHeight || 720;
        const scale = Math.max(cw / iw, ch / ih);
        const sw = iw * scale;
        const sh = ih * scale;
        const sx = (cw - sw) / 2;
        const sy = (ch - sh) * 0.32;

        ctx.globalAlpha = 1.0;
        ctx.drawImage(img1, sx, sy, sw, sh);
        if (blend > 0.01) {
          ctx.globalAlpha = blend;
          ctx.drawImage(img2, sx, sy, sw, sh);
        }
      };

      const handleResize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        cv.width = Math.round((cv.clientWidth || window.innerWidth) * dpr);
        cv.height = Math.round((cv.clientHeight || window.innerHeight) * dpr);
      };

      handleResize();
      window.addEventListener("resize", handleResize);
      animId = requestAnimationFrame(render);

      return () => window.removeEventListener("resize", handleResize);
    });

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, [useCanvasFallback, framesCount]);

  return (
    <div
      ref={containerRef}
      className={`hero-cinematic-bg absolute inset-0 overflow-hidden select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Poster — cache-busted */}
      <img
        src={`${posterSrc}${CACHE_BUST}`}
        alt={alt}
        fetchPriority="high"
        decoding="async"
        onLoad={() => setPosterLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover object-[center_42%] transition-opacity duration-1000 ease-out ${
          posterLoaded ? "opacity-100" : "opacity-90"
        }`}
      />

      {/* Video — cache-busted */}
      {!useCanvasFallback && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={`${posterSrc}${CACHE_BUST}`}
          onPlaying={() => setIsVideoPlaying(true)}
          className={`absolute inset-0 h-full w-full object-cover object-[center_42%] transition-opacity duration-700 ease-out ${
            isVideoPlaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src={`${videoMp4Src}${CACHE_BUST}`} type="video/mp4" />
          <source src={`${videoWebmSrc}${CACHE_BUST}`} type="video/webm" />
        </video>
      )}

      {/* Canvas fallback — forward loop only */}
      {useCanvasFallback && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out"
        />
      )}

      {/* Vignette */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_40%,rgba(0,0,0,0.35)_100%]" />
    </div>
  );
}
