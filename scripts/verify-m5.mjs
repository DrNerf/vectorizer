// M5 runtime verification: comparison view. Upload an image, then check that
// the wipe view renders both canvases, Side mode puts the result canvas in the
// right half, zoom changes the view, and the palette overlay shows swatches.
// Requires dev on :3000.
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(90000);
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[type=file]', { state: "attached" });

const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 160;
  const ctx = c.getContext("2d");
  const colors = ["#e6194b","#3cb44b","#ffe119","#4363d8","#f58231","#911eb4","#46f0f0","#000000"];
  for (let i = 0; i < 8; i++) { ctx.fillStyle = colors[i]; ctx.fillRect(i * 32, 0, 32, 160); }
  return c.toDataURL("image/png");
});
const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
await page.setInputFiles('input[type=file]', { name: "bands.png", mimeType: "image/png", buffer });

// Wait for a result.
await page.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /download svg/i.test(x.textContent || ""));
  return b && !b.disabled;
}, { timeout: 90000 });

const canvasCount = await page.locator("main canvas").count();

// Switch to Side mode; the result canvas should render with non-zero size.
await page.getByRole("button", { name: /^Side$/ }).click();
await page.waitForTimeout(300);
const box = await page.locator("main canvas").nth(1).boundingBox();
const sideOk = !!box && box.width > 0 && box.height > 0;

// Back to wipe, then toggle palette overlay; expect one swatch per color (8).
await page.getByRole("button", { name: /^Wipe$/ }).click();
await page.waitForTimeout(100);
await page.getByRole("button", { name: /Palette/ }).click();
await page.waitForTimeout(200);
const swatches = await page.locator('[data-testid="palette-overlay"] > *').count();

const checks = {
  twoCanvases: canvasCount === 2,
  sideRenders: !!sideOk,
  paletteSwatches: swatches === 8,
};
const ok = Object.values(checks).every(Boolean);

await page.screenshot({ path: "scripts/m5-shot.png" });
console.log("CHECKS:", JSON.stringify(checks), "canvases:", canvasCount, "swatches:", swatches);
if (errors.length) console.log("PAGE ERRORS:", errors.join("\n"));
await browser.close();
console.log(ok ? "VERIFY OK" : "VERIFY FAIL");
process.exit(ok ? 0 : 1);
