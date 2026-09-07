# LeadForge Italia

MVP completo per cercare e organizzare nuovi potenziali clienti. Include dashboard, database SQLite, campagne commerciali, import/export CSV e ricerca di attività tramite dati pubblici OpenStreetMap.

## Avvio

Richiede Node.js 20 o superiore.

```bash
npm start
```

Apri [http://localhost:8080](http://localhost:8080). Il database viene creato automaticamente in `data/leadforge.db`.

Per lo sviluppo con riavvio automatico:

```bash
npm run dev
```

Per eseguire i test:

```bash
npm test
```

## Funzioni

- ricerca per categoria e località su OpenStreetMap/Overpass;
- deduplicazione automatica dei risultati;
- score 0–100 basato sulla completezza dei contatti;
- pipeline: nuovo, qualificato, contattato, acquisito, perso;
- campagne per settore e territorio;
- aggiunta manuale, importazione ed esportazione CSV;
- API JSON e database SQLite locale.

Il CSV può contenere le colonne `company`, `category`, `city`, `address`, `website`, `email`, `phone`, `source` e `notes`.

## API principali

| Metodo | Percorso | Funzione |
|---|---|---|
| `GET` | `/api/dashboard` | statistiche e lead recenti |
| `GET/POST` | `/api/leads` | elenco e creazione lead |
| `PATCH/DELETE` | `/api/leads/:id` | aggiornamento ed eliminazione |
| `GET/POST` | `/api/campaigns` | campagne |
| `POST` | `/api/discover` | ricerca su OpenStreetMap |
| `POST` | `/api/import` | import CSV |

## Uso responsabile

La ricerca utilizza dati pubblici, ma la disponibilità online non rende automaticamente lecito qualsiasi trattamento. Prima dell'uso commerciale verifica GDPR, base giuridica, informative, diritto di opposizione, Registro Pubblico delle Opposizioni e termini della fonte. Non sono inclusi aggiramento di CAPTCHA, login, rate limit o raccolta di dati privati.

Per un ambiente pubblico aggiungi autenticazione, HTTPS, backup, rate limiting, log di audit e una policy di conservazione dati. Imposta inoltre `USER_AGENT` con un contatto reale, come richiesto dalle policy di Nominatim.
