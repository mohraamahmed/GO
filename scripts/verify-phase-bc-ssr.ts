import { chromium } from "playwright";

const BASE_URL = "http://localhost:8081";

async function runSsrAndHydrationAudit() {
  console.log("================================================================");
  console.log("⚡ PHASE B & C SSR, HYDRATION & GLOBAL MODALS VERIFICATION");
  console.log("================================================================\n");

  const results: { test: string; status: "PASS" | "FAIL"; details: string }[] = [];

  // 1. Direct SSR Fetch (Zero Browser APIs in SSR test)
  console.log("📡 1. Testing direct SSR HTTP rendering across routes...");
  const routesToTest = ["/", "/cafes", "/auth", "/data-quality"];
  for (const route of routesToTest) {
    try {
      const res = await fetch(`${BASE_URL}${route}`);
      const text = await res.text();
      const is200 = res.status === 200;
      const hasHtml = text.includes("<html") && text.includes("dir=\"rtl\"");
      const hasBrand = text.includes("CaféLens");

      if (is200 && hasHtml && hasBrand) {
        results.push({
          test: `SSR Direct Fetch ${route}`,
          status: "PASS",
          details: `Status 200, valid RTL HTML rendered (${text.length} bytes)`,
        });
        console.log(`  - SSR ${route}: ✅ 200 OK (${text.length} bytes)`);
      } else {
        results.push({
          test: `SSR Direct Fetch ${route}`,
          status: "FAIL",
          details: `Status: ${res.status}, hasHtml: ${hasHtml}, hasBrand: ${hasBrand}`,
        });
      }
    } catch (err: any) {
      results.push({
        test: `SSR Direct Fetch ${route}`,
        status: "FAIL",
        details: err?.message || String(err),
      });
    }
  }

  // 2. Playwright Client-Side Hydration & Console Error Monitoring
  console.log("\n🖥️  2. Testing Client Hydration & Console Logs...");
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const hydrationErrors: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") {
      consoleErrors.push(text);
      if (text.toLowerCase().includes("hydration") || text.toLowerCase().includes("did not match")) {
        hydrationErrors.push(text);
      }
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
    if (err.message.toLowerCase().includes("hydration")) {
      hydrationErrors.push(err.message);
    }
  });

  await page.goto(`${BASE_URL}/`, { waitUntil: "commit" });
  await page.waitForTimeout(2500); // Allow full React 19 hydration and initial render

  results.push({
    test: "Hydration Error Detection (React 19 mismatch check)",
    status: hydrationErrors.length === 0 ? "PASS" : "FAIL",
    details: hydrationErrors.length === 0
      ? "Zero hydration mismatches detected during page load and hydration"
      : `Hydration errors detected: ${hydrationErrors.join(", ")}`,
  });

  // 3. Testing Global Modals Functionality from Header
  console.log("\n🪟 3. Testing Global Modals (Favorites, Compare, Subscription)...");

  // A. Subscription Modal Trigger
  const subBtn = page.getByRole("button", { name: "باقات الاشتراك" });
  await subBtn.click();
  await page.waitForTimeout(600);

  const dialogLocator = page.getByRole("dialog");
  const isSubModalOpen = await dialogLocator.isVisible().catch(() => false);
  const vodafoneCashNumberVisible = await page.getByText("01005209667").first().isVisible().catch(() => false);

  results.push({
    test: "Global Subscription Modal Trigger & Vodafone Cash Number",
    status: isSubModalOpen && vodafoneCashNumberVisible ? "PASS" : "FAIL",
    details: isSubModalOpen && vodafoneCashNumberVisible
      ? "Subscription Modal opened cleanly, official payment number 01005209667 is visible"
      : `Modal open: ${isSubModalOpen}, Number visible: ${vodafoneCashNumberVisible}`,
  });

  // Close modal and wait for backdrop to disappear
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // B. Favorites Drawer Trigger
  const favBtn = page.locator("header").locator("button", { hasText: "المفضلة" }).first();
  await favBtn.click();
  await page.waitForTimeout(600);
  const favDrawerTitle = page.getByText(/المفضلة وخططي|المفضلة والخطط المحفوظة|الكافيهات المفضلة/i).first();
  const isFavDrawerOpen = await favDrawerTitle.isVisible().catch(() => false);

  results.push({
    test: "Global Favorites Drawer Trigger",
    status: isFavDrawerOpen ? "PASS" : "FAIL",
    details: isFavDrawerOpen ? "Favorites Drawer opened cleanly across global shell" : "Favorites drawer failed to open",
  });

  // Close drawer by pressing Escape and ensure it hides
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // C. Comparison Modal Trigger
  const compareBtn = page.locator("header").locator("button", { hasText: "المقارنة" }).first();
  await compareBtn.click();
  await page.waitForTimeout(600);
  const compareModalTitle = page.getByText(/مقارنة الكافيهات/i).first();
  const isCompareOpen = await compareModalTitle.isVisible().catch(() => false);

  results.push({
    test: "Global Cafe Comparison Modal Trigger",
    status: isCompareOpen ? "PASS" : "FAIL",
    details: isCompareOpen ? "Comparison Modal opened cleanly across global shell" : "Comparison modal failed to open",
  });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // 4. Reactive Counter Updates in Header
  console.log("\n🔢 4. Testing Reactive Counter Synchronization in Header...");
  await page.evaluate(() => {
    localStorage.setItem("cafelens_favorites", JSON.stringify(["cafe-test-1", "cafe-test-2"]));
    window.dispatchEvent(new CustomEvent("cafelens_storage_update", { detail: { key: "cafelens_favorites" } }));
  });
  await page.waitForTimeout(500);

  const favCountBadge = await page.locator("button", { hasText: "المفضلة" }).locator("span").getByText("2").first().isVisible().catch(() => false);

  results.push({
    test: "Reactive Counter Update on Storage Event",
    status: favCountBadge ? "PASS" : "FAIL",
    details: favCountBadge
      ? "Header badge instantly reflected updated favorite count (2 items)"
      : "Badge failed to update reactively",
  });

  // Clean test localStorage
  await page.evaluate(() => {
    localStorage.removeItem("cafelens_favorites");
    window.dispatchEvent(new CustomEvent("cafelens_storage_update", { detail: { key: "cafelens_favorites" } }));
  });

  await context.close();
  await browser.close();

  console.log("\n================================================================");
  console.log("📊 SSR, HYDRATION & MODALS AUDIT SUMMARY");
  console.log("================================================================");
  for (const r of results) {
    console.log(`${r.status === "PASS" ? "✅" : "❌"} [${r.status}] ${r.test}`);
    console.log(`   └─ ${r.details}`);
  }

  const allPassed = results.every((r) => r.status === "PASS");
  console.log("\nVERDICT:", allPassed ? "🌟 ALL SSR & HYDRATION CHECKS PASSED (100%)" : "❌ SOME CHECKS FAILED");
  if (!allPassed) process.exit(1);
}

runSsrAndHydrationAudit().catch((err) => {
  console.error("Fatal SSR audit error:", err);
  process.exit(1);
});
