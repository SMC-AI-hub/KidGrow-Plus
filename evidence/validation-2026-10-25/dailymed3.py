#!/usr/bin/env python3
"""DailyMed SPL XML: pediatric Dosage & Administration for 6 F1 drugs."""
import json, re, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

UA = {'User-Agent': 'Mozilla/5.0 (clinical-validation-script)'}
NS = {'v3': 'urn:hl7-org:v3'}

def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def get_text(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read().decode('utf-8', 'replace')

def inner_text(el):
    return re.sub(r'\s+', ' ', ''.join(el.itertext())).strip()

# (query, name-must-contain, label-must-contain)
TARGETS = [  # rerun subset
    ('TYLENOL', 'CHILDRENS TYLENOL', 'SUSPENSION'),
    ('ZITHROMAX', 'ZITHROMAX', 'SUSPENSION'),
    ('ONDANSETRON', 'ONDANSETRON', 'TABLET'),
]
for q, want_name, want_lbl in TARGETS:
    print('=' * 110)
    print('TARGET:', want_name)
    try:
        names = get_json(f'https://dailymed.nlm.nih.gov/dailymed/services/v2/drugnames.json?drug_name={urllib.parse.quote(q)}')['data']
        cands = [n['drug_name'] for n in names if want_name in n['drug_name']]
        name = want_name if want_name in cands else next((c for c in cands if 'COLD' not in c and 'COUGH' not in c and 'FLU' not in c), (cands or [None])[0])
        if not name:
            print('  NO NAME'); continue
        spls = get_json(f'https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name={urllib.parse.quote(name)}')['data']
        lbl = next((s for s in spls if want_lbl in s.get('title', '')), spls[0])
        setid = lbl['setid']
        print('  label:', lbl['title'][:100], '| setid:', setid)
        xml = get_text(f'https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/{setid}.xml')
        root = ET.fromstring(xml)
        # LOINC 34068-7 = DOSAGE AND ADMINISTRATION
        found = None
        for sec in root.iter('{urn:hl7-org:v3}section'):
            code = sec.find('v3:code', NS)
            if code is not None and code.get('code') == '34068-7':
                found = sec
                break
        if found is None:
            titles = [inner_text(s.find('v3:title', NS))[:50] for s in root.iter('{urn:hl7-org:v3}section') if s.find('v3:title', NS) is not None]
            print('  NO DOSAGE SECTION; sections:', titles[:15])
            continue
        txt = inner_text(found.find('v3:text', NS)) if found.find('v3:text', NS) is not None else inner_text(found)
        print('  [DOSAGE AND ADMINISTRATION] chars:', len(txt))
        out = open(f'/tmp/dm_{q.lower()}.txt', 'w')
        out.write(f'LABEL: {lbl["title"]}\nSETID: {setid}\n\n{txt}\n')
        out.close()
        print('  saved /tmp/dm_' + q.lower() + '.txt')
        print('  ' + txt[:1800])
    except Exception as e:
        print('  ERROR:', type(e).__name__, e)
