import { useEffect, useRef, useState } from "react";

interface HeroVideoBackgroundProps {
  posterSrc?: string;
  videoMp4Src?: string;
  videoWebmSrc?: string;
  framesCount?: number;
  alt?: string;
  className?: string;
}

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

  // 1. Direct Hardware-Accelerated Video Autoplay
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isMounted = true;

    const playVideo = async () => {
      try {
        video.muted = true;
        video.defaultMuted = true;
        await video.play();
        if (isMounted) {
          setIsVideoPlaying(true);
        }
      } catch (err) {
        console.warn("Video autoplay prevented by device policy, enabling smooth Canvas sequence:", err);
        if (isMounted) {
          setUseCanvasFallback(true);
        }
      }
    };

    // Attempt autoplay immediately
    playVideo();

    // IntersectionObserver to pause when off-screen to save battery/resources
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry || !isMounted) return;
        if (entry.isIntersecting) {
          if (video.paused && !useCanvasFallback) {
            video.play().catch(() => {});
          }
        } else {
          if (!video.paused) {
            video.pause();
          }
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) observer.observe(containerRef.current);

    const handleVisibility = () => {
      if (document.hidden) {
        if (!video.paused) video.pause();
      } else {
        if (video.paused && !useCanvasFallback) {
          video.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [useCanvasFallback]);

  // 2. High-Performance Smooth Canvas Fallback (Only active if video autoplay is blocked by device)
  useEffect(() => {
    if (!useCanvasFallback) return;

    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: false });
    if (!ctx) return;

    let isMounted = true;
    let animId = 0;

    // Load frames
    const loadPromises = Array.from({ length: framesCount }, (_, i) =>
      new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = `/hero-frames/frame_${String(i).padStart(5, "0")}.webp`;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
      })
    );

    Promise.all(loadPromises).then((imgs) => {
      if (!isMounted) return;

      // Natural, calm cinematic pacing: ~390ms per frame matching ~7.9s loop smoothly
      const stepDuration = 390;
      const startTime = performance.now();

      const render = (now: number) => {
        animId = requestAnimationFrame(render);
        if (document.hidden || imgs.length === 0) return;

        const elapsed = (now - startTime) % (framesCount * stepDuration);
        const floatIndex = elapsed / stepDuration;
        const currentIdx = Math.floor(floatIndex) % framesCount;
        const nextIdx = (currentIdx + 1) % framesCount;
        const blend = floatIndex - Math.floor(floatIndex); // 0.0 -> 1.0 smooth crossfade

        const img1 = imgs[currentIdx]!;
        const img2 = imgs[nextIdx]!;
        if (!img1.complete || !img2.complete) return;

        const cw = cv.width;
        const ch = cv.height;
        const iw = img1.naturalWidth || 720;
        const ih = img1.naturalHeight || 1280;
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
      {/* 1. Permanent Static Poster Image (ALWAYS visible underneath — prevents ANY black screen flash) */}
      <img
        src={posterSrc}
        alt={alt}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-[center_42%]"
      />

      {/* 2. Hardware-Accelerated Video Player */}
      {!useCanvasFallback && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={posterSrc}
          onPlaying={() => setIsVideoPlaying(true)}
          className={`absolute inset-0 h-full w-full object-cover object-[center_42%] transition-opacity duration-700 ease-out ${
            isVideoPlaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src={videoMp4Src} type="video/mp4" />
          <source src={videoWebmSrc} type="video/webm" />
        </video>
      )}

      {/* 3. Smooth Canvas Fallback Player */}
      {useCanvasFallback && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out"
        />
      )}

      {/* 4. Luxury Cinematic Vignette */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_40%,rgba(0,0,0,0.35)_100%]" />
    </div>
  );
}
