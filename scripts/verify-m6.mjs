// M6 runtime verification: presets apply, fixed-palette editor populates, and
// per-layer ZIP export contains one valid SVG per color. Requires dev on :3000.
import { chromium } from "playwright";
import JSZip from "jszip";

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
  const cs = ["#e6194b","#3cb44b","#ffe119","#4363d8","#f58231","#911eb4","#46f0f0","#000000"];
  for (let i = 0; i < 8; i++) { ctx.fillStyle = cs[i]; ctx.fillRect(i * 32, 0, 32, 128); }
  return c.toDataURL("image/png");
});
const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
await page.setInputFiles('input[type=file]', { name: "bands.png", mimeType: "image/png", buffer });

const waitColors = (k) => page.waitForFunction((kk) => {
  const c = [...document.querySelectorAll(".MuiChip-label")].find((e) => /colors$/.test(e.textContent));
  return c && parseInt(c.textContent, 10) === kk;
}, k, { timeout: 90000 });

await waitColors(8);
const settle = async () => { await page.keyboard.press("Escape").catch(() => {}); await page.waitForTimeout(250); };

// --- Fixed palette editor populates from current result ---
try {
  await page.getByRole("combobox", { name: /Palette mode/ }).click();
  await page.getByRole("option", { name: /Fixed palette/ }).click();
  await page.waitForTimeout(500);
  await page.locator("button", { hasText: /Use current/i }).click();
} catch (e) {
  await page.screenshot({ path: "scripts/m6-fail.png" });
  console.log("PALETTE STEP FAILED:", e.message);
  console.log("ERRORS:", errors.join("\n") || "(none)");
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(200);
const colorInputs = await page.locator('input[type="color"]').count();
await settle();

// --- Preset: Fast preview sets working res cap to 900 ---
await page.getByRole("button", { name: /Presets/ }).click();
await page.getByRole("menuitem", { name: /Fast preview/ }).click();
await page.waitForTimeout(400);
const presetApplied = await page.getByText(/Working res cap: 900 px/).count();
await settle();

// --- Per-layer ZIP export ---
await page.getByRole("button", { name: /more export options/ }).click();
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("menuitem", { name: /Per-layer ZIP/ }).click(),
]);
const chunks = [];
for await (const ch of await download.createReadStream()) chunks.push(ch);
const zip = await JSZip.loadAsync(Buffer.concat(chunks));
const files = Object.keys(zip.files);
let allSvg = files.length > 0;
for (const f of files) {
  const content = await zip.files[f].async("string");
  if (!content.startsWith("<svg") || !content.includes("<path")) allSvg = false;
}

// --- Caching: a cheap-param change (fill rule) reuses the expensive stages ---
await settle();
await page.getByRole("combobox", { name: /Fill rule/ }).click();
await page.getByRole("option", { name: /evenodd/ }).click();
let cachedSeen = false;
try {
  await page.waitForFunction(
    () => [...document.querySelectorAll(".MuiChip-label")].some((e) => /^cached$/.test(e.textContent || "")),
    { timeout: 30000 },
  );
  cachedSeen = true;
} catch { /* leave false */ }

const checks = {
  presetApplied: presetApplied > 0,
  zipHasLayers: files.length === 8 && allSvg,
  fixedPalettePopulated: colorInputs === 8,
  cachingWorks: cachedSeen,
};
const ok = Object.values(checks).every(Boolean);
console.log("ZIP files:", files.length, "| color inputs:", colorInputs);
console.log("CHECKS:", JSON.stringify(checks));
if (errors.length) console.log("PAGE ERRORS:", errors.join("\n"));
await browser.close();
console.log(ok ? "VERIFY OK" : "VERIFY FAIL");
process.exit(ok ? 0 : 1);
