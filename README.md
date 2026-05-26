# Skarven BIM Dashboard

**Skarven Læringssenter — Eksamen 2026**  
Interaktivt prosjektdashboard med 3D IFC-visning, BCF Issues, IDS Validering og Analyse.

---

## 🌐 Åpne dashboardet (for alle med tilgang)

Etter at GitHub Pages er satt opp (se nedenfor), bruker alle denne lenken:

```
https://<ditt-github-brukernavn>.github.io/<repo-navn>/
```

> Ingen installasjon nødvendig — åpnes direkte i Chrome eller Edge.

---

## ⚙️ Første gangs oppsett — GitHub Pages

### Steg 1 — Opprett GitHub-konto og repo

1. Gå til [github.com](https://github.com) og logg inn (eller opprett konto)
2. Klikk **+** → **New repository**
3. Gi repoet et navn, f.eks. `skarven-dashboard`
4. Sett til **Private** (kun for gruppemedlemmer) eller **Public**
5. Klikk **Create repository**

### Steg 2 — Last opp Dashboard-filene

```powershell
# Åpne PowerShell i Dashboard-mappen og kjør:
git init
git add .
git commit -m "Første opplasting av Skarven Dashboard"
git branch -M main
git remote add origin https://github.com/<brukernavn>/<repo-navn>.git
git push -u origin main
```

### Steg 3 — Legg til IFC-filer

IFC-filer er store og lastes opp separat. Dra dem inn i `IFC/`-mappen på GitHub.com, eller:

```powershell
# Kopier IFC-filene til IFC/-mappen i Dashboard
# Filnavnene MÅ stemme nøyaktig:
#   Fischer-Nikolai_SL1-B_E-2026.ifc
#   Saelid-Kristoffer_SL1-A_E-2026.ifc
#   Castro-Maria_LARK_E-2026.ifc
#   Kilinc-Kaan_RIE_SL1-B_E-2026.ifc
#   Thurairajah-Methuban_VA_E-2026.ifc
#   Thurairajah-Methuban_VEG_E-2026.ifc

git add IFC/
git commit -m "Legger til IFC-modeller"
git push
```

> ⚠️ **Maks 100 MB per fil på GitHub.** Større filer → se Git LFS-seksjonen nedenfor.

### Steg 4 — Aktiver GitHub Pages

1. Gå til repoet på GitHub.com
2. Klikk **Settings** → **Pages** (i venstre meny)
3. Under **Source**: velg **GitHub Actions**
4. GitHub kjører automatisk deploy-workflowen (`.github/workflows/deploy.yml`)
5. Etter 1–2 minutter får du en URL som:  
   `https://<brukernavn>.github.io/<repo-navn>/`

### Steg 5 — Del lenken

Send URL-en til alle prosjektmedlemmer. De åpner den i Chrome eller Edge — ferdig! ✅

---

## 📦 Hvis IFC-filer er over 100 MB — Git LFS

```powershell
# Installer Git LFS (én gang)
git lfs install

# Spor IFC-filer med LFS
git lfs track "IFC/*.ifc"
git add .gitattributes
git commit -m "Konfigurer Git LFS for IFC-filer"

# Last opp IFC-filer
git add IFC/
git commit -m "Legger til IFC-modeller via LFS"
git push
```

> **Merk:** GitHub LFS er gratis opp til 1 GB. GitHub Pages serverer LFS-filer direkte — IFC-lasting fungerer som normalt.

---

## 💻 Lokal utvikling (valgfritt)

```powershell
# Krev Node.js installert
node server.js
# Åpne: http://localhost:7777/HTML/index.html
```

---

## 📂 Mappestruktur

```
Dashboard/
├── index.html              ← Rot-viderekobling
├── HTML/
│   ├── index.html          ← Startside (Dashboard)
│   ├── 3Dmodell.html
│   ├── BCF.html
│   ├── IDS.html
│   └── Anlyse.html
├── CSS/styles.css
├── JS/
│   ├── app.js              ← Hoved-logikk
│   ├── files.js            ← IFC filhåndtering (server/web/mappe)
│   └── viewer.js           ← 3D IFC-viewer (Three.js + web-ifc)
├── IFC/                    ← IFC-modellene legges her
├── Background/             ← Fagkort-bakgrunnsbilder
├── PB gruppemedlemmer/     ← Profilbilder
└── server.js               ← Lokal dev-server (kun utvikling)
```

---

## 🔄 Moduser for IFC-lasting

| Modus | Når | Krever |
|-------|-----|--------|
| 🌐 **Statisk web** | GitHub Pages / Azure | IFC-filer i `IFC/`-mappen i repoet |
| 📡 **Server** | Lokal utvikling | `node server.js` + IFC-mappe lokalt |
| 📁 **Mappe-velger** | Fallback | Velg synkronisert OneDrive-mappe én gang |

---

*Skarven Læringssenter · Eksamen 2026*
