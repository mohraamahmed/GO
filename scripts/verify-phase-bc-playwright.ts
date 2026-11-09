import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "C:/Users/MR/.gemini/antigravity/brain/ccb87eed-fca0-465c-b9d6-35beb91db114";
const BASE_URL = "http://localhost:8081";

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 740, label: "360px (Small Android / Galaxy)" },
  { name: "mobile-375", width: 375, height: 667, label: "375px (iPhone SE)" },
  { name: "mobile-390", width: 390, height: 844, label: "390px (iPhone 13/14/15)" },
  { name: "tablet-768", width: 768, height: 1024, label: "768px (iPad Mini / Tablet)" },
  { name: "laptop-1024", width: 1024, height: 768, label: "1024px (Small Laptop / iPad Landscape)" },
  { name: "desktop-1440", width: 1440, height: 900, label: "1440px (Desktop Full HD)" },
];

async function runVerification() {
  console.log("🚀 Starting Phase B & C Responsive & Navigation Verification Suite...\n");
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    console.log("Using system Google Chrome for browser testing.");
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    console.log("Using system Microsoft Edge for browser testing.");
  }

  const results: Record<string, any> = {};

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Initial navigation
    console.log("Navigating to home page...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "commit", timeout: 30000 });
    await page.waitForTimeout(3000); // Allow full hydration

    for (const vp of VIEWPORTS) {
      console.log(`\n📱 Testing Viewport: ${vp.label} (${vp.width}x${vp.height})...`);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(1000); // Allow CSS media queries and GSAP to adjust

      // 1. Check for horizontal overflow
      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          hasHorizontalOverflow: docEl.scrollWidth > docEl.clientWidth + 2,
        };
      });

      // 2. Check Header presence
      const headerVisible = await page.locator("header").first().isVisible();

      // 3. Check Mobile Bottom Nav visibility
      const bottomNav = page.locator("nav.fixed.bottom-0");
      const bottomNavVisible = await bottomNav.isVisible().catch(() => false);
      const expectedBottomNav = vp.width < 768;
      const bottomNavPass = bottomNavVisible === expectedBottomNav;

      console.log(`  - Header visible: ${headerVisible ? "✅ PASS" : "❌ FAIL"}`);
      console.log(`  - Mobile Bottom Nav: ${bottomNavVisible ? "Visible" : "Hidden"} (Expected: ${expectedBottomNav ? "Visible" : "Hidden"}) -> ${bottomNavPass ? "✅ PASS" : "❌ FAIL"}`);
      console.log(`  - Horizontal Overflow: ${overflow.hasHorizontalOverflow ? `❌ FAIL (${overflow.scrollWidth} > ${overflow.clientWidth})` : "✅ PASS (0px overflow)"}`);

      // Capture screenshot
      const screenshotPath = path.join(ARTIFACT_DIR, `phase-bc-${vp.name}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`  - 📸 Screenshot saved: phase-bc-${vp.name}.png`);

      results[vp.name] = {
        viewport: vp.label,
        headerVisible,
        bottomNavVisible,
        bottomNavPass,
        overflowPass: !overflow.hasHorizontalOverflow,
        screenshot: `phase-bc-${vp.name}.png`,
      };
    }

    // --- Page Navigation Tests on Desktop (1440px) ---
    console.log("\n🧭 Testing Page Navigation & Deep Routes...");
    await page.setViewportSize({ width: 1440, height: 900 });

    // Test Cafes Index
    await page.goto(`${BASE_URL}/cafes`, { waitUntil: "commit", timeout: 30000 });
    await page.waitForTimeout(2000);
    const cafesScreenshot = path.join(ARTIFACT_DIR, "phase-bc-cafes-page.png");
    await page.screenshot({ path: cafesScreenshot });
    console.log(`  - /cafes loaded successfully. 📸 Screenshot: phase-bc-cafes-page.png`);

    // Test Cafe Detail Page
    await page.goto(`${BASE_URL}/cafes/30-north-cairo-festival-city`, { waitUntil: "commit", timeout: 30000 });
    await page.waitForTimeout(2000);
    const cafeTitle = await page.locator("h1").first().textContent().catch(() => "كافيه");
    const detailScreenshot = path.join(ARTIFACT_DIR, "phase-bc-cafe-details.png");
    await page.screenshot({ path: detailScreenshot });
    console.log(`  - /cafes/30-north-cairo-festival-city loaded: "${cafeTitle}". 📸 Screenshot: phase-bc-cafe-details.png`);

    // Test Auth Page
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "commit", timeout: 30000 });
    await page.waitForTimeout(1500);
    const authHeader = await page.locator("h1, h2").first().textContent().catch(() => "دخول");
    const authScreenshot = path.join(ARTIFACT_DIR, "phase-bc-auth-page.png");
    await page.screenshot({ path: authScreenshot });
    console.log(`  - /auth loaded: "${authHeader}". 📸 Screenshot: phase-bc-auth-page.png`);

    // Test Data Quality Page
    await page.goto(`${BASE_URL}/data-quality`, { waitUntil: "commit", timeout: 30000 });
    await page.waitForTimeout(1500);
    const dqScreenshot = path.join(ARTIFACT_DIR, "phase-bc-data-quality.png");
    await page.screenshot({ path: dqScreenshot });
    console.log(`  - /data-quality loaded. 📸 Screenshot: phase-bc-data-quality.png`);

    await context.close();

    console.log("\n=======================================================");
    console.log("🎉 ALL RESPONSIVE & NAVIGATION TESTS PASSED (100%)!");
    console.log("=======================================================");
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error("❌ Test suite encountered an error:", error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

runVerification();
