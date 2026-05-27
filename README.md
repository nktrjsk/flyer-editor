# Samostuduj — editor letáku

Jednoduchý prohlížečový editor informačních letáků. Markdown na vstupu, A5 PDF na výstupu.

## Spuštění

Protože editor načítá `style.css` a `editor.js` jako samostatné soubory, potřebuješ
lokální server (přímé otevření `index.html` souborem nebude fungovat kvůli CORS).

```bash
# Python (nejjednodušší)
python3 -m http.server

# nebo Node.js
npx serve .
```

Pak otevři `http://localhost:8000` v prohlížeči.

## Struktura

```
index.html   — HTML skeleton a metadata formulář
style.css    — všechny styly (editor UI + A5 stránka)
editor.js    — logika renderování, auto-scale titulu, download
```

## Použití

- **Název, Organizace, Rok, Web** — vloží se automaticky do záhlaví a zápatí každé stránky
- **Písmo (pt)** — velikost těla textu (nadpisy se nemění)
- **Logo** — zobrazí se vpravo nahoře na přední straně
- **Obsah** — Markdown; `---` na samostatném řádku = nová stránka
- **Stáhnout HTML** — vygeneruje přenosný standalone soubor (CSS+JS inline) se všemi úpravami
- **Tisknout / PDF** — otevře tiskový dialog; nastav A5, bez okrajů

## Markdown

| Syntaxe | Výsledek |
|---|---|
| `## Nadpis` | sekce |
| `**tučně**` | tučný text |
| `*kurzíva*` | kurzíva |
| `~~přeškrtnutí~~` | přeškrtnutý text |
| `> text` | zvýrazněný rámeček (callout) |
| `- položka` | odrážkový seznam |
| `1. položka` | číslovaný seznam |
| `---` | nová stránka |

## Licence obsahu

Výstupy jsou šířeny pod CC BY-SA 4.0.
