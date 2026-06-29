# philtou.com

Fünf getrennte Teile unter einem Gateway:

| Teil | Repo-Pfad | URL |
|------|-----------|-----|
| Landing | [index.html](index.html) | `/` |
| Home | [apps/home/](apps/home/) Submodule | `/home` |
| Archive | [apps/archive/](apps/archive/) Submodule | `/archive` |
| AR Archive | [apps/ar-archive/](apps/ar-archive/) Submodule | `/ar-archive` |
| Worlding | [apps/worlding/](apps/worlding/) Submodule | `/worlding` |

## Assets über Git (Submodule-Workflow)

Medien liegen **in den Submodule-Repos**, nicht auf dem Desktop:

- **Archive:** `apps/archive/public/web/` → Repo [middleman.digital](https://github.com/philippetoulabor-ux/middleman.digital)
- **Home:** `apps/home/public/home-transformed.glb`, `public/lightmaps/` → Repo [home](https://github.com/philippetoulabor-ux/home)
- **AR Archive:** `apps/ar-archive/public/models/` → Repo [ar-archive](https://github.com/philippetoulabor-ux/ar-archive)
- **Worlding:** `apps/worlding/frontend/` (`data.json`, `rag_index.json`, `assets/`) → Repo [worlding](https://github.com/philippetoulabor-ux/worlding)

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

Gleiches Muster für `apps/home`, `apps/ar-archive` und `apps/worlding`.

### Worlding (Zettelkasten-Graph + Chat)

Statisches Frontend unter `/worlding`, Chat-API unter `/api/chat` (Vercel Serverless, Python).

Der **OpenAI API-Key bleibt ausschließlich serverseitig** — im Browser liegt nur der Pfad `/api/chat`, nie der Key.

#### Lokal (`.env`, wird nicht committed)

```bash
cd apps/worlding
cp .env.example .env   # falls noch nicht vorhanden
# OPENAI_API_KEY in .env eintragen (Datei liegt in apps/worlding/.gitignore)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python dev_server.py   # :8080 — Gateway proxied /api/chat dorthin
```

In einem zweiten Terminal: `npm run dev` (Gateway :3000).

`process_notes.py` liest den Key ebenfalls nur aus der Umgebung (z. B. `.env` via `python-dotenv` oder `export OPENAI_API_KEY=…`) — er landet **nicht** in `data.json` / `rag_index.json`.

#### Production (Vercel)

Im [Vercel Dashboard](https://vercel.com) → Projekt **philtou.com** → Settings → Environment Variables:

| Variable | Environments | Zweck |
|----------|--------------|-------|
| `OPENAI_API_KEY` | Production, Preview | Query-Embedding + Chat (als **Secret** markieren) |
| `ZETTELKASTEN_NAME` | optional | Name im System-Prompt |

Nach dem Setzen: Redeploy auslösen (Deployments → … → Redeploy).

**Nicht tun:** Key in `index.html`, `chat.js`, Git-Commits oder öffentliche Repo-Dateien legen.

## Im Browser testen

```bash
npm run dev
```

Öffne **http://localhost:3000** (Gateway). Nicht `index.html` direkt öffnen.

| Port | Dienst |
|------|--------|
| 3000 | Gateway |
| 3001 | Archive (Next.js, intern) |

`/home`, `/ar-archive` und `/worlding` kommen statisch aus `dist/home/`, `dist/ar-archive/` bzw. `dist/worlding/` (werden bei `dev` gebaut).

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
