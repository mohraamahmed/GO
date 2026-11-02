import { useEffect, useRef, useState } from "react";

const VERT = `attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;uv.y=1.0-uv.y;gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision highp float;varying vec2 uv;uniform sampler2D t;uniform float time;uniform vec2 res;uniform vec2 img;uniform vec2 mouse;
void main(){
  float sr = res.x / res.y;
  float ir = img.x / img.y;
  vec2 s = sr < ir ? vec2(sr / ir, 1.0) : vec2(1.0, ir / sr);
  vec2 c = (uv - 0.5) * s + 0.5;

  // Water boundary in the reflection zone (bottom ~42% of the composition)
  float water = smoothstep(0.56, 0.65, c.y);

  // Natural subtle wave ONLY on the reflective water pool
  float w = (sin(c.y * 70.0 - time * 2.0) * 0.003 + sin(c.x * 25.0 + time * 1.4) * 0.002) * water;
  c.x += w;
  c.y += w * 0.5;

  // Interactive mouse ripples: ONLY affect the water, keeping the building, people, and sky 100% razor sharp
  float d = distance(uv, mouse);
  vec2 mouseRipple = (uv - mouse) * 0.018 * exp(-d * 10.0) * sin(d * 45.0 - time * 4.5);
  c += mouseRipple * water;

  // Clamp within bounds to prevent edge smear
  c = clamp(c, vec2(0.001), vec2(0.999));

  vec3 col = texture2D(t, c).rgb;
  gl_FragColor = vec4(col, 1.0);
}`;

export function WaterHero({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    // Prefer WebGL2 for hardware NPOT mipmapping and superior texture downsampling
    const gl = (cv.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    }) ||
      cv.getContext("webgl", {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      })) as WebGL2RenderingContext | WebGLRenderingContext | null;

    if (!gl) return;

    const sh = (type: number, code: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, code);
      gl.compileShader(s);
      return s;
    };

    const vertShader = sh(gl.VERTEX_SHADER, VERT);
    const fragShader = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vertShader || !fragShader) return;

    const pr = gl.createProgram();
    if (!pr) return;
    gl.attachShader(pr, vertShader);
    gl.attachShader(pr, fragShader);
    gl.linkProgram(pr);
    gl.useProgram(pr);

    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (n: string) => gl.getUniformLocation(pr, n);
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let iw = 1,
      ih = 1,
      raf = 0,
      ready = false;

    // Cache bounding rect to prevent forced reflows/layout thrashing on pointermove
    let rect = cv.getBoundingClientRect();
    const updateRect = () => {
      if (cv) rect = cv.getBoundingClientRect();
    };

    const tx = gl.createTexture();
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      iw = im.width;
      ih = im.height;
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // In WebGL2 or with NPOT mipmap support, generate mipmaps for artifact-free downsampling
      if (gl instanceof WebGL2RenderingContext) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      }

      ready = true;
      setLoaded(true);
      cv.dataset["sceneReady"] = "1";
    };
    im.src = src;

    const resize = () => {
      // Cap DPR to 1.25: preserves full crispness while cutting GPU fill rate by ~75% compared to DPR 2
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = Math.max(1, Math.round((cv.clientWidth || window.innerWidth) * dpr));
      const height = Math.max(1, Math.round((cv.clientHeight || window.innerHeight) * dpr));
      if (cv.width !== width || cv.height !== height) {
        cv.width = width;
        cv.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    // Use cached rect on pointermove - zero layout thrashing
    const move = (e: PointerEvent) => {
      if (rect.width <= 0 || rect.height <= 0) return;
      mouse.tx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      mouse.ty = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    };

    resize();
    updateRect();

    // ResizeObserver tracks accurate dimensions as soon as layout settles
    const ro = new ResizeObserver(() => {
      updateRect();
      resize();
    });
    ro.observe(cv);

    window.addEventListener("scroll", updateRect, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
    });
    io.observe(cv);

    const locs = { time: u("time"), res: u("res"), img: u("img"), mouse: u("mouse") };
    const t0 = performance.now();
    let lastFrame = 0;
    const targetInterval = 1000 / 60; // 60 FPS cap to prevent melting high-refresh 144Hz/240Hz screens

    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      if (!ready || !visible || document.hidden) return;

      const delta = time - lastFrame;
      if (delta < targetInterval - 1) return;
      lastFrame = time - (delta % targetInterval);

      // Smooth mouse interpolation
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      gl.uniform1f(locs.time, (time - t0) / 1000);
      gl.uniform2f(locs.res, cv.width, cv.height);
      gl.uniform2f(locs.img, iw, ih);
      gl.uniform2f(locs.mouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", updateRect);
      window.removeEventListener("pointermove", move);
      gl.deleteTexture(tx);
      gl.deleteBuffer(b);
      gl.deleteProgram(pr);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
    };
  }, [src]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full pointer-events-none transition-opacity duration-700 ease-out ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
