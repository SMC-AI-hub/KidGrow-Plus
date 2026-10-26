// NeoKid Care — client error beacon (F17, v10.46). POST-only, strictly shaped,
// no-PHI by construction: the client sends page + error name/message only
// (no stacks, no patient data, no free text beyond 200 chars). Entries land in
// host logs (Vercel); wire Sentry/Datadog later without client changes.
"use strict";

const G = require("./_guard");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    if (G.limited(req, res, { prefix: "err", max: 30 })) return;
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!body || typeof body !== "object") return res.status(400).json({ error: "bad shape" });
    const page = G.cleanStr(body.page, 64), msg = G.cleanStr(body.msg, 200), ver = G.cleanStr(body.ver, 16);
    if (!page || !msg) return res.status(400).json({ error: "bad shape" });
    if (!/^[a-z0-9\-_#]+$/i.test(page)) return res.status(400).json({ error: "bad shape" });
    try { console.log(JSON.stringify({ svc: "kidgrow-err", t: new Date().toISOString(), ipTag: G.ipTag(req), page, ver, msg })); } catch (e) {}
    return res.status(204).json({});
  } catch (e) {
    return res.status(500).json({ error: "beacon failed" });
  }
};
