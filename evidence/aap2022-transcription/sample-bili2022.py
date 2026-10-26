#!/usr/bin/env python3
"""One-time sampler: AAP 2022 photo/exchange thresholds via the PediTools
bili2022 free API (values validated against CPG figures by Kemper+Newman
per the tool's own credits). A dummy bili=5 forces 1-decimal output.
Grid: h=1, 6..96/6h, 108..168/12h, 192..336/24h x GA 35..40 x risk none/any.
Polite: 0.4s between queries, 3 retries. Writes raw JSON (audit trail).
Use: python3 evidence/aap2022-transcription/sample-bili2022.py
"""
import json, re, time, urllib.request

UA = {"User-Agent": "KidGrow-research/1.0 (one-time guideline transcription, ~360 queries)"}
HOURS = [1] + list(range(6, 97, 6)) + list(range(108, 169, 12)) + list(range(192, 337, 24))
GAS = [35, 36, 37, 38, 39, 40]
RISKS = ["none", "any"]
TH = re.compile(r"(No|ANY) neurotoxicity risk factors\|+([\d.]+) mg/dL\|+([\d.]+) mg/dL")

def strip(h):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", h, flags=re.S)
    return re.sub(r"<[^>]+>", "|", t)

def query(ga, h, risk):
    url = f"https://peditools.org/bili2022/api/?ga={ga}&age={h}&bili=5&risk={risk}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
            m = TH.search(strip(html))
            if m:
                return float(m.group(2)), float(m.group(3))
            raise ValueError("no threshold row in response")
        except Exception as e:
            print(f"  retry {ga}/{h}/{risk} ({e})", flush=True)
            time.sleep(2)
    raise SystemExit(f"FAILED {ga}/{h}/{risk} after 3 tries")

rows = []
n = 0
for ga in GAS:
    for risk in RISKS:
        for h in HOURS:
            photo, exch = query(ga, h, risk)
            rows.append({"ga": ga, "risk": risk, "h": h, "photo": photo, "exch": exch})
            n += 1
            if n % 40 == 0:
                print(f"  {n}/360 ...", flush=True)
            time.sleep(0.4)

with open("evidence/aap2022-transcription/raw-samples.json", "w") as f:
    json.dump({"source": "https://peditools.org/bili2022/api/ (PediTools bili2022, J. Chou; validated vs Kemper et al, Pediatrics 2022;150(3):e2022058859)",
               "note": "dummy bili=5 forces 1-decimal display; thresholds only, no patient data",
               "grid": {"hours": HOURS, "ga": GAS, "risks": RISKS}, "rows": rows}, f, indent=1)
print(f"DONE: {len(rows)} rows")
