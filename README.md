# Fotobingo Maker

Maak unieke, printklare bingokaarten met je eigen foto's. De app werkt volledig in de browser: foto's worden niet naar een server geüpload.

**Website:** https://hobbit12b.github.io/bingo/

## Mogelijkheden

- losse foto's of een complete map kiezen;
- foto's verschuiven, zoomen, draaien en hernoemen;
- unieke bingokaarten van 3 × 3, 4 × 4 of 5 × 5 maken;
- één of twee kaarten per A4 printen of als pdf opslaan;
- spelleidersblad en trekkaartjes maken;
- een speelse digitale trekking voor het digibord gebruiken;
- alle getrokken foto's blijven bekijken;
- een compleet project als `.fotobingo`-bestand opslaan en later opnieuw openen.

## Privacy

Alle gekozen foto's blijven in de browser op het apparaat van de gebruiker. Ook een opgeslagen `.fotobingo`-bestand staat uitsluitend op de computer van de gebruiker. Zet projectbestanden met leerlingfoto's nooit in deze openbare repository.

## Lokaal starten

Vereist: Node.js 22.13 of nieuwer.

```bash
npm install
npm run dev
```

## GitHub Pages bouwen

```bash
npm run build:pages
```

Iedere wijziging op de `main`-branch wordt automatisch gebouwd en gepubliceerd op het websiteadres hierboven.
