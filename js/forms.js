/* NeoKid Care — form-template engine (Phase 1 infra).
   Schema-driven cards: Forms.render(schema, data, prefix) → HTML;
   Forms.collect(prefix, schema) → object. Types: text number date select
   multi check textarea. Mobile-first; all values escaped. */
function formsEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function formsRender(schema, data, pfx) {
  data = data || {}; pfx = pfx || "fx";
  const fs = (schema && schema.fields) || [];
  let h = "";
  for (const f of fs) {
    const id = pfx + "_" + f.k;
    const v = data[f.k];
    const lbl = `<label>${formsEsc(f.label)}${f.unit ? ` (${formsEsc(f.unit)})` : ""}${f.req ? " *" : ""}</label>`;
    if (f.t === "select") {
      h += `<div${f.full ? ' class="full"' : ""}>${lbl}<select id="${id}"><option value="">—</option>`
        + (f.opts || []).map((o) => `<option value="${formsEsc(o)}"${String(v) === String(o) ? " selected" : ""}>${formsEsc(o)}</option>`).join("") + `</select>`
        + (f.hint ? `<div class="hint">${formsEsc(f.hint)}</div>` : "") + `</div>`;
    } else if (f.t === "multi") {
      const sel = Array.isArray(v) ? v.map(String) : [];
      h += `<div class="full">${lbl}<div style="display:flex;flex-wrap:wrap;gap:6px 14px">`
        + (f.opts || []).map((o) => `<label style="font-weight:400;display:flex;gap:6px;align-items:center"><input type="checkbox" name="${id}" value="${formsEsc(o)}"${sel.includes(String(o)) ? " checked" : ""}>${formsEsc(o)}</label>`).join("")
        + `</div></div>`;
    } else if (f.t === "check") {
      h += `<div>${lbl}<label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" id="${id}"${v ? " checked" : ""}>${formsEsc(f.ph || "Yes")}</label></div>`;
    } else if (f.t === "textarea") {
      h += `<div class="full">${lbl}<textarea id="${id}" rows="${f.rows || 2}" placeholder="${formsEsc(f.ph || "")}">${formsEsc(v || "")}</textarea></div>`;
    } else if (f.t === "number") {
      h += `<div>${lbl}<input type="number" id="${id}" value="${v === "" || v == null ? "" : v}"${f.min != null ? ` min="${f.min}"` : ""}${f.max != null ? ` max="${f.max}"` : ""}${f.step ? ` step="${f.step}"` : ""} placeholder="${formsEsc(f.ph || "")}"></div>`;
    } else if (f.t === "date") {
      h += `<div>${lbl}<input type="date" id="${id}" value="${formsEsc(v || "")}"></div>`;
    } else {
      h += `<div${f.full ? ' class="full"' : ""}>${lbl}<input type="text" id="${id}" value="${formsEsc(v || "")}" placeholder="${formsEsc(f.ph || "")}"></div>`;
    }
  }
  return h;
}
function formsCollect(pfx, schema) {
  pfx = pfx || "fx";
  const out = {};
  const fs = (schema && schema.fields) || [];
  for (const f of fs) {
    const id = pfx + "_" + f.k;
    try {
      if (f.t === "multi") {
        out[f.k] = [...document.querySelectorAll(`input[name="${id}"]:checked`)].map((el) => el.value);
      } else if (f.t === "check") {
        const el = document.getElementById(id);
        out[f.k] = !!(el && el.checked);
      } else if (f.t === "number") {
        const el = document.getElementById(id);
        const raw = el ? String(el.value).trim() : "";
        out[f.k] = raw === "" ? "" : (isNaN(parseFloat(raw)) ? raw : parseFloat(raw));
      } else {
        const el = document.getElementById(id);
        out[f.k] = el ? el.value : "";
        if (typeof out[f.k] === "string" && f.t !== "textarea") out[f.k] = out[f.k].trim();
      }
    } catch (e) { out[f.k] = f.t === "multi" ? [] : ""; }
  }
  return out;
}
var Forms = { render: formsRender, collect: formsCollect };
try { if (typeof window !== "undefined" && window) window.Forms = Forms; } catch (e) {}
