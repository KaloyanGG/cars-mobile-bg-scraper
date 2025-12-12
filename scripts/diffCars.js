const fs = require("fs");
const path = require("path");

const STATE_PATH = path.join("state", "seen.json");
const NEW_PATH = path.join("state", "new.json");

function normalizeUrl(raw) {
  const u = new URL(raw);
  u.hash = "";
  ["utm_source","utm_medium","utm_campaign","fbclid","gclid"].forEach(p => u.searchParams.delete(p));
  return u.toString().replace(/\/$/, "");
}

function readSeen() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    return Array.isArray(data.seen) ? data.seen : [];
  } catch {
    return [];
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ✅ Replace this with YOUR existing function that returns full URLs
async function fetchCarUrls() {
  // return ["https://..."];
  throw new Error("Implement fetchCarUrls() by plugging in your current working logic.");
}

(async () => {
  const seen = readSeen();
  const seenSet = new Set(seen);

  const current = (await fetchCarUrls()).map(normalizeUrl);
  const newCars = current.filter(u => !seenSet.has(u));

  const updatedSeen = Array.from(new Set([...seen, ...current]));

  writeJson(STATE_PATH, { seen: updatedSeen });
  writeJson(NEW_PATH, { newCars });

  if (newCars.length === 0) {
    console.log("No new cars.");
    process.exit(0);
  }

  console.log(`New cars: ${newCars.length}`);
  newCars.forEach(u => console.log(u));

  // exit 2 => signal “new cars found”
  process.exit(2);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
