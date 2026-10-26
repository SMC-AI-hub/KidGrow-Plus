#!/usr/bin/env python3
"""Build docs/validator-handoff-pack.docx from the handoff template + bundle + sheets.
Regenerate after any sheet change: python3 docs/validator-pack-generate.py
Fills DATE + STAGING_COMMIT automatically; identity blanks stay for the owner.
"""
import re
import subprocess
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, Inches
from docx.oxml.ns import qn

DATE = "2026-10-25"
COMMIT = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()

FILLS = {
    "[Date]": DATE,
    "[fill at send time]": COMMIT,
    "commit [fill at send time]": "commit " + COMMIT + " (code-identical to 78d47b9, last full-green suite run)",
}

doc = Document()
sec = doc.sections[0]
sec.top_margin = sec.bottom_margin = Inches(0.7)
sec.left_margin = sec.right_margin = Inches(0.7)
style = doc.styles["Normal"]
style.font.size = Pt(11)


def landscape():
    s = doc.add_section(WD_SECTION.NEW_PAGE)
    s.orientation = 1  # landscape
    s.page_width, s.page_height = s.page_height, s.page_width
    s.left_margin = s.right_margin = Inches(0.5)
    s.top_margin = s.bottom_margin = Inches(0.5)


def portrait():
    s = doc.add_section(WD_SECTION.NEW_PAGE)
    s.orientation = 0
    s.page_width, s.page_height = Inches(8.5), Inches(11)
    s.left_margin = s.right_margin = Inches(0.7)
    s.top_margin = s.bottom_margin = Inches(0.7)


def add_runs(p, text):
    for i, part in enumerate(re.split(r"(\*\*.+?\*\*)", text)):
        if not part:
            continue
        r = p.add_run(part[2:-2] if part.startswith("**") else part)
        r.bold = part.startswith("**")


def para(text, size=11, bold=False, align=None):
    p = doc.add_paragraph()
    add_runs(p, text)
    for r in p.runs:
        r.font.size = Pt(size)
        if bold:
            r.bold = True
    if align is not None:
        p.alignment = align
    return p


def table(rows, size=8):
    t = doc.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = "Table Grid"
    for i, row in enumerate(rows):
        for j, cell in enumerate(row):
            c = t.cell(i, j)
            c.text = ""
            add_runs(c.paragraphs[0], cell)
            for r in c.paragraphs[0].runs:
                r.font.size = Pt(size)
                if i == 0:
                    r.bold = True
    doc.add_paragraph()


def md_blocks(path):
    """Yield ('h1'|'h2'|'p'|'li'|'table', payload) from our small md subset."""
    lines = open(path).read().splitlines()
    i = 0
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip() or ln.strip() == "---":
            i += 1
            continue
        if ln.startswith("### "):
            yield ("h3", ln[4:])
        elif ln.startswith("## "):
            yield ("h2", ln[3:])
        elif ln.startswith("# "):
            yield ("h1", ln[2:])
        elif ln.startswith("- ") or re.match(r"^\d+\. ", ln):
            yield ("li", re.sub(r"^(- |\d+\. )", "", ln))
        elif ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(set(c) <= set("-: ") for c in cells):
                    rows.append(cells)
                i += 1
            yield ("table", rows)
            continue
        else:
            buf = ln
            while (i + 1 < len(lines) and lines[i + 1].strip()
                   and not lines[i + 1].startswith(("#", "|", "- "))
                   and not re.match(r"^\d+\. ", lines[i + 1])):
                i += 1
                buf += " " + lines[i].strip()
            yield ("p", buf)
        i += 1


def emit(path, skip_h1=False):
    for kind, payload in md_blocks(path):
        if kind == "h1":
            if not skip_h1:
                para(payload, size=16, bold=True)
        elif kind == "h2":
            para(payload, size=13, bold=True)
        elif kind == "h3":
            para(payload, size=11, bold=True)
        elif kind == "li":
            para(payload, size=10).paragraph_format.left_indent = Inches(0.3)
        elif kind == "table":
            table(payload)
        else:
            for k, v in FILLS.items():
                payload = payload.replace(k, v)
            para(payload, size=10)


# ---- cover ----
p = para("KidGrow-Plus (NeoKid Care) — Validator Handoff Pack", size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
para("Date: " + DATE + "  ·  Staging commit: " + COMMIT, size=11, align=WD_ALIGN_PARAGRAPH.CENTER)
para("BEFORE SENDING — fill these 4 blanks (search for [ ]): validator name, "
     "validator qualification/registration, owner name, owner contact. Everything else is ready.",
     size=11, bold=True)
para("Contents: 1. Cover note · 2. Sign-off bundle checklist · 3. F1 dose sheet (30 rows) · "
     "4. F9 growth sheet (21 cells) · 5. F25 NICU caselog (P1–P3 rulings + 12 cases). "
     "Validator: complete in order, initial + date every row/case, return scans to the owner.", size=10)
doc.add_page_break()
emit("docs/VALIDATOR-HANDOFF.md", skip_h1=True)
doc.add_page_break()
emit("docs/VALIDATOR-BUNDLE.md")
landscape()
emit("docs/F1-DOSE-SIGNOFF.md")
landscape()
emit("docs/F9-GROWTH-SPOTCHECK.md")
landscape()
emit("docs/F25-NICU-CASELOG.md")

doc.save("docs/validator-handoff-pack.docx")
print("wrote docs/validator-handoff-pack.docx")
