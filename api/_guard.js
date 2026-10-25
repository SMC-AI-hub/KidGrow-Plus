// NeoKid Care — shared API guard (F11, v10.46): per-instance rate limiting,
// bounded body reads, input validators. Honest limit: the limiter is
// in-memory per serverless instance (a determined attacker can spread load
// across instances) — true distributed limiting needs Upstash (see docs).
"use strict";

const crypto = require("crypto");
// Per-instance salt (matches the per-instance limiter's honesty level):
// ipTag correlates abuse within a boot window but is useless for
// long-term tracking or reversal (unlike a raw or unsalted-hashed IP).
const IPTAG_SALT = crypto.randomBytes(16);

const buckets = new Map(); // key -> { n, reset }

function ipOf(req) {
  try {
    const f = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (f) return f.slice(0, 64);
    return ((req.socket && req.socket.remoteAddress) || "?").slice(0, 64);
  } catch (e) { return "?"; }
}

function ipTag(req) {
  try {
    const h = crypto.createHash("sha256");
    h.update(IPTAG_SALT); h.update(String(ipOf(req)));
    return h.digest("hex").slice(0, 12);
  } catch (e) { return "?"; }
}

function rateLimit(req, opts) {
  opts = opts || {};
  const windowMs = opts.windowMs || 60000, max = opts.max || 60;
  const key = (opts.prefix || "g") + "|" + ipOf(req);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.reset) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.n++;
  if (b.n > max) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  return { ok: true };
}

function limited(req, res, opts) {
  const r = rateLimit(req, opts);
  if (!r.ok) {
    try { res.setHeader("Retry-After", String(r.retryAfter)); } catch (e) {}
    res.status(429).json({ error: "Too many requests — slow down." });
    return true;
  }
  return false;
}

// Bounded raw-body read (for HMAC paths). Rejects oversized payloads.
function readRawCapped(req, maxBytes) {
  maxBytes = maxBytes || 262144;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, done = false;
    req.on("data", (c) => {
      if (done) return;
      size += c.length;
      if (size > maxBytes) { done = true; reject(new Error("payload too large")); return; }
      chunks.push(c);
    });
    req.on("end", () => { if (!done) { done = true; resolve(Buffer.concat(chunks)); } });
    req.on("error", (e) => { if (!done) { done = true; reject(e); } });
  });
}

function cleanStr(v, maxLen) {
  const s = String(v == null ? "" : v);
  return s.length > (maxLen || 256) ? s.slice(0, maxLen || 256) : s;
}
function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));
}
function isEmail(v) {
  return /^[^\s@]{1,64}@[^\s@]{1,128}\.[^\s@]{1,32}$/.test(String(v || ""));
}
function isTokenShape(v) {
  const s = String(v || ""); // Supabase JWTs are long dotted tokens; reject empties/garbage early
  return s.length >= 20 && s.length <= 4096 && /^[A-Za-z0-9\-_.]+$/.test(s);
}
function _resetForTests() { buckets.clear(); }

module.exports = { ipOf, ipTag, rateLimit, limited, readRawCapped, cleanStr, isUuid, isEmail, isTokenShape, _resetForTests };
