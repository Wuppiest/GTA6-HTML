# Vice Legacy – Solara Island

Ein GTA-inspiriertes Open-World-Spiel im Browser (three.js), spielbar am PC und auf dem iPad.

## Spielen
Das Spiel besteht aus vielen Dateien (Texturen, 3D-Modelle, Code) und muss deshalb über eine Webadresse geöffnet werden – am einfachsten mit **GitHub Pages**:

1. Repository auf GitHub öffnen → **Settings** → **Pages**.
2. Bei *Build and deployment* → *Source*: **Deploy from a branch** wählen.
3. Branch auswählen (z. B. `claude/gallant-curie-cnx668` oder nach dem Mergen `main`), Ordner **/ (root)**, **Save**.
4. Nach 1–2 Minuten ist das Spiel unter `https://<benutzername>.github.io/<repository>/` erreichbar.

Lokal testen: im Projektordner `python3 -m http.server` starten und `http://localhost:8000` öffnen (direktes Öffnen der Datei funktioniert nicht).

## Steuerung (Tastatur)
WASD laufen/fahren · Maus Kamera · Linksklick schießen · Rechtsklick zielen · Leertaste springen/Handbremse · Shift sprinten/Nitro ·
F ein-/aussteigen · E Interaktion (Shops, Missionen, Zeitrennen) · U Handy · Tab Figur wechseln · K Karte · M Missionen · T/G Zeit/Wetter · F2 Admin-Menü ·
Flugzeug: W/S Nase runter/hoch, A/D rollen, Q/E Seitenruder, Shift/C Schub.
Auf dem iPad erscheinen Touch-Steuerelemente automatisch.

## Inhalte
- Insel mit Downtown, Ocean Drive, Vorstadt, Coral Heights, Dorf, Hafen, Air Base, Berg, Pier mit Riesenrad
- 7 Story-Missionen, Taxi- und Pizza-Jobs, 3 Zeitrennen, Stuntsprünge, 30 goldene Muscheln
- Shops: Autohaus, Tuning-Werkstatt (Lack, Motor, Bremsen, Fahrwerk, Panzerung, Nitro, Fahndung löschen), Waffenladen, Kleidung, Immobilien mit Einnahmen
- Funktionierende Ampeln, Verkehr mit Blinkern, Polizei, Tag/Nacht & Wetter, Speichern im Browser
- Automatische Leistungsanpassung (Auflösung) für flüssiges Spielen

## Projektstruktur
`index.html` · `css/` · `js/boot.js` (Lader) · `js/game/01–11` (Spielcode) · `assets/` (Texturen & Modelle) · `vendor/three/` (three.js)

Credits: siehe [CREDITS.md](CREDITS.md).
