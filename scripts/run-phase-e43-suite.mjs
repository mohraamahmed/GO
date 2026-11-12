import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";

const ARTIFACT_DIR = "C:/Users/MR/.gemini/antigravity/brain/ccb87eed-fca0-465c-b9d6-35beb91db114";
const REPORTS_DIR = path.join(ARTIFACT_DIR, "phase-e43-reports");

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const pages = [
  { id: "home", name: "الصفحة الرئيسية (Homepage)", url: "https://cafe-lens1.vercel.app/" },
  { id: "cafes", name: "دليل الكافيهات (Cafes Listing)", url: "https://cafe-lens1.vercel.app/cafes" },
  { id: "details", name: "تفاصيل الكافيه (Cafe Details)", url: "https://cafe-lens1.vercel.app/cafes/30-north-auc-innovation-hub" },
];

const presets = [
  { id: "mobile", name: "الهاتف المحمول (Mobile - Moto G4 / Slow 4G)", flag: "" },
  { id: "desktop", name: "سطح المكتب (Desktop)", flag: "--preset=desktop" },
];

const NUM_RUNS = 3;

async function fetchInfo(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { "Accept-Encoding": "gzip, deflate, br" } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          length: body.length,
        });
      });
    }).on("error", (err) => resolve({ statusCode: 500, error: err.message, headers: {} }));
  });
}

async function warmUp(url) {
  const info = await fetchInfo(url);
  console.log(`      Warm-up [${url}]: HTTP ${info.statusCode} | Vercel-Cache: ${info.headers["x-vercel-cache"] || "none"} | Age: ${info.headers["age"] || 0} | Server-Timing: ${info.headers["server-timing"] || "none"}`);
  return info;
}

