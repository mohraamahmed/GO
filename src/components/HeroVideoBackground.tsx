import { useEffect, useRef, useState, useCallback } from "react";

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
  const [posterLoaded, setPosterLoaded] = useState(false);

  // 1. Video Autoplay Management & Error Handling
  useEffect(() => {
    const video = videoRef.current;
    if (!video || useCanvasFallback) return;

    let isMounted = true;

    const attemptPlay = async () => {
      try {
        video.muted = true;
        video.defaultMuted = true;
        await video.play();
        if (isMounted) {
          setIsVideoPlaying(true);
        }
      } catch (err) {
        console.warn("Video autoplay prevented or unsupported, activating smooth Canvas sequence fallback:", err);
        if (isMounted) {
          setUseCanvasFallback(true);
        }
      }
    };

    attemptPlay();

    // 2. IntersectionObserver: Pause when out of view to save 100% GPU/CPU for page scrolling
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
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

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // 3. Page Visibility: Pause when tab is hidden
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

  // 4. Ultra-smooth Canvas Sequence Player (Fallback if video is blocked by Low Power Mode / Data Saver)
  useEffect(() => {
    if (!useCanvasFallback) return;

    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: false });
    if (!ctx) return;

    let isMounted = true;
    let animId = 0;
    const loadedImages: HTMLImageElement[] = [];

    // Preload all 20 frames into memory
    const loadPromises = Array.from({ length: framesCount }, (_, i) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = `/hero-frames/frame_${String(i).padStart(5, "0")}.webp`;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
      });
    });

    Promise.all(loadPromises).then((imgs) => {
      if (!isMounted) return;
      loadedImages.push(...imgs);

      // Ping-pong sequence indices: 0..19..1
      const pingPongSequence: number[] = [];
      for (let i = 0; i < framesCount; i++) pingPongSequence.push(i);
      for (let i = framesCount - 2; i > 0; i--) pingPongSequence.push(i);

      const totalSteps = pingPongSequence.length;
      const stepDuration = 83.33; // ~12 fps keyframe pacing with cross-fade interpolation
      let startTime = performance.now();

      const render = (now: number) => {
        animId = requestAnimationFrame(render);
        if (document.hidden || loadedImages.length === 0) return;

        const elapsed = (now - startTime) % (totalSteps * stepDuration);
        const floatIndex = elapsed / stepDuration;
        const currentIdx = Math.floor(floatIndex) % totalSteps;
        const nextIdx = (currentIdx + 1) % totalSteps;
        const blend = floatIndex - Math.floor(floatIndex); // 0.0 to 1.0 subframe interpolation

        const img1 = loadedImages[pingPongSequence[currentIdx]!];
        const img2 = loadedImages[pingPongSequence[nextIdx]!];

        if (!img1 || !img2 || !img1.complete || !img2.complete) return;

        // Cover sizing calculation
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
        if (!cv) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        cv.width = Math.round((cv.clientWidth || window.innerWidth) * dpr);
        cv.height = Math.round((cv.clientHeight || window.innerHeight) * dpr);
      };

      handleResize();
      window.addEventListener("resize", handleResize);
      animId = requestAnimationFrame(render);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
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
      {/* 1. Instant Static Poster (Zero CLS, Zero LCP delay) */}
      <img
        src={posterSrc}
        alt={alt}
        fetchPriority="high"
        decoding="async"
        onLoad={() => setPosterLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover object-[center_42%] transition-opacity duration-1000 ease-out will-change-[opacity] ${
          posterLoaded ? "opacity-100" : "opacity-90"
        }`}
      />

      {/* 2. Hardware-Accelerated Seamless Video Player */}
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
          className={`absolute inset-0 h-full w-full object-cover object-[center_42%] transition-opacity duration-700 ease-out will-change-[opacity] ${
            isVideoPlaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src={videoWebmSrc} type="video/webm" />
          <source src={videoMp4Src} type="video/mp4" />
        </video>
      )}

      {/* 3. Canvas Fallback Player (for battery-saver / restricted autoplay devices) */}
      {useCanvasFallback && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out"
        />
      )}

      {/* 4. Luxury Cinematic Vignette & Depth Enhancement Overlay */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_40%,rgba(0,0,0,0.35)_100%]" />
    </div>
  );
}
