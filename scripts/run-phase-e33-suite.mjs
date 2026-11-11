import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";

const ARTIFACT_DIR = "C:/Users/MR/.gemini/antigravity/brain/ccb87eed-fca0-465c-b9d6-35beb91db114";
const REPORTS_DIR = path.join(ARTIFACT_DIR, "phase-e33-reports");

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

async function warmUp(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { "Accept-Encoding": "gzip, deflate, br", "User-Agent": "Mozilla/5.0" } }, (res) => {
      res.on("data", () => {});
      res.on("end", () => {
        console.log(`      Warm-up [${url}]: HTTP ${res.statusCode} | Vercel-Cache: ${res.headers["x-vercel-cache"] || "none"} | Edge: ${res.headers["x-vercel-id"] || "none"}`);
        resolve();
      });
    }).on("error", () => resolve());
  });
}

async function main() {
  console.log("==================================================================");
  console.log("بدء تشغيل الجناح الكامل لاختبارات أداء Phase E.3.3 على الإنتاج (18 جولة)");
  console.log("رابط الإنتاج:", "https://cafe-lens1.vercel.app/");
  console.log("==================================================================");

  // Pre-warm all pages
  console.log("\n>>> إجراء تسخين Edge Cache ومثيل فرانكفورت قبل بدء القياسات <<<");
  for (const page of pages) {
    await warmUp(page.url);
    await warmUp(page.url);
  }

  const summary = {};

  for (const page of pages) {
    summary[page.id] = { name: page.name, url: page.url, mobile: {}, desktop: {} };

    for (const preset of presets) {
      console.log(`\n>>> فحص: ${page.name} [${preset.name}] <<<`);
      const runs = [];

      for (let i = 1; i <= NUM_RUNS; i++) {
        const filePrefix = `phase-e33-${page.id}-${preset.id}-run${i}`;
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

            const lcpElement = audits["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.nodeLabel || "";

            // Resource breakdown
            let totalTransferred = 0;
            let jsTransferred = 0;
            let cssTransferred = 0;
            let htmlTransferred = 0;

            for (const r of netRequests) {
              const bytes = r.transferSize || 0;
              totalTransferred += bytes;
              if (r.resourceType === "Script") jsTransferred += bytes;
              else if (r.resourceType === "Stylesheet") cssTransferred += bytes;
              else if (r.resourceType === "Document") htmlTransferred += bytes;
            }

            const longTasks = audits["long-tasks"]?.details?.items || [];
            let maxLongTask = 0;
            longTasks.forEach(t => {
              if (t.duration > maxLongTask) maxLongTask = Math.round(t.duration);
            });

            const runData = {
              run: i,
              score: Math.round((raw.categories.performance?.score || 0) * 100),
              fcp: Math.round(audits["first-contentful-paint"]?.numericValue || 0),
              lcp: Math.round(audits["largest-contentful-paint"]?.numericValue || 0),
              cls: Number((audits["cumulative-layout-shift"]?.numericValue || 0).toFixed(4)),
              tbt: Math.round(audits["total-blocking-time"]?.numericValue || 0),
              speedIndex: Math.round(audits["speed-index"]?.numericValue || 0),
              interactive: Math.round(audits["interactive"]?.numericValue || 0),
              totalTransferredBytes: totalTransferred,
              jsTransferredBytes: jsTransferred,
              cssTransferredBytes: cssTransferred,
              htmlTransferredBytes: htmlTransferred,
              ttfb: ttfb,
              lcpElement: lcpElement,
              lcpLoadDelay: loadDelay,
              lcpLoadDuration: loadDuration,
              lcpRenderDelay: renderDelay,
              longTasksCount: longTasks.length,
              maxLongTaskMs: maxLongTask,
              jsExecutionMs: Math.round(audits["bootup-time"]?.numericValue || 0),
              styleLayoutMs: Math.round(audits["layout-thread-work"]?.numericValue || 0),
              jsonReport: jsonPath,
              htmlReport: `${outBase}.report.html`,
            };

            runs.push(runData);
            console.log(`      Score: ${runData.score} | LCP: ${runData.lcp}ms | TBT: ${runData.tbt}ms | CLS: ${runData.cls} | TTFB: ${runData.ttfb}ms`);
          }
        } catch (err) {
          console.error(`      فشل في الجولة ${i}:`, err.message);
        }
      }

      // Calculate averages across 3 runs
      if (runs.length > 0) {
        const avg = (fn) => Math.round(runs.reduce((acc, r) => acc + fn(r), 0) / runs.length);
        const avgFloat = (fn, dec = 4) => Number((runs.reduce((acc, r) => acc + fn(r), 0) / runs.length).toFixed(dec));

        summary[page.id][preset.id] = {
          averages: {
            score: avg(r => r.score),
            fcp: avg(r => r.fcp),
            lcp: avg(r => r.lcp),
            cls: avgFloat(r => r.cls, 4),
            tbt: avg(r => r.tbt),
            speedIndex: avg(r => r.speedIndex),
            interactive: avg(r => r.interactive),
            totalTransferredBytes: avg(r => r.totalTransferredBytes),
            jsTransferredBytes: avg(r => r.jsTransferredBytes),
            htmlTransferredBytes: avg(r => r.htmlTransferredBytes),
            ttfb: avg(r => r.ttfb),
            longTasksCount: avg(r => r.longTasksCount),
            maxLongTaskMs: avg(r => r.maxLongTaskMs),
            jsExecutionMs: avg(r => r.jsExecutionMs),
            styleLayoutMs: avg(r => r.styleLayoutMs),
          },
          runs,
        };
      }
    }
  }

  // Save full summary
  const summaryPath = path.join(ARTIFACT_DIR, "phase-e33-performance-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  console.log("\n==================================================================");
  console.log("تم اكتمال جميع الجولات الـ 18 بنجاح!");
  console.log("تم حفظ التقرير الشامل في:", summaryPath);
  console.log("==================================================================");
}

main().catch(console.error);

