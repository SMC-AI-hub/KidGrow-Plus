#!/usr/bin/env python3
"""Strict validator: app IG tables vs official INTERGROWTH-21st z-score table PDFs."""
import json, re
import pdfplumber

REPO = '/home/user/kidgrow-pro'
src = open(f'{REPO}/js/cdata.gen.js').read()
start = src.index('var KGCONTENT = ') + len('var KGCONTENT = ')
depth = 0
instr = False
esc = False
for j in range(start, len(src)):
    c = src[j]
    if instr:
        if esc:
            esc = False
        elif c == '\\':
            esc = True
        elif c == '"':
            instr = False
    else:
        if c == '"':
            instr = True
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                end = j + 1
                break
ig = json.loads(src[start:end])['intergrowth']
print('IG version:', ig.get('version'), '| verification:', ig.get('verification'))

PAIRS = [('nbT', 'nb', 231, 300), ('vp', 'vp', 168, 230)]
MEAS = [('bw', 'bw', 0.005), ('lt', 'lt', 0.05), ('hc', 'hc', 0.05)]
SEX = [('boys', 'boys'), ('girls', 'girls')]

row_re = re.compile(r'^(\d{2})\+(\d)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)', re.M)

total_cells = 0
total_flag = 0
for prefix, band, lo, hi in PAIRS:
    for mfile, mapp, tol in MEAS:
        for sfile, sapp in SEX:
            pdf = pdfplumber.open(f'/tmp/ig/{prefix}_{sfile}_{mfile}.pdf')
            text = '\n'.join((pg.extract_text() or '') for pg in pdf.pages)
            rows = row_re.findall(text)
            T = ig['tables'][mapp][sapp]
            n = 0
            maxd = (0, None)
            flags = []
            for r in rows:
                ga = int(r[0]) * 7 + int(r[1])
                if not (lo <= ga <= hi):
                    continue
                off = [float(v) for v in r[2:9]]
                key = str(ga)
                if key not in T:
                    flags.append((ga, 'MISSING-IN-APP'))
                    continue
                app = T[key]
                n += 1
                for zi, (a, o) in enumerate(zip(app, off)):
                    d = abs(a - o)
                    total_cells += 1
                    if d > maxd[0]:
                        maxd = (d, (ga, zi - 3))
                    if d > tol:
                        total_flag += 1
                        flags.append((ga, zi - 3, a, o))
            # coverage check: every app GA in band present in PDF?
            app_gas = sorted(int(k) for k in T.keys() if lo <= int(k) <= hi)
            pdf_gas = sorted(int(r[0]) * 7 + int(r[1]) for r in rows if lo <= int(r[0]) * 7 + int(r[1]) <= hi)
            missing = [g for g in app_gas if g not in pdf_gas]
            extra = [g for g in pdf_gas if g not in app_gas]
            status = 'ok' if not flags and not missing and not extra else 'FLAG'
            print(f'{band}/{mapp}/{sapp}: pdf_rows={len(rows)} matched={n} max|d|={maxd[0]:.4f}@{maxd[1]} '
                  f'tol={tol} missing={missing[:5]} extra={extra[:5]} nflags={len(flags)} [{status}]')
            for f in flags[:6]:
                print('   FLAG:', f)
print(f'TOTAL cells compared: {total_cells}, flags: {total_flag}')
