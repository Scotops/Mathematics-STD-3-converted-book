"""Publish explicit Swahili pronunciation for acknowledgement names."""

from __future__ import annotations

import json
from pathlib import Path

from apply_inclusivity_matrix import rebuild_offline_preloader


ROOT = Path(__file__).resolve().parents[1]
PRONUNCIATIONS = (
    "Bi Ivi P Bimbiga, Daktari Kenethi R Nzowa, na Bwana Jonathani H Paskali.",
    "Daktari Mikaeli H Mkwizu, Daktari Furaha M Chuma, Daktari Augustino I Msigwa, Daktari Ahmada O Ali, Daktari Mashaka J Mkandawile, Bwana Luwilo D Sanga, Bwana Elikana E Manyilizu, na Bi Skolastika A Kulanga.",
    "Bi Pamela S Makusi.",
    "Bwana Fikiri A Msimbe, Bi Viktoria R Mwinyi, Bwana Godwini J Chipenya, na Bwana Gwakisa U Mwandoloma.",
    "Bi Ivi P Bimbiga.",
    "Daktari Anethi A Komba.",
)


def main() -> None:
    page = (ROOT / "pg004_sec001.html").read_text(encoding="utf-8")
    for pronunciation in PRONUNCIATIONS:
        marker = f'lang="sw-TZ" data-tts-lang="sw-TZ" data-tts-text="{pronunciation}"'
        if marker not in page:
            raise RuntimeError(f"Swahili pronunciation missing: {pronunciation}")

    tts = (ROOT / "assets" / "accessible-tts.js").read_text(encoding="utf-8")
    if "languageCode === 'sw' && /rehema|daudi|rafiki|swahili/.test(name)" not in tts:
        raise RuntimeError("Swahili voice preference is missing")

    versioned_html = 0
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        updated = source.replace("accessible-tts.js?v=34", "accessible-tts.js?v=35")
        updated = updated.replace("offline-preloader.js?v=100", "offline-preloader.js?v=101")
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            versioned_html += 1

    for relative in ("content/pages.json", "content/toc.json"):
        path = ROOT / relative
        source = path.read_text(encoding="utf-8")
        path.write_text(source.replace("?reader=28", "?reader=29"), encoding="utf-8")

    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["bundleVersion"] = "106"
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    rebuild_offline_preloader()
    print({"swahili_name_groups": len(PRONUNCIATIONS), "reader": 29, "bundle": 106, "versioned_html": versioned_html})


if __name__ == "__main__":
    main()
