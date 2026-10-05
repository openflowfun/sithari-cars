"""Refresh src/data/inventory.json from the live Motorcentral listing on sitharicars.co.nz.
Run: python3 scripts/scrape_inventory.py

Refuses to overwrite the existing file if the new scrape looks broken — a markup
change on their side makes the patterns below match nothing, and an empty or
half-empty file would publish an empty showroom.
"""
import re, json, html, subprocess, pathlib, sys

OUT = pathlib.Path(__file__).resolve().parent.parent / "src/data/inventory.json"
BASE = "https://www.sitharicars.co.nz"
MAX_PAGES = 50          # walk until a page comes back empty; this is only a runaway bound

# Promoted listings carry extra classes (`vehicle featured`), so match the prefix.
CARD = re.compile(r'<li class="vehicle[^"]*">(.*?)</li>\s*(?=<li class="vehicle|\s*</ul>)', re.S)

rows, seen = [], set()
for p in range(1, MAX_PAGES + 1):
    h = subprocess.run(["curl", "-sL", "--max-time", "30", "-A", "Mozilla/5.0", f"{BASE}/vehicles?page={p}"],
                       capture_output=True, text=True).stdout
    cards = CARD.findall(h)
    if not cards:
        break
    for c in cards:
        m = re.search(r'href="(/vehicle/[^"?]+)/(\d+)', c)
        if not m or m.group(2) in seen: continue
        seen.add(m.group(2))
        title = re.search(r'<h6[^>]*>(.*?)</h6>', c, re.S); price = re.search(r'class="amount">\$([\d,]+)', c)
        specs = re.search(r'vehicle-specs">\s*<div[^>]*>\s*(.*?)\s*</div>', c, re.S); img = re.search(r'<img src="(/Motorcentral/VehicleData/[^"]+)"', c)
        t = " ".join(html.unescape(title.group(1)).split()).split(" ") if title else ["", "", ""]
        sp = specs.group(1).strip() if specs else ""
        km = re.match(r"([\d,]+km)", sp)
        rows.append({
            "id": m.group(2), "year": t[0], "make": t[1], "model": " ".join(t[2:]),
            "price": price.group(1).replace(",", "") if price else None,
            "km": km.group(1) if km else "", "specs": sp,
            "fuel": next((f for f in ("Hybrid","Petrol","Diesel","Electric") if f in sp), ""),
            "img": BASE + img.group(1) if img else "", "tags": re.findall(r'title="([^"]+)"', c),
            "url": BASE + m.group(1) + "/" + m.group(2),
        })

previous = len(json.loads(OUT.read_text())) if OUT.exists() else 0
if len(rows) < 20 or (previous and len(rows) < previous * 0.5):
    sys.exit(f"refusing to write: got {len(rows)} vehicles, previous file had {previous}. "
             f"Their markup has probably changed — check the CARD pattern before trusting this.")

OUT.write_text(json.dumps(rows, indent=1))
print(f"wrote {len(rows)} vehicles to {OUT} (was {previous})")
