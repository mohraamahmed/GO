import { useEffect, useRef, useState } from "react";

interface HeroVideoBackgroundProps {
  posterSrc?: string;
  videoMp4Src?: string;
  videoWebmSrc?: string;
  alt?: string;
  className?: string;
}

export function HeroVideoBackground({
  posterSrc = "/hero-poster.webp",
  videoMp4Src = "/hero-video.mp4",
  videoWebmSrc = "/hero-video.webm",
  alt = "مقهى دائري فاخر عند الغروب",
  className = "",
}: HeroVideoBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isMounted = true;

    // Ensure required mobile autoplay attributes
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");

    const attemptPlay = async () => {
      if (!video) return;
      try {
        await video.play();
        if (isMounted) {
          setIsVideoPlaying(true);
        }
      } catch {
        // Autoplay policy or low battery mode blocked initial play; will play on first interaction
      }
    };

    attemptPlay();

    // In case video loads data after mount
    const handleCanPlay = () => {
      if (video.paused) {
        attemptPlay();
      }
    };
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", () => {
      if (isMounted) setIsVideoPlaying(true);
    });

    // Fallback: start video on first touch/interaction on mobile
    const handleUserInteraction = () => {
      if (video && video.paused) {
        video.play().then(() => {
          if (isMounted) setIsVideoPlaying(true);
        }).catch(() => {});
      }
      removeInteractionListeners();
    };

    const removeInteractionListeners = () => {
      window.removeEventListener("touchstart", handleUserInteraction);
      window.removeEventListener("scroll", handleUserInteraction, { capture: true });
      window.removeEventListener("pointerdown", handleUserInteraction);
    };

    window.addEventListener("touchstart", handleUserInteraction, { passive: true, once: true });
    window.addEventListener("scroll", handleUserInteraction, { passive: true, once: true, capture: true });
    window.addEventListener("pointerdown", handleUserInteraction, { passive: true, once: true });

    // IntersectionObserver to pause when off-screen to save battery/resources
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry || !isMounted) return;
        if (entry.isIntersecting) {
          if (video.paused) {
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
        if (video.paused) video.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      observer.disconnect();
      video.removeEventListener("canplay", handleCanPlay);
      removeInteractionListeners();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

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
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster={posterSrc}
        className={`absolute inset-0 h-full w-full object-cover object-[center_42%] transition-opacity duration-700 ease-out ${
          isVideoPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        <source src={videoMp4Src} type="video/mp4" />
        <source src={videoWebmSrc} type="video/webm" />
      </video>

      {/* 3. Luxury Cinematic Vignette */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_40%,rgba(0,0,0,0.35)_100%]" />
    </div>
  );
}
