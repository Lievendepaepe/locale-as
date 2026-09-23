# Lokale as – maatcontrole (Trimble Connect 3D-extensie)

Legt in de Trimble Connect 3D Viewer een lokaal assenstelsel vast op basis van metingen met de ingebouwde afstandstool (met snapping), en rekent elke volgende meting om naar lokale X/Y/Z voor maatcontrole.

## Bestanden
| Bestand | Rol |
|---|---|
| `index.html` | Het extensiepaneel (UI + koppeling met de Workspace API) |
| `lcs.js` | Rekenkern: as opbouwen, omrekenen, omkeren/draaien |
| `manifest.json` | Registratie in Trimble Connect |

## Installeren (zonder lokale ontwikkelomgeving)
1. Maak op GitHub een publieke repository `lokale-as` en upload de drie bestanden via **Add file → Upload files**.
2. **Settings → Pages**: Source = *Deploy from a branch*, branch `main`, map `/ (root)`. Na ±1 minuut staat de site op `https://GEBRUIKERSNAAM.github.io/lokale-as/`.
3. Vervang in `manifest.json` `GEBRUIKERSNAAM` door je GitHub-gebruikersnaam (bewerken via het potloodicoon). Optioneel: upload een `icon.png`.
4. In Trimble Connect (browser): **Project Settings → Apps & Capabilities → Add Custom**, manifest-URL: `https://GEBRUIKERSNAAM.github.io/lokale-as/manifest.json`. Hiervoor zijn projectbeheerrechten nodig.
5. Open de 3D Viewer. De extensie verschijnt als paneel.

## Gebruik
1. **As vastleggen**
   - 3 punten: meet O → punt op X-as, en O → punt in het XY-vlak (+Y-kant). Kies beide metingen, klik *As overnemen uit metingen*.
   - 2 punten + verticaal: meet O → punt op X-as. Z volgt uit de globale verticale.
   - De as verschijnt als rode/groene/blauwe lijnen in de viewer. Corrigeer eventueel met *X omkeren*, *Y omkeren*, *90° om Z*.
   - Exporteer de as als JSON en bewaar dat bestand in het Trimble Connect-project, zodat collega's ze kunnen importeren.
2. **Maatcontrole**: elke nieuwe meting verschijnt met lokale start-/eindcoördinaten en ΔX/ΔY/ΔZ. Kies welke maat je controleert, vul de gemeten waarde in, en je krijgt de afwijking en OK/NOK tegenover de tolerantie. Exporteer als CSV (puntkomma, Belgische decimale komma).

## Eerst testen
- **Rekenkern**: open `index.html` rechtstreeks in de browser en gebruik *Coördinaten handmatig invoeren*. Controle: O geeft (0,0,0), het X-punt geeft (basislijn, 0, 0).
- **In de viewer**: meet een maat waarvan je de waarde uit de werkhuistekening kent (bv. gatafstand langs de staafas). ΔX moet die waarde geven binnen snapnauwkeurigheid.
- **Eenheden**: de API levert markeringsposities in millimeter. De extensie rekent daarmee; controleer het met één bekende maat.

## Beperkingen
- Werkt alleen in Trimble Connect **for Browser**, niet in desktop- of mobiele app.
- Snapping bepaalt de nauwkeurigheid. Het paneel toont de richtfout: ± snapfout × afstand / basislijn. Kies X zo ver mogelijk van O.
- De globale Z wordt als verticaal aangenomen (standaard bij Tekla/IFC). Klopt dat niet voor jullie model, gebruik dan de 3-puntmethode.
- Een geëxporteerde as bevat vaste coördinaten. Na een modelrevisie waarbij het segment verschuift, moet de as opnieuw vastgelegd worden.
- De modelgeometrie moet de fabricagevorm zijn (zeeg, fabricagepositie). Een lokale as corrigeert positie en rotatie, geen vormverschil.
