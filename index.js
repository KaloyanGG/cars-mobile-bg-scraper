import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import fs from "node:fs";
import path from "node:path";

const URL =
  "https://euratec.mobile.bg/obiavi/avtomobili-dzhipove/skoda/superb/avtomatichna?extended=1";

const STATE_PATH = path.join("state", "seen.json");
const NEW_PATH = path.join("state", "new.json");

function extractCharsetFromContentType(contentType) {
  if (!contentType) return null;
  const m = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i);
  return m?.[1]?.trim()?.toLowerCase() ?? null;
}

function extractCharsetFromMeta(htmlAsciiLike) {
  const m1 = htmlAsciiLike.match(/<meta[^>]*charset\s*=\s*["']?([^"'>\s]+)/i);
  if (m1?.[1]) return m1[1].trim().toLowerCase();

  const m2 = htmlAsciiLike.match(
    /content\s*=\s*["'][^"']*charset\s*=\s*([^"';\s]+)/i
  );
  if (m2?.[1]) return m2[1].trim().toLowerCase();

  return null;
}

async function fetchHtmlWithCorrectEncoding(url) {
  const res = await fetch(url);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${txt.slice(0, 300)}`);
  }

  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);

  const contentType = res.headers.get("content-type");
  let charset = extractCharsetFromContentType(contentType);

  if (!charset) {
    const headChunk = buf.slice(0, 4096).toString("latin1");
    charset = extractCharsetFromMeta(headChunk);
  }

  if (charset === "utf8") charset = "utf-8";
  if (charset === "win-1251") charset = "windows-1251";
  if (!charset) charset = "windows-1251";
  if (!iconv.encodingExists(charset)) charset = "utf-8";

  return iconv.decode(buf, charset);
}

function parseListings(html) {
  const $ = cheerio.load(html);
  const nodes = $("div.zaglavie a.title");

  const listings = [];
  nodes.each((_, el) => {
    const a = $(el);
    const title = a.text().replace(/\s+/g, " ").trim();
    const url = a.attr("href")?.trim();
    listings.push({ title, url });
  });

  return listings;
}

async function getListings() {
  const html = await fetchHtmlWithCorrectEncoding(URL);
  return parseListings(html);
}

function readSeen() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    return Array.isArray(data.seen) ? data.seen : [];
  } catch {
    return [];
  }
}

function writeSeen(seen) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify({ seen }, null, 2), "utf8");
}

// ✅ new: always write new.json for this run
function writeNewCars(newCars) {
  fs.mkdirSync(path.dirname(NEW_PATH), { recursive: true });
  fs.writeFileSync(NEW_PATH, JSON.stringify({ newCars }, null, 2), "utf8");
}

async function main() {
  const listings = await getListings();

  // optional but smart: ignore empty/undefined urls
  const cleanListings = listings.filter((l) => l?.url);

  const seen = readSeen();
  const seenSet = new Set(seen);

  const newCars = cleanListings.filter((l) => !seenSet.has(l.url));

  // ✅ important: overwrite state/new.json EVERY RUN
  writeNewCars(newCars);

  // update seen list
  writeSeen([...new Set([...seen, ...cleanListings.map((l) => l.url)])]);

  if (newCars.length === 0) {
    console.log("No new cars");
    process.exit(0);
  }

  console.log(`New cars: ${newCars.length}`);
  newCars.forEach((c) => console.log(c.url));

  // signal GitHub Actions
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
