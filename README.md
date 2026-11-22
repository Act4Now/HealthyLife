# HealthyLife AI

Demo bilingv (română / engleză) pentru urmărirea obiceiurilor de wellness.

## Ce conține
- React + TypeScript + Vite
- Dashboard responsive
- Schimbare limbă RO / EN
- Interacțiuni demonstrative pentru rutina zilnică și hidratare
- Workflow GitHub Actions pentru publicare pe GitHub Pages
- Documentație de arhitectură și limite de securitate

## Important
Aceasta este o demonstrație statică, nu o aplicație medicală de producție. Nu introduceți date reale despre medicamente, diagnostic, tratament, greutate sau alte informații personale de sănătate.

GitHub Pages găzduiește doar frontend static. Nu poate păstra în siguranță tokenuri private, nu rulează backend și nu oferă singur autentificare multi-utilizator, bază de date sau livrare de notificări push. Nu adăugați chei API în codul frontend sau în repository.

Integrarea AI Free Forever nu este activată. Înainte de integrare trebuie confirmate documentația oficială API, endpoint-ul, autentificarea, limitele, termenii și politica de date. Tokenurile trebuie păstrate exclusiv pe server.

## Cerințe
- Node.js 20+
- npm

## Rulare locală
```bash
npm install
npm run dev
```

## Verificare și build
```bash
npm run typecheck
npm run build
npm run preview
```

## Publicare GitHub Pages
1. În repository-ul GitHub, deschide **Settings → Pages**.
2. La **Build and deployment → Source**, selectează **GitHub Actions**.
3. Încarcă fișierele proiectului în branch-ul `main`.
4. Workflow-ul `.github/workflows/pages.yml` va construi și publica aplicația.

URL estimat pentru repository-ul `Act4Now/HealthyLife`:
https://act4now.github.io/HealthyLife/

Dacă repository-ul are alt branch implicit, actualizează branch-ul urmărit în workflow.
