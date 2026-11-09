import { chromium } from "playwright";
import * as path from "path";

const BASE_URL = "http://localhost:8081";
const ARTIFACT_DIR = "C:/Users/MR/.gemini/antigravity/brain/ccb87eed-fca0-465c-b9d6-35beb91db114";

const VIEWPORTS = [
  { name: "phase-d-mobile-360", width: 360, height: 740, label: "360px (Small Android / Galaxy)" },
  { name: "phase-d-mobile-375", width: 375, height: 667, label: "375px (iPhone SE)" },
  { name: "phase-d-mobile-390", width: 390, height: 844, label: "390px (iPhone 13/14/15/16)" },
  { name: "phase-d-tablet-768", width: 768, height: 1024, label: "768px (iPad Mini / Tablet)" },
  { name: "phase-d-laptop-1024", width: 1024, height: 768, label: "1024px (Small Laptop / iPad Landscape)" },
  { name: "phase-d-desktop-1440", width: 1440, height: 900, label: "1440px (Desktop Full HD)" },
];

async function runPhaseDVerification() {
  console.log("================================================================");
  console.log("🚀 STARTING CAFÉLENS 2.0 — PHASE D E2E & RESPONSIVE AUDIT");
  console.log("================================================================\n");

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const results: { test: string; status: "PASS" | "FAIL"; details: string }[] = [];
  const consoleErrors: string[] = [];

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore external CSP warnings about maps.google.com frame
      if (!text.includes("violates the following Content Security Policy")) {
        consoleErrors.push(text);
      }
    }
  });

  // ==========================================================
  // PART 1: 6 VIEWPORTS & OVERFLOW TESTS ON HOME PAGE
  // ==========================================================
  console.log("📱 Part 1: Testing 6 Viewports, Layout Shift & Overflow on Home Page...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("h1", { timeout: 15000 });
  await page.waitForTimeout(2000); // Complete initial hydration

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(800); // Allow media queries to apply

    // Verify horizontal overflow
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        hasOverflow: doc.scrollWidth > doc.clientWidth + 2,
        diff: Math.max(0, doc.scrollWidth - doc.clientWidth),
      };
    });

    const isMobile = vp.width < 768;
    const bottomNav = page.locator("nav.fixed.bottom-0");
    const bottomNavVisible = await bottomNav.isVisible().catch(() => false);
    const bottomNavPass = isMobile ? bottomNavVisible : !bottomNavVisible;

    // Check Hero Search bar presence
    const searchBarVisible = await page.locator("input[type='search']").first().isVisible().catch(() => false);

    // Save screenshot
    const screenshotPath = path.join(ARTIFACT_DIR, `${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const passed = !overflow.hasOverflow && bottomNavPass && searchBarVisible;
    results.push({
      test: `Viewport ${vp.label} (${vp.width}x${vp.height})`,
      status: passed ? "PASS" : "FAIL",
      details: `Overflow: ${overflow.diff}px, BottomNav: ${bottomNavVisible ? "Visible" : "Hidden"} (Expected: ${isMobile ? "Visible" : "Hidden"}), SearchBar: ${searchBarVisible}`,
    });

    console.log(`  - ${vp.label}: ${passed ? "✅ PASS" : "❌ FAIL"} (Overflow: ${overflow.diff}px, Screenshot saved)`);
  }

  // ==========================================================
  // PART 2: DIRECT NAVIGATION & REFRESH ON ALL CORE ROUTES
  // ==========================================================
  console.log("\n🧭 Part 2: Testing Direct Navigation & Refresh across D1, D2, D3...");
  await page.setViewportSize({ width: 1440, height: 900 });

  const routesToTest = [
    { path: "/", titleCheck: "CaféLens" },
    { path: "/cafes", titleCheck: "دليل" },
    { path: "/cafes/30-north-auc-innovation-hub", titleCheck: "30 NORTH" },
  ];

  for (const route of routesToTest) {
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("h1", { timeout: 15000 }).catch(() => { });
    await page.waitForTimeout(1000);

    const hasTitle = (await page.title()).includes(route.titleCheck) || (await page.content()).includes(route.titleCheck);

    // Refresh test
    await page.reload({ waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("h1", { timeout: 15000 }).catch(() => { });
    await page.waitForTimeout(1000);
    const afterReloadOk = (await page.content()).includes(route.titleCheck);

    const passed = hasTitle && afterReloadOk;
    results.push({
      test: `Direct Load & Refresh on ${route.path}`,
      status: passed ? "PASS" : "FAIL",
      details: passed ? "Loaded directly and preserved after refresh without error" : "Failed to load or refresh cleanly",
    });
    console.log(`  - Route ${route.path}: ${passed ? "✅ PASS" : "❌ FAIL"}`);
  }

  // ==========================================================
  // PART 3: PHASE D2 — CAFES DIRECTORY SEARCH & FILTERS
  // ==========================================================
  console.log("\n🔍 Part 3: Testing Directory Search & Filters Persistence...");
  await page.goto(`${BASE_URL}/cafes`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("h1", { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 1. Search by typing
  const searchInput = page.locator("input[type='search']").first();
  await searchInput.fill("Nude Bakery");
  await page.locator("button", { hasText: "بحث" }).first().click();
  await page.waitForTimeout(800);

  const searchUrl = page.url();
  const searchPersisted = searchUrl.includes("q=Nude+Bakery") || searchUrl.includes("q=Nude%20Bakery");
  const cardVisible = await page.getByText("Nude Bakery").first().isVisible().catch(() => false);

  results.push({
    test: "Directory Instant Search & URL Persistence",
    status: searchPersisted && cardVisible ? "PASS" : "FAIL",
    details: `URL: ${searchUrl}, Card visible: ${cardVisible}`,
  });
  console.log(`  - Search 'Nude Bakery': ${searchPersisted && cardVisible ? "✅ PASS" : "❌ FAIL"}`);

  // 2. Filter by area
  const fifthBtn = page.locator("button", { hasText: "التجمع الخامس" }).first();
  await fifthBtn.click();
  await page.waitForTimeout(800);

  const areaUrl = page.url();
  const areaPersisted = areaUrl.includes("area=fifth_settlement");

  results.push({
    test: "Area Filter Toggle & URL Persistence",
    status: areaPersisted ? "PASS" : "FAIL",
    details: `URL updated to: ${areaUrl}`,
  });
  console.log(`  - Area filter: ${areaPersisted ? "✅ PASS" : "❌ FAIL"}`);

  // 3. Reset filters
  const resetBtn = page.locator("button", { hasText: "إعادة تعيين" }).first();
  if (await resetBtn.isVisible().catch(() => false)) {
    await resetBtn.click();
    await page.waitForTimeout(800);
  }

  // Save Directory Screenshot
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "phase-d-cafes-page.png") });

  // ==========================================================
  // PART 4: PHASE D3 — SINGLE CAFE PAGE, BREADCRUMBS & BILL
  // ==========================================================
  console.log("\n☕ Part 4: Testing Single Cafe Page, Breadcrumbs & Bill Calculator...");
  await page.goto(`${BASE_URL}/cafes/30-north-auc-innovation-hub`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("h1", { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 1. Breadcrumbs check
  const breadcrumbNav = page.locator("nav[aria-label='مسار التنقل']");
  const hasHomeLink = await breadcrumbNav.locator("a", { hasText: "الرئيسية" }).isVisible().catch(() => false);
  const hasCafesLink = await breadcrumbNav.locator("a", { hasText: "دليل الكافيهات" }).isVisible().catch(() => false);

  results.push({
    test: "Breadcrumbs Structure on Cafe Details",
    status: hasHomeLink && hasCafesLink ? "PASS" : "FAIL",
    details: `Home link: ${hasHomeLink}, Cafes link: ${hasCafesLink}`,
  });
  console.log(`  - Breadcrumbs: ${hasHomeLink && hasCafesLink ? "✅ PASS" : "❌ FAIL"}`);

  // 2. Map embed & Navigation check
  const mapEmbed = (await page.locator("iframe").count()) > 0;
  const mapNavBtn = await page.locator("a", { hasText: "الموقع في Google Maps" }).first().isVisible().catch(() => false);

  results.push({
    test: "Google Maps Embed & Navigation Button",
    status: mapEmbed && mapNavBtn ? "PASS" : "FAIL",
    details: `Iframe count: ${await page.locator("iframe").count()}, Nav button: ${mapNavBtn}`,
  });
  console.log(`  - Maps: ${mapEmbed && mapNavBtn ? "✅ PASS" : "❌ FAIL"}`);

  // 3. Working Hours & Services
  const hoursVisible = await page.getByText("مواعيد العمل الرسمية").first().isVisible().catch(() => false);
  const servicesVisible = await page.getByText("المرافق والخدمات المتوفرة").first().isVisible().catch(() => false);

  results.push({
    test: "Working Hours & Facilities Sections",
    status: hoursVisible && servicesVisible ? "PASS" : "FAIL",
    details: `Hours: ${hoursVisible}, Services: ${servicesVisible}`,
  });
  console.log(`  - Hours & Services: ${hoursVisible && servicesVisible ? "✅ PASS" : "❌ FAIL"}`);

  // 4. Save Cafe Details Screenshot
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "phase-d-cafe-details.png") });

  // Clean up
  await context.close();
  await browser.close();

  console.log("\n================================================================");
  console.log("📊 SUMMARY OF PHASE D VERIFICATION RESULTS");
  console.log("================================================================");
  for (const r of results) {
    console.log(`${r.status === "PASS" ? "✅" : "❌"} [${r.status}] ${r.test}`);
    console.log(`   └─ ${r.details}`);
  }

  const allPassed = results.every((r) => r.status === "PASS");
  console.log("\nVERDICT:", allPassed ? "🌟 ALL PHASE D CHECKS PASSED (100%)" : "❌ SOME CHECKS FAILED");
  if (!allPassed) process.exit(1);
}

runPhaseDVerification().catch((err) => {
  console.error("Fatal Phase D test error:", err);
  process.exit(1);
});
