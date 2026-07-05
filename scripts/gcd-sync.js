#!/usr/bin/env node
/**
 * GCD Auto-Sync
 * =============
 * Downloads the latest Grand Comics Database dump and re-imports it
 * only when a newer version is available.
 *
 * Usage:
 *   node scripts/gcd-sync.js            # check + download if needed
 *   node scripts/gcd-sync.js --force    # always re-download + import
 *   node scripts/gcd-sync.js --check    # check only, don't download
 *
 * Credentials (add to .env.local):
 *   GCD_USERNAME=your@email.com
 *   GCD_PASSWORD=yourpassword
 *
 * GCD dumps are released monthly. Running this weekly is fine — the check
 * is a lightweight HEAD request; a full download only happens when the
 * dump date on comics.org is newer than the last one we imported.
 *
 * State is stored in data/gcd-meta.json.
 */

const fs   = require("fs");
const path = require("path");
const https = require("https");
const http  = require("http");
const zlib  = require("zlib");
const { execSync } = require("child_process");

/* ── Paths ─────────────────────────────────────────────────── */

const ROOT      = path.join(__dirname, "..");
const DATA_DIR  = path.join(ROOT, "data");
const META_FILE = path.join(DATA_DIR, "gcd-meta.json");
const DB_FILE   = path.join(DATA_DIR, "gcd.db");

/* ── Config from env ────────────────────────────────────────── */

require("dotenv").config({ path: path.join(ROOT, ".env.local") });

const GCD_USERNAME = process.env.GCD_USERNAME ?? "";
const GCD_PASSWORD = process.env.GCD_PASSWORD ?? "";

const FORCE  = process.argv.includes("--force");
const CHECK  = process.argv.includes("--check");

/* ── Logging ────────────────────────────────────────────────── */

const log  = (...a) => console.log("[gcd-sync]", ...a);
const warn = (...a) => console.warn("[gcd-sync] ⚠", ...a);
const ok   = (...a) => console.log("[gcd-sync] ✓", ...a);

/* ── HTTP helpers ───────────────────────────────────────────── */

/**
 * Tiny cookie jar — stores Set-Cookie values and re-sends them as Cookie.
 */
class CookieJar {
  constructor() { this._jar = {}; }

  ingest(headers) {
    const raw = headers["set-cookie"] ?? [];
    for (const line of raw) {
      const [kv] = line.split(";");
      const eqIdx = kv.indexOf("=");
      if (eqIdx < 1) continue;
      const k = kv.slice(0, eqIdx).trim();
      const v = kv.slice(eqIdx + 1).trim();
      if (k) this._jar[k] = v;
    }
  }

