#!/usr/bin/env python3
"""Genera la copia de revision.html con la forma que exige un Artifact de claude.ai.

Un Artifact envuelve el archivo en <!doctype html><head></head><body> al publicarlo,
asi que el payload no puede traer sus propios doctype/html/head/body. Este script
extrae el <title> + <style> del head y todo el contenido del body, y los concatena.

La fuente de verdad es siempre revision.html (el que se abre con doble clic).
Uso:  python3 docs/dow-summit-2026/build-artifact.py
"""
import re
import sys
from pathlib import Path

AQUI = Path(__file__).parent
ORIGEN = AQUI / "revision.html"
DESTINO = AQUI / "revision-artifact.html"

html = ORIGEN.read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)

# charset y viewport los aporta el wrapper del Artifact
head = re.sub(r"[ \t]*<meta[^>]*>\n?", "", head)
salida = head.strip() + "\n" + body.strip() + "\n"

# \b evita el falso positivo de <header> conteniendo <head>
if re.search(r"<!doctype|</?(html|head|body)\b", salida, re.I):
    sys.exit("ERROR: quedo un tag de wrapper en la salida")
for obligatorio in ("<title>", "<style>", "<script>"):
    if obligatorio not in salida:
        sys.exit(f"ERROR: falta {obligatorio} en la salida")

DESTINO.write_text(salida, encoding="utf-8")
print(f"ok -> {DESTINO.name} ({len(salida)} bytes)")
