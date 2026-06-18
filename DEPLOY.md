# philtou.com

Vier getrennte Teile unter einem Gateway:

| Teil | Repo-Pfad | URL |
|------|-----------|-----|
| Landing | [index.html](index.html) | `/` |
| Home | [apps/home/](apps/home/) Submodule | `/home` |
| Archive | [apps/archive/](apps/archive/) Submodule | `/archive` |
| AR Archive | [apps/ar-archive/](apps/ar-archive/) Submodule | `/ar-archive` |

## Assets über Git (Submodule-Workflow)

Medien liegen **in den Submodule-Repos**, nicht auf dem Desktop:

- **Archive:** `apps/archive/public/web/` → Repo [middleman.digital](https://github.com/philippetoulabor-ux/middleman.digital)
- **Home:** `apps/home/public/home-transformed.glb`, `public/lightmaps/` → Repo [home](https://github.com/philippetoulabor-ux/home)
- **AR Archive:** `apps/ar-archive/public/models/` → Repo [ar-archive](https://github.com/philippetoulabor-ux/ar-archive)

### Erstes Setup / neuer Clone

```bash
git clone --recurse-submodules https://github.com/philippetoulabor-ux/philtou.com.git
cd philtou.com
npm run setup
npm run dev
```

Falls Submodule leer:

```bash
git submodule update --init --recursive
```

`npm run predev` prüft `public/web/buttons` und `home-transformed.glb`. Nur wenn etwas fehlt, wird ein Desktop-Fallback (`rsync`) versucht.

### Assets aktualisieren

Änderungen **im Submodule** committen und pushen, dann im Root den Submodule-Pointer aktualisieren:

```bash
cd apps/archive
# … Änderungen an public/web …
git add public/web && git commit -m "Update web assets" && git push

cd ../..
git add apps/archive
git commit -m "Update archive submodule"
```

Gleiches Muster für `apps/home` und `apps/ar-archive`.

## Im Browser testen

```bash
npm run dev
```

Öffne **http://localhost:3000** (Gateway). Nicht `index.html` direkt öffnen.

| Port | Dienst |
|------|--------|
| 3000 | Gateway |
| 3001 | Archive (Next.js, intern) |

`/home` und `/ar-archive` kommen statisch aus `dist/home/` bzw. `dist/ar-archive/` (werden bei `dev` gebaut).

Home mit Hot-Reload: `npm run dev:home` → http://localhost:5173/home/

AR Archive mit Hot-Reload (HTTPS): `npm run dev:ar-archive`

### iPhone im WLAN (ohne Deploy)

Mac und iPhone im **gleichen WLAN**, dann:

```bash
npm run dev
# oder: npm run dev:lan
```

In der Konsole erscheint eine Zeile wie:

```
iPhone (gleiches WLAN): http://192.168.x.x:3000
```

Diese URL in Safari auf dem iPhone öffnen — Landing, Home, Archive und AR Archive sind erreichbar.

**Hinweise:**
- macOS-Firewall kann Port 3000 blockieren (Systemeinstellungen → Netzwerk → Firewall)
- Gast-WLAN isoliert Geräte oft voneinander
- Kamera/Quick Look in AR Archive brauchen HTTPS (Tunnel oder Preview-Deploy); für alles andere reicht HTTP im WLAN

## Build & Preview

```bash
npm run build      # dist/ + archive standalone
npm run preview    # Gateway + Production-Server
```

## Push-Hinweis (GitHub GH007)

Falls Push mit „private email address“ abgelehnt wird: GitHub → Settings → Emails → „Keep my email private“ mit `username@users.noreply.github.com` als Commit-Adresse nutzen.