  header() {
    return Object.entries(this._jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  get(name) { return this._jar[name]; }
}

const jar = new CookieJar();

/** Promisified HTTP/HTTPS request. Returns { statusCode, headers, body }. */
function request(urlStr, opts = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url    = new URL(urlStr);
    const mod    = url.protocol === "https:" ? https : http;
    const cookie = jar.header();

    const options = {
      hostname : url.hostname,
      port     : url.port || (url.protocol === "https:" ? 443 : 80),
      path     : url.pathname + url.search,
      method   : opts.method ?? "GET",
      headers  : {
        "User-Agent"  : "Mozilla/5.0 (compatible; VLTDComicSync/1.0; +https://vaultd.app)",
        "Accept"      : "text/html,application/xhtml+xml,*/*;q=0.8",
        "Cookie"      : cookie,
        ...(opts.headers ?? {}),
      },
    };

    const chunks = [];
    const req = mod.request(options, (res) => {
      jar.ingest(res.headers);

      // Follow redirects (up to 5)
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error("Redirect with no Location"));
        const next = loc.startsWith("http") ? loc : `${url.origin}${loc}`;
        return resolve(request(next, opts));
      }

      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({
        statusCode : res.statusCode,
        headers    : res.headers,
        body       : Buffer.concat(chunks).toString("utf-8"),
      }));
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Stream a file download to disk, showing progress. */
function streamDownload(urlStr, destPath) {
  return new Promise((resolve, reject) => {
    const url  = new URL(urlStr);
    const mod  = url.protocol === "https:" ? https : http;
    const cookie = jar.header();

    const options = {
      hostname : url.hostname,
      port     : url.port || 443,
      path     : url.pathname + url.search,
      method   : "GET",
      headers  : {
        "User-Agent" : "Mozilla/5.0 (compatible; VLTDComicSync/1.0)",
        "Cookie"     : cookie,
      },
    };

    const doRequest = (opts) => {
      mod.get(opts, (res) => {
        jar.ingest(res.headers);

        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const loc = res.headers.location;
          const next = new URL(loc.startsWith("http") ? loc : `${url.origin}${loc}`);
          return doRequest({
            ...opts,
            hostname : next.hostname,
            path     : next.pathname + next.search,
          });
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} downloading dump`));
        }

        const total   = parseInt(res.headers["content-length"] ?? "0", 10);
        let downloaded = 0;
        let lastPct   = -1;

        const out = fs.createWriteStream(destPath);
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const pct = Math.floor((downloaded / total) * 100);
            if (pct !== lastPct && pct % 5 === 0) {
              process.stdout.write(
                `\r  Downloading… ${pct}% (${(downloaded / 1e6).toFixed(0)} MB / ${(total / 1e6).toFixed(0)} MB)`
              );
              lastPct = pct;
            }
          }
          out.write(chunk);
        });
        res.on("end", () => { out.end(); console.log(); resolve(); });
        res.on("error", (e) => { out.destroy(); reject(e); });
      }).on("error", reject);
    };

    doRequest(options);
  });
}

/* ── GCD auth ───────────────────────────────────────────────── */

/**
 * Extract CSRF token — tries multiple strategies:
 * 1. Django's csrftoken cookie (set automatically on GET)
 * 2. Hidden input field (various attribute orderings)
 * 3. Meta tag (some Django setups)
 */
function extractCsrf(html) {
  // Strategy 1: cookie (most reliable — Django always sets this)
  const fromCookie = jar.get("csrftoken");
  if (fromCookie) return fromCookie;

  // Strategy 2: hidden input — handles any attribute order
  // <input ... name="csrfmiddlewaretoken" ... value="TOKEN" ...>
  // <input ... value="TOKEN" ... name="csrfmiddlewaretoken" ...>
  const inputMatch =
    html.match(/name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["']/) ||
    html.match(/value=["']([^"']+)["'][^>]*name=["']csrfmiddlewaretoken["']/) ||
    html.match(/csrfmiddlewaretoken["']\s[^>]*value=["']([^"']+)["']/);
  if (inputMatch) return inputMatch[1];

  // Strategy 3: meta tag
  const metaMatch = html.match(/<meta[^>]+name=["']csrf[^"']*["'][^>]+content=["']([^"']+)["']/i);
  if (metaMatch) return metaMatch[1];

  return null;
}

async function login() {
  if (!GCD_USERNAME || !GCD_PASSWORD) {
    throw new Error(
      "GCD_USERNAME and GCD_PASSWORD must be set in .env.local\n" +
      "Register at https://www.comics.org/accounts/register/"
    );
  }

  log("Logging in to comics.org…");

  // 1. GET login page — Django sets csrftoken cookie on this request
  const loginPage = await request("https://www.comics.org/accounts/login/");

  const csrf = extractCsrf(loginPage.body);
  if (!csrf) {
    // Dump a snippet to help diagnose if the page structure changed
    const snippet = loginPage.body.slice(0, 1000).replace(/\s+/g, " ");
    warn("Login page snippet:", snippet);
    throw new Error(
      "Could not find CSRF token — comics.org login page may have changed structure.\n" +
      "Check the snippet above and update extractCsrf() in scripts/gcd-sync.js."
    );
  }

  log("CSRF token obtained.");

  // 2. POST credentials
  const formData = new URLSearchParams({
    csrfmiddlewaretoken : csrf,
    username            : GCD_USERNAME,
    password            : GCD_PASSWORD,
    next                : "/download/",
  }).toString();

  const loginRes = await request("https://www.comics.org/accounts/login/", {
    method  : "POST",
    headers : {
      "Content-Type" : "application/x-www-form-urlencoded",
      "Referer"      : "https://www.comics.org/accounts/login/",
      "Origin"       : "https://www.comics.org",
    },
  }, formData);

  // Success: redirected away from login page, or arrived at download/home
  const body = loginRes.body ?? "";
  const landed = loginRes.statusCode;
  if (landed === 200 && (body.includes("id_username") || body.includes("Log in"))) {
    throw new Error(
      "Login failed — credentials rejected by comics.org.\n" +
      "Double-check GCD_USERNAME / GCD_PASSWORD in .env.local."
    );
  }

  ok("Authenticated with comics.org");
}

/* ── Dump discovery ─────────────────────────────────────────── */

/**
 * Fetches the /download/ page and extracts all dump links.
 * Returns an array sorted newest-first:
 *   [{ date: "2025-06-01", url: "https://..." }, ...]
 */
async function fetchDumpList() {
  const res = await request("https://www.comics.org/download/");
  if (res.statusCode !== 200) {
    throw new Error(`/download/ returned HTTP ${res.statusCode} — are you logged in?`);
  }

  // Links look like:
  //   href="/media/export/2025-06-01.tar.gz"   (or .zip)
  const matches = [...res.body.matchAll(/href="([^"]*\/(\d{4}-\d{2}-\d{2})[^"]*\.(tar\.gz|zip))"/g)];
  if (matches.length === 0) {
    throw new Error("No dump links found on /download/ — page format may have changed");
  }

  const dumps = matches.map((m) => ({
    date : m[2],
    url  : m[1].startsWith("http") ? m[1] : `https://www.comics.org${m[1]}`,
    ext  : m[3],
  }));

  // Sort newest first
  dumps.sort((a, b) => b.date.localeCompare(a.date));
  return dumps;
}

/* ── Metadata ───────────────────────────────────────────────── */

function readMeta() {
  if (!fs.existsSync(META_FILE)) return { importedDate: null, importedAt: null };
  try { return JSON.parse(fs.readFileSync(META_FILE, "utf-8")); }
  catch { return { importedDate: null, importedAt: null }; }
}

function writeMeta(meta) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2) + "\n");
}

