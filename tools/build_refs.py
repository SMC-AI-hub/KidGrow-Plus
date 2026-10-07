"""Build exact growth-reference JS files from official sources.
Sources:
  WHO 0-5y : WorldHealthOrganization/anthro data-raw (igrowup tables, daily LMS)
  CDC 2-20y: cdc.gov/growthcharts/data/zscore/*.csv
  Fenton 22-50w PMA: weekly P3/P10/P50/P90/P97 (transcribed from Fenton 2013 via
             peditools; exact 2013 LMS are license-only) -> LMS fitted per week.
"""
import csv, json, math, re, sys

OUT = '/home/user/kidgrow-pro/js'
TMP = '/tmp/gref'
Z = {'p3':-1.8807936,'p10':-1.2815516,'p50':0.0,'p90':1.2815516,'p97':1.8807936}

def lms_val(M,S,L,z):
    if L == 0: return M*math.exp(S*z)
    b = 1+L*S*z
    return M*(b**(1/L)) if b > 0 else float('nan')

def write_js(path, varname, obj, header):
    with open(path,'w') as f:
        f.write(header + '\nconst %s = ' % varname + json.dumps(obj, separators=(',',':')) + ';\n')
    print(f'wrote {path} ({len(json.dumps(obj))//1024} KB json)')

# ---------------- WHO ----------------
def load_who_age(fname):
    d = {'1':{'age':[],'L':[],'M':[],'S':[]},'2':{'age':[],'L':[],'M':[],'S':[]}}
    with open(f'{TMP}/who/{fname}.txt', encoding='utf-8-sig') as f:
        for r in csv.DictReader(f, delimiter='\t'):
            s = r['sex'].strip()
            d[s]['age'].append(round(float(r['age']),2))
            d[s]['L'].append(round(float(r['l']),6))
            d[s]['M'].append(round(float(r['m']),5))
            d[s]['S'].append(round(float(r['s']),6))
    return {'b':d['1'],'g':d['2']}

def load_who_len(fname):
    d = {'1':{'x':[],'L':[],'M':[],'S':[]},'2':{'x':[],'L':[],'M':[],'S':[]}}
    with open(f'{TMP}/who/{fname}.txt', encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f, delimiter='\t'))
    xcol = [c for c in rows[0].keys() if c.strip() in ('length','height')][0]
    for r in rows:
        x = float(r[xcol])
        if abs(x*2 - round(x*2)) > 1e-6:  # keep 0.5 cm steps
            continue
        s = r['sex'].strip()
        d[s]['x'].append(round(x,1)); d[s]['L'].append(round(float(r['l']),6))
        d[s]['M'].append(round(float(r['m']),5)); d[s]['S'].append(round(float(r['s']),6))
    return {'b':d['1'],'g':d['2']}

who = {
    'wfa': load_who_age('weianthro'),
    'lhfa': load_who_age('lenanthro'),
    'bmifa': load_who_age('bmianthro'),
    'hcfa': load_who_age('hcanthro'),
    'muacfa': load_who_age('acanthro'),
    'wfl': load_who_len('wflanthro'),
    'wfh': load_who_len('wfhanthro'),
}
write_js(f'{OUT}/ref-who.js','WHO_REF',who,
'/* WHO Child Growth Standards (MGRS 2006), 0-5y — EXACT daily LMS tables.\n'
'   Source: WHO igrowup reference tables via WorldHealthOrganization/anthro (data-raw).\n'
'   wfa/lhfa/bmifa/hcfa: age in DAYS 0-1826. muacfa: days 91-1826 (valid >=3mo).\n'
'   wfl: length 45-110cm; wfh: height 65-120cm (0.5cm steps; linear LMS interp).\n'
'   b=boys(sex1) g=girls(sex2). */')

# ---------------- CDC 2-20y ----------------
def load_cdc(fname, xcol):
    d = {'1':{'x':[],'L':[],'M':[],'S':[]},'2':{'x':[],'L':[],'M':[],'S':[]}}
    text = open(f'{TMP}/cdc/{fname}.csv', encoding='utf-8-sig').read()
    text = text.replace('\r\n','\n').replace('P\n50','P50')  # repair broken header line
    for r in csv.DictReader(text.splitlines()):
        if (r.get('Sex') or '').strip() not in ('1','2'):
            continue
        s = r['Sex'].strip()
        d[s]['x'].append(round(float(r[xcol]),2)); d[s]['L'].append(round(float(r['L']),6))
        d[s]['M'].append(round(float(r['M']),5)); d[s]['S'].append(round(float(r['S']),6))
    return {'b':d['1'],'g':d['2']}

cdc = {
    'wt': load_cdc('wtage','Agemos'), 'ht': load_cdc('statage','Agemos'),
    'bmi': load_cdc('bmiagerev','Agemos'), 'wtht': load_cdc('wtstat','Height'),
}
write_js(f'{OUT}/ref-cdc.js','CDC_REF',cdc,
'/* CDC 2000 growth charts (+ 2022 extended BMI-for-age) — EXACT LMS tables.\n'
'   Source: cdc.gov/growthcharts/data/zscore/*.csv\n'
'   wt/ht: 24-240mo; bmi: 24-240.5mo; wtht: stature 77-121.5cm. */')

# NOTE: Fenton 2013 exact LMS are license-only (ucalgary.ca/fenton).
# A public transcription was evaluated and REJECTED (implausible values).
# Preterm infants are assessed on corrected age with exact WHO standards.
print('DONE (WHO + CDC only)')
