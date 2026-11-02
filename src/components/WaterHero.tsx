import { useEffect, useRef } from "react";

const VERT = `attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;uv.y=1.0-uv.y;gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision mediump float;varying vec2 uv;uniform sampler2D t;uniform float time;uniform vec2 res;uniform vec2 img;uniform vec2 mouse;
void main(){
  float sr=res.x/res.y, ir=img.x/img.y;
  vec2 s=sr<ir?vec2(sr/ir,1.):vec2(1.,ir/sr);
  vec2 c=(uv-0.5)*s+0.5;
  c+= (mouse-0.5)*0.015;
  float water=smoothstep(0.58,0.66,c.y);
  float w=sin(c.y*90.-time*2.)*0.003+sin(c.x*25.+time*1.3)*0.002;
  c.x+=w*water; c.y+=w*0.6*water;
  float d=distance(uv,mouse);
  c+= (uv-mouse)*0.02*exp(-d*12.)*sin(d*60.-time*5.);
  vec3 col=texture2D(t,c).rgb;
  float glow=0.04*sin(time*0.8)+0.04;
  col+=vec3(0.9,0.5,0.2)*glow*(1.-uv.y);
  gl_FragColor=vec4(col,1.);
}`;

export function WaterHero({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const gl = cv.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
    if (!gl) return;
    const sh = (type: number, code: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, code);
      gl.compileShader(s);
      return s;
    };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
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
    let iw = 1, ih = 1, raf = 0, ready = false;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      iw = im.width; ih = im.height;
      const tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      ready = true;
      cv.dataset["sceneReady"] = "1";
    };
    im.src = src;
    const resize = () => {
      const dpr = innerWidth < 768 ? 0.5 : 0.6;
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
      gl.viewport(0, 0, cv.width, cv.height);
    };
    const move = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = (e.clientY - r.top) / r.height;
    };
    resize();
    addEventListener("resize", resize);
    addEventListener("pointermove", move, { passive: true });
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; });
    io.observe(cv);
    const locs = { time: u("time"), res: u("res"), img: u("img"), mouse: u("mouse") };
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!ready || !visible || document.hidden) return;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      gl.uniform1f(locs.time, (performance.now() - t0) / 1000);
      gl.uniform2f(locs.res, cv.width, cv.height);
      gl.uniform2f(locs.img, iw, ih);
      gl.uniform2f(locs.mouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener("resize", resize);
      removeEventListener("pointermove", move);
    };
  }, [src]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
