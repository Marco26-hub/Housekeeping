# SWA Housekeeping OS

Progetto unico per sito pubblico Housekeeping + web app mobile-first Report Pulizie.

La root `/` mostra la landing premium SWA Housekeeping. L'area operativa è su `/login`, con dashboard dipendente su `/dashboard` e dashboard admin su `/admin`.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + Storage + RLS)
- pdf-lib (generazione PDF lato server)
- Nodemailer (invio email)
- Telegram Bot API (sendDocument)
- PWA installabile (manifest + service worker)

## Funzionalità

**Sito pubblico**
- Landing Housekeeping premium servita da `/`
- Pagine statiche multilingua e legali in `public/housekeeping/`
- Brochure PDF IT/EN incluse fra gli asset pubblici
- Pulsante “Area operatori” verso `/login`

**Dipendente**
- Dashboard mobile con pulsanti grandi: Nuovo Report, Report di oggi, Storico, Profilo
- Creazione report con template precompilato (checklist auto-popolata)
- Form con dati intervento, checklist a sezioni richiudibili, anomalie, note, foto, firme
- Calcolo automatico ore totali (entrata - uscita - pausa)
- Autosave bozza ogni 8s + salvataggio manuale
- Compressione immagini browser-side prima dell'upload
- Firma digitale operatore + cliente (touch/mouse)
- Generazione PDF premium e condivisione via Email / Telegram / WhatsApp
- Stato workflow: bozza → completato → inviato → ricevuto → approvato / contestato

**Admin**
- Dashboard con statistiche giorno (report, ore, pendenti, contestati)
- Filtri: data, operatore, cliente, stato
- Approvazione / contestazione report
- Gestione immobili / clienti
- Gestione template checklist
- Impostazioni: nome azienda, email destinataria, Telegram chat_id

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

Compila `.env.local` con le credenziali Supabase e un `SETUP_SECRET` casuale di almeno 16 caratteri. SMTP e Telegram sono opzionali.

### 2. Database

Nel SQL editor di Supabase, esegui in ordine:

1. `supabase/schema.sql` – tabelle, enum, RLS e helper functions
2. `supabase/migration_v1.sql` – campi applicativi V1
3. `supabase/seed.sql` – funzioni seed (`seed_default_templates`)
4. `supabase/storage_setup.sql` – bucket privati e policy Storage multi-azienda

Gli script usano lo schema Supabase standard `public`. I bucket Storage vengono creati automaticamente da `storage_setup.sql`.

Apri `/setup` e inserisci il codice configurato in `SETUP_SECRET`: l'app crea azienda, primo admin e template predefiniti. Dopo il primo setup la route si disattiva automaticamente.

### 3. Dev

```bash
npm run dev
```

Apri http://localhost:3000

Rotte principali:

- `/` sito pubblico Housekeeping
- `/login` accesso operatori/admin
- `/dashboard` area operatore autenticata
- `/admin` area admin autenticata

### 4. Telegram Bot

1. Crea bot con [@BotFather](https://t.me/botfather), salva il token in `TELEGRAM_BOT_TOKEN`.
2. Avvia una chat con il bot dall'utente/canale destinatario.
3. Recupera il `chat_id` (es. con `https://api.telegram.org/bot<TOKEN>/getUpdates`).
4. Inseriscilo nelle Impostazioni della web app.

### 5. WhatsApp

Usa la Web Share API quando disponibile; fallback su `wa.me?text=...` con link al PDF. Il PDF è scaricabile dal link condiviso — il browser potrebbe non supportare l'allegato automatico.

## Sicurezza

- **RLS** abilitata su tutte le tabelle: ogni azienda vede solo i propri dati; ogni dipendente solo i propri report.
- Route admin protette via middleware (controllo ruolo `admin`).
- Upload foto firmati con percorso `company_id/report_id/kind/file`.
- API server-side usano cookie di sessione del dipendente; service role solo per operazioni Storage.
- Validazione campi obbligatori prima del completamento report (cliente, indirizzo, orario entrata, firma operatore).

## Mobile / PWA

- Layout mobile-first, pulsanti grandi, sezioni richiudibili, barra di progresso, bottom nav.
- `manifest.webmanifest` + `sw.js` per installazione PWA su iOS/Android.
- Le icone SVG/PNG sono incluse in `public/icons/`.

## Verifica prima del deploy

```bash
npm run check
```

Il comando esegue lint, typecheck, test (incluso controllo sintassi service worker) e build di produzione. Dopo il deploy verificare `/api/health`: deve rispondere `status: ok`.

Non eseguire il deploy della cartella legacy `Report_pulizie/`: la configurazione Netlify deve avere questa root come base del progetto. Anche la vecchia cartella statica Housekeeping non va deployata separatamente se vuoi mantenere progetto unico: gli asset pubblici sono in `public/housekeeping/`.

## Struttura

```
app/
  page.tsx            # landing pubblica Housekeeping integrata
  (app)/              # rotte autenticate
    dashboard/page.tsx # home dipendente
    reports/...       # storico + new + detail + edit
    admin/...         # dashboard admin
    profile/...
  api/reports/[id]/   # pdf, send-email, send-telegram, approve, contest
  login/page.tsx
  auth/signout/route.ts
components/           # BottomNav, CollapsibleSection, PhotoUpload, SignaturePad, ServiceWorker
lib/                  # constants, utils, auth, pdf, supabase clients
supabase/             # schema.sql, seed.sql
public/
  housekeeping/       # sito pubblico statico, brochure, lingue e pagine legali
  manifest.webmanifest
  sw.js
  icons/
```
