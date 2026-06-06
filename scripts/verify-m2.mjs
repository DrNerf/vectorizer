// M2 runtime verification: drive the real app in Edge, upload a synthetic
// 8-color image, confirm the worker produced a quantized preview + a valid,
// downloadable SVG. Requires `npm run dev` already serving on :3000.
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:3000";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

page.setDefaultTimeout(90000);
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[type=file]', { state: "attached" });

// Generate an 8-band PNG in-page, then feed it through the real file input
// (setInputFiles fires the events React's onChange actually listens for).
const dataUrl = await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  const colors = ["#e6194b","#3cb44b","#ffe119","#4363d8","#f58231","#911eb4","#46f0f0","#000000"];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(i * 32, 0, 32, 128);
  }
  return c.toDataURL("image/png");
});
const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
await page.setInputFiles('input[type=file]', {
  name: "bands.png",
  mimeType: "image/png",
  buffer,
});

// Engine ran once the Download button enables (it loads opencv lazily first).
const downloadBtn = page.getByRole("button", { name: /download svg/i });
await downloadBtn.waitFor({ state: "visible" });
try {
  await page.waitForFunction(
    () => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /download svg/i.test(x.textContent || ""),
      );
      return b && !b.disabled;
    },
    { timeout: 90000 },
  );
} catch (e) {
  const diag = await page.evaluate(() => ({
    alerts: [...document.querySelectorAll(".MuiAlert-message")].map((x) => x.textContent),
    progress: [...document.querySelectorAll(".MuiTypography-caption")].map((x) => x.textContent),
    hasCanvas: !!document.querySelector("main canvas"),
    chips: [...document.querySelectorAll(".MuiChip-label")].map((x) => x.textContent),
  }));
  console.log("WAIT FAILED:", e.message);
  console.log("DIAG:", JSON.stringify(diag, null, 2));
  console.log("PAGE/CONSOLE ERRORS:", errors.join("\n") || "(none)");
  await browser.close();
  process.exit(1);
}

// Read the live stats chips.
const stats = await page.evaluate(() =>
  [...document.querySelectorAll(".MuiChip-label")].map((e) => e.textContent),
);

// Capture the actual downloaded SVG.
const [download] = await Promise.all([
  page.waitForEvent("download"),
  downloadBtn.click(),
]);
const stream = await download.createReadStream();
let svg = "";
for await (const chunk of stream) svg += chunk;

const pathCount = (svg.match(/<path/g) || []).length;
const ok =
  svg.startsWith("<svg") &&
  svg.includes("viewBox") &&
  pathCount > 0 &&
  svg.trim().endsWith("</svg>");

console.log("STATS:", stats.join(" | "));
console.log("SVG bytes:", svg.length, "| <path> count:", pathCount);
console.log("SVG head:", svg.slice(0, 120));
if (errors.length) console.log("PAGE ERRORS:", errors.join("\n"));

await browser.close();
console.log(ok ? "VERIFY OK" : "VERIFY FAIL");
process.exit(ok ? 0 : 1);
