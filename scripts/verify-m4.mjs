// M4 runtime verification: confirm controls drive a debounced live recompute.
// Upload an 8-color image (KMeans -> 8 colors), then drag the Color-count (K)
// slider down to 4 via keyboard and assert the result recomputes to 4 colors.
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
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d");
  const colors = ["#e6194b","#3cb44b","#ffe119","#4363d8","#f58231","#911eb4","#46f0f0","#000000"];
  for (let i = 0; i < 8; i++) { ctx.fillStyle = colors[i]; ctx.fillRect(i * 32, 0, 32, 128); }
  return c.toDataURL("image/png");
});
const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
await page.setInputFiles('input[type=file]', { name: "bands.png", mimeType: "image/png", buffer });

const colorChip = () =>
  page.evaluate(() => {
    const c = [...document.querySelectorAll(".MuiChip-label")].find((e) => /colors$/.test(e.textContent));
    return c ? parseInt(c.textContent, 10) : NaN;
  });

// Wait for the first (K=8) result.
await page.waitForFunction(() => {
  const c = [...document.querySelectorAll(".MuiChip-label")].find((e) => /colors$/.test(e.textContent));
  return c && parseInt(c.textContent, 10) === 8;
}, { timeout: 90000 });
const before = await colorChip();

// Drive the Color-count (K) slider: first slider in the panel, 8 -> 4.
const kSlider = page.getByRole("slider").first();
await kSlider.focus();
for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft");

// Debounced recompute should land K=4 -> 4 colors.
await page.waitForFunction(() => {
  const c = [...document.querySelectorAll(".MuiChip-label")].find((e) => /colors$/.test(e.textContent));
  return c && parseInt(c.textContent, 10) === 4;
}, { timeout: 30000 }).catch(() => {});
const after = await colorChip();

const ok = before === 8 && after === 4;
console.log(`colors before=${before} after=${after}`);
if (errors.length) console.log("PAGE ERRORS:", errors.join("\n"));
await browser.close();
console.log(ok ? "VERIFY OK" : "VERIFY FAIL");
process.exit(ok ? 0 : 1);
