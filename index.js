// check-superb.js
import * as cheerio from "cheerio";
import iconv from "iconv-lite";

const URL =
  "https://euratec.mobile.bg/obiavi/avtomobili-dzhipove/skoda/superb/avtomatichna?extended=1";

function toAbsoluteUrl(href) {
  if (!href) return null;
  try {
    return new URL(href, URL).toString();
  } catch {
    return null;
  }
}

function extractCharsetFromContentType(contentType) {
  if (!contentType) return null;
  const m = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i);
  return m?.[1]?.trim()?.toLowerCase() ?? null;
}

function extractCharsetFromMeta(htmlAsciiLike) {
  const m1 = htmlAsciiLike.match(/<meta[^>]*charset\s*=\s*["']?([^"'>\s]+)/i);
  if (m1?.[1]) return m1[1].trim().toLowerCase();

  const m2 = htmlAsciiLike.match(/content\s*=\s*["'][^"']*charset\s*=\s*([^"';\s]+)/i);
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

  if (!iconv.encodingExists(charset)) {
    charset = "utf-8";
  }

  const html = iconv.decode(buf, charset);

  return html;
}

function parseListings(html) {
  const $ = cheerio.load(html);
  const nodes = $("div.zaglavie a.title");

  const listings = [];
  nodes.each((_, el) => {
    const a = $(el);
    const title = a.text().replace(/\s+/g, " ").trim();
    const href = a.attr("href")?.trim();

    if (!title || !href) return;

    listings.push({ title, url: href });
  });

  return listings;
}

async function getListings() {
  try {
    const html = await fetchHtmlWithCorrectEncoding(URL);
    const listings = parseListings(html);

    return listings;
  } catch (err) {
    console.error("Failed:", err?.message || err);
    process.exitCode = 1;
  }
}

async function main() {
  const listings = await getListings();
  console.log(listings);
}

main();
