"""Garante que a interface e os exemplos não exponham observações internas do desenvolvimento."""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
BANNED = [r"figma", r"prot[óo]tipo", r"conferir enunciado", r"n[ãa]o confirmad", r"claude", r"anthropic", r"intelig[êe]ncia artificial", r"digitad[ao] pel"]
CASE_SENSITIVE = [r"\bIA\b"]


def sources():
    for base in ("frontend/src", "backend/app"):
        for p in (ROOT / base).rglob("*"):
            if p.suffix in {".ts", ".tsx", ".py", ".css", ".html"} and "test" not in p.parts and p.name != "setup.ts" and ".test." not in p.name:
                yield p
    yield ROOT / "frontend/index.html"


def test_sem_textos_internos_na_interface_e_nos_exemplos():
    hits = []
    for p in sources():
        t = p.read_text(encoding="utf-8")
        for rx in BANNED:
            if re.search(rx, t, re.I):
                hits.append((p.name, rx))
        for rx in CASE_SENSITIVE:
            if re.search(rx, t):
                hits.append((p.name, rx))
    assert not hits, hits