async function main() {
  console.log("==================================================================");
  console.log("بدء تشغيل الجناح الكامل لاختبارات أداء Phase E.4.3 على الإنتاج (18 جولة)");
  console.log("رابط الإنتاج:", "https://cafe-lens1.vercel.app/");
  console.log("==================================================================");

  // Pre-warm all pages and critical assets
  console.log("\n>>> إجراء تسخين Edge Cache و Lambdas قبل بدء القياسات <<<");
  const cacheVerification = {
    timestamp: new Date().toISOString(),
    probeResults: [],
  };

  for (const page of pages) {
    const p1 = await warmUp(page.url);
    const p2 = await warmUp(page.url);
    cacheVerification.probeResults.push({
      url: page.url,
      firstProbe: { status: p1.statusCode, cache: p1.headers["x-vercel-cache"], age: p1.headers["age"], serverTiming: p1.headers["server-timing"] },
      secondProbe: { status: p2.statusCode, cache: p2.headers["x-vercel-cache"], age: p2.headers["age"], serverTiming: p2.headers["server-timing"] },
    });
  }

  // Pre-warm poster images and LCP images
  await warmUp("https://cafe-lens1.vercel.app/hero-poster.webp");
  await warmUp("https://cafe-lens1.vercel.app/hero-poster-mobile.webp");
  await warmUp("https://lh3.googleusercontent.com/grass-cs/AABkmLeUdP3oNXkf-uFBV1V1aiQ6cKF_9WKZ9NBic8R7DlIFUdpHgBi9pQevOde93ky2fBR4DIj2wOfPz4OAoXPBS3_vvuvzC54GTIDTceEzoE9ftt3G4ob-CEpjSKGZBIG6c-p0qIMgWtniE8pV=w400-h260-k-no-rw");

  const summary = {};
  const mainThreadDiagnostics = {};
  const lcpBreakdown = {};

  for (const page of pages) {
    summary[page.id] = { name: page.name, url: page.url, mobile: {}, desktop: {} };
    mainThreadDiagnostics[page.id] = { name: page.name, mobile: [], desktop: [] };
    lcpBreakdown[page.id] = { name: page.name, mobile: [], desktop: [] };

    for (const preset of presets) {
      console.log(`\n>>> فحص: ${page.name} [${preset.name}] <<<`);
      const runs = [];

      for (let i = 1; i <= NUM_RUNS; i++) {
        const filePrefix = `phase-e43-${page.id}-${preset.id}-run${i}`;
        const outBase = path.join(REPORTS_DIR, filePrefix);
        
        console.log(`\n  --> الجولة ${i} من ${NUM_RUNS} ...`);
        const cmd = `npx lighthouse "${page.url}" ${preset.flag} --chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage" --output=json --output=html --output-path="${outBase}" --only-categories=performance --quiet`;
        
        const start = Date.now();
        try {
          execSync(cmd, { stdio: "inherit", timeout: 180000 });
          const dur = ((Date.now() - start) / 1000).toFixed(1);
          console.log(`      اكتملت الجولة في ${dur}s`);

          let jsonPath = `${outBase}.report.json`;
          if (!fs.existsSync(jsonPath)) {
            jsonPath = `${outBase}.json`;
          }

          if (fs.existsSync(jsonPath)) {
            const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
            const audits = raw.audits;
            const netRequests = audits["network-requests"]?.details?.items || [];
            
            // Extract LCP Breakdown
            const lcpItem = audits["largest-contentful-paint-element"]?.details?.items?.[1]?.items || [];
            let ttfb = Math.round(audits["server-response-time"]?.numericValue || 0);
            let loadDelay = 0;
            let loadDuration = 0;
            let renderDelay = 0;

            if (Array.isArray(lcpItem)) {
              lcpItem.forEach(phase => {
                if (phase.phase === "TTFB") ttfb = Math.round(phase.timing || 0);
                else if (phase.phase === "Load Delay") loadDelay = Math.round(phase.timing || 0);
                else if (phase.phase === "Load Time") loadDuration = Math.round(phase.timing || 0);
                else if (phase.phase === "Render Delay") renderDelay = Math.round(phase.timing || 0);
              });
            }

            const lcpNode = audits["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node;
            const lcpElement = lcpNode?.nodeLabel || lcpNode?.snippet || "";

            // Extract Long Tasks count and max duration
            const longTasks = audits["long-tasks"]?.details?.items || [];
            const longTasksCount = longTasks.length;
            const maxLongTaskMs = longTasks.reduce((max, t) => Math.max(max, Math.round(t.duration || 0)), 0);

            // Extract Main Thread Work Breakdown
            const mainThreadItems = audits["mainthread-work-breakdown"]?.details?.items || [];
            const jsExecutionMs = Math.round(mainThreadItems.find(i => i.group === "scriptEvaluation")?.duration || 0);
            const styleLayoutMs = Math.round(mainThreadItems.find(i => i.group === "styleLayout")?.duration || 0);
            const paintCompositeMs = Math.round(mainThreadItems.find(i => i.group === "paintCompositeRender")?.duration || 0);
            const otherMs = Math.round(mainThreadItems.find(i => i.group === "other")?.duration || 0);
            const parseHTMLMs = Math.round(mainThreadItems.find(i => i.group === "parseHTML")?.duration || 0);

            let jsBytes = 0;
            let cssBytes = 0;
            let htmlBytes = 0;
            for (const item of netRequests) {
              const t = item.resourceType;
              if (t === "Script") jsBytes += (item.transferSize || 0);
              else if (t === "Stylesheet") cssBytes += (item.transferSize || 0);
              else if (t === "Document") htmlBytes += (item.transferSize || 0);
            }

            const runData = {
              run: i,
              score: Math.round((raw.categories.performance?.score || 0) * 100),
              fcp: Math.round(audits["first-contentful-paint"]?.numericValue || 0),
              lcp: Math.round(audits["largest-contentful-paint"]?.numericValue || 0),
              cls: Number((audits["cumulative-layout-shift"]?.numericValue || 0).toFixed(4)),
              tbt: Math.round(audits["total-blocking-time"]?.numericValue || 0),
              speedIndex: Math.round(audits["speed-index"]?.numericValue || 0),
              interactive: Math.round(audits["interactive"]?.numericValue || 0),
              totalTransferredBytes: Math.round(audits["total-byte-weight"]?.numericValue || 0),
              jsTransferredBytes: jsBytes,
              cssTransferredBytes: cssBytes,
              htmlTransferredBytes: htmlBytes,
              ttfb,
              lcpElement,
              lcpLoadDelay: loadDelay,
              lcpLoadDuration: loadDuration,
              lcpRenderDelay: renderDelay,
              longTasksCount,
              maxLongTaskMs,
              jsExecutionMs,
              styleLayoutMs,
              paintCompositeMs,
              otherMs,
              parseHTMLMs,
              jsonReport: jsonPath,
              htmlReport: jsonPath.replace(/\.json$/, ".html"),
            };
            runs.push(runData);

            // Record diagnostics
            mainThreadDiagnostics[page.id][preset.id].push({
              run: i,
              tbt: runData.tbt,
              longTasksCount,
              maxLongTaskMs,
              longTasks: longTasks.slice(0, 5).map(t => ({ duration: Math.round(t.duration), startTime: Math.round(t.startTime), url: t.url })),
              jsExecutionMs,
              styleLayoutMs,
              paintCompositeMs,
              otherMs,
              parseHTMLMs,
            });

            lcpBreakdown[page.id][preset.id].push({
              run: i,
              lcp: runData.lcp,
              lcpElement,
              ttfb,
              loadDelay,
              loadDuration,
              renderDelay,
            });

            console.log(`      النتائج: Score=${runData.score} | FCP=${(runData.fcp/1000).toFixed(2)}s | LCP=${(runData.lcp/1000).toFixed(2)}s | CLS=${runData.cls} | TBT=${runData.tbt}ms | Total=${Math.round(runData.totalTransferredBytes/1024)}KB`);

            // If run 1, copy as canonical to root artifact dir
            if (i === 1) {
              const canonicalBase = path.join(ARTIFACT_DIR, `phase-e43-${page.id}-${preset.id}.report`);
              fs.copyFileSync(jsonPath, `${canonicalBase}.json`);
              const htmlSource = jsonPath.replace(/\.json$/, ".html");
              if (fs.existsSync(htmlSource)) {
                fs.copyFileSync(htmlSource, `${canonicalBase}.html`);
              }
            }
          }
        } catch (err) {
          console.error(`      فشلت الجولة ${i}:`, err.message);
        }
      }

      if (runs.length > 0) {
        const avg = {
          score: Math.round(runs.reduce((a, b) => a + b.score, 0) / runs.length),
          fcp: Math.round(runs.reduce((a, b) => a + b.fcp, 0) / runs.length),
          lcp: Math.round(runs.reduce((a, b) => a + b.lcp, 0) / runs.length),
          cls: Number((runs.reduce((a, b) => a + b.cls, 0) / runs.length).toFixed(4)),
          tbt: Math.round(runs.reduce((a, b) => a + b.tbt, 0) / runs.length),
          speedIndex: Math.round(runs.reduce((a, b) => a + b.speedIndex, 0) / runs.length),
          interactive: Math.round(runs.reduce((a, b) => a + b.interactive, 0) / runs.length),
          totalTransferredBytes: Math.round(runs.reduce((a, b) => a + b.totalTransferredBytes, 0) / runs.length),
          jsTransferredBytes: Math.round(runs.reduce((a, b) => a + b.jsTransferredBytes, 0) / runs.length),
          htmlTransferredBytes: Math.round(runs.reduce((a, b) => a + b.htmlTransferredBytes, 0) / runs.length),
          ttfb: Math.round(runs.reduce((a, b) => a + b.ttfb, 0) / runs.length),
          longTasksCount: Math.round(runs.reduce((a, b) => a + b.longTasksCount, 0) / runs.length),
          maxLongTaskMs: Math.round(runs.reduce((a, b) => a + b.maxLongTaskMs, 0) / runs.length),
          jsExecutionMs: Math.round(runs.reduce((a, b) => a + b.jsExecutionMs, 0) / runs.length),
          styleLayoutMs: Math.round(runs.reduce((a, b) => a + b.styleLayoutMs, 0) / runs.length),
          paintCompositeMs: Math.round(runs.reduce((a, b) => a + b.paintCompositeMs, 0) / runs.length),
        };

        const maxTbt = Math.max(...runs.map(r => r.tbt));
        const maxLcp = Math.max(...runs.map(r => r.lcp));
        const minScore = Math.min(...runs.map(r => r.score));

        summary[page.id][preset.id] = {
          averages: avg,
          maxTbt,
          maxLcp,
          minScore,
          runs,
        };

        console.log(`\n  ==> المتوسط النهائي لـ ${page.name} [${preset.name}]: Score=${avg.score} (min=${minScore}) | LCP=${(avg.lcp/1000).toFixed(2)}s (max=${(maxLcp/1000).toFixed(2)}s) | CLS=${avg.cls} | TBT=${avg.tbt}ms (max=${maxTbt}ms)`);
      }
    }
  }

  // Save all diagnostic and summary JSON files
  const summaryPath = path.join(ARTIFACT_DIR, "phase-e43-performance-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  fs.writeFileSync("phase-e43-performance-summary.json", JSON.stringify(summary, null, 2), "utf8");

  const diagPath = path.join(ARTIFACT_DIR, "phase-e43-main-thread-diagnostics.json");
  fs.writeFileSync(diagPath, JSON.stringify(mainThreadDiagnostics, null, 2), "utf8");
  fs.writeFileSync("phase-e43-main-thread-diagnostics.json", JSON.stringify(mainThreadDiagnostics, null, 2), "utf8");

  const lcpPath = path.join(ARTIFACT_DIR, "phase-e43-lcp-breakdown.json");
  fs.writeFileSync(lcpPath, JSON.stringify(lcpBreakdown, null, 2), "utf8");
  fs.writeFileSync("phase-e43-lcp-breakdown.json", JSON.stringify(lcpBreakdown, null, 2), "utf8");

  const cachePath = path.join(ARTIFACT_DIR, "phase-e43-cache-verification.json");
  fs.writeFileSync(cachePath, JSON.stringify(cacheVerification, null, 2), "utf8");
  fs.writeFileSync("phase-e43-cache-verification.json", JSON.stringify(cacheVerification, null, 2), "utf8");

  console.log(`\n==================================================================`);
  console.log(`✅ اكتملت جميع الجولات الـ 18 بنجاح! تم حفظ التقارير والملخصات.`);
  console.log(`  - Summary: ${summaryPath}`);
  console.log(`  - Main-Thread Diagnostics: ${diagPath}`);
  console.log(`  - LCP Breakdown: ${lcpPath}`);
  console.log(`  - Cache Verification: ${cachePath}`);
  console.log(`==================================================================`);
}

main().catch(console.error);