/* ── Main ───────────────────────────────────────────────────── */

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const meta = readMeta();
  log("Last imported dump:", meta.importedDate ?? "none");

  // Step 1: authenticate
  await login();

  // Step 2: find latest dump
  log("Checking for latest dump on comics.org…");
  const dumps = await fetchDumpList();
  const latest = dumps[0];
  log(`Latest available: ${latest.date} (${latest.url})`);

  if (CHECK) {
    if (meta.importedDate && meta.importedDate >= latest.date) {
      ok("Already up to date.");
    } else {
      log(`New dump available: ${latest.date} (current: ${meta.importedDate ?? "none"})`);
    }
    return;
  }

  // Step 3: decide whether to download
  if (!FORCE && meta.importedDate && meta.importedDate >= latest.date) {
    ok(`Already on the latest dump (${latest.date}). Use --force to re-import.`);
    return;
  }

  // Step 4: download
  const dumpFileName = `${latest.date}.${latest.ext}`;
  const dumpPath     = path.join(DATA_DIR, dumpFileName);

  if (fs.existsSync(dumpPath) && !FORCE) {
    log(`Dump already downloaded at ${dumpPath}, skipping download.`);
  } else {
    log(`Downloading ${latest.date} dump (~400-600 MB)…`);
    await streamDownload(latest.url, dumpPath);
    ok(`Downloaded to ${dumpPath}`);
  }

  // Step 5: import
  log("Running gcd-import.js…");
  const importScript = path.join(__dirname, "gcd-import.js");
  execSync(`node "${importScript}" "${dumpPath}"`, {
    stdio : "inherit",
    cwd   : ROOT,
  });

  // Step 6: cleanup old dump files (keep only the one we just imported)
  const allDumps = fs.readdirSync(DATA_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.(tar\.gz|zip)$/.test(f))
    .filter((f) => f !== dumpFileName);
  for (const old of allDumps) {
    fs.rmSync(path.join(DATA_DIR, old));
    log(`Removed old dump: ${old}`);
  }

  // Step 7: update metadata
  writeMeta({
    importedDate : latest.date,
    importedAt   : new Date().toISOString(),
    sourceUrl    : latest.url,
    dbSize       : fs.existsSync(DB_FILE)
      ? `${(fs.statSync(DB_FILE).size / 1e9).toFixed(2)} GB`
      : "unknown",
  });

  ok(`GCD database updated to ${latest.date}`);
  log(`DB: ${DB_FILE}`);
}

main().catch((err) => {
  console.error("\n[gcd-sync] ERROR:", err.message);
  process.exit(1);
});
