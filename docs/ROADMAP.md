# Roadmap

- [x] Definire formato report da `templates/report_template.md`
- [x] Implementare generazione report
- [x] Aggiungere esportazione PDF
- [x] Aggiungere esportazione CSV compatibile con Excel
- [x] Aggiungere validazioni
- [x] Inizializzare procedure operative dai piani Markdown in `piani/`
- [x] Rendere le procedure operative modificabili da dashboard admin
- [x] Importare specifiche V1 Markdown in `docs/v1_spec/`
- [x] Aggiungere checklist attività mobile-first da specifica
- [x] Aggiungere anomalie con esclusione "Nessuna anomalia"
- [x] Aggiungere orari, pausa e totale ore automatico
- [x] Aggiungere foto opzionali e archivio foto admin locale
- [x] Aggiungere link video esterno opzionale
- [x] Aggiungere dashboard admin locale
- [x] Aggiungere invii WhatsApp, Telegram, email con messaggio precompilato
- [x] Aggiungere login locale admin/operatore
- [x] Proteggere route report, PDF, admin e archivio foto
- [x] Limitare operatore ai propri report
- [x] Aggiungere filtri admin per data, operatore, cliente, stato e anomalie
- [x] Aggiungere approvazione e contestazione report da admin
- [x] Mostrare utenti e log invii in dashboard admin

## Produzione cloud

- [x] Migrazione stack a Next.js + TypeScript + Tailwind
- [x] Supabase Auth
- [x] Supabase PostgreSQL
- [x] Supabase Storage con bucket e policy ripetibili
- [x] Row Level Security per company/admin/operatore
- [x] PWA con cache limitata agli asset pubblici
- [x] Header HTTP di sicurezza e setup iniziale protetto
- [ ] Collaudo end-to-end sull'ambiente Supabase/Netlify definitivo
- [ ] Configurazione backup, retention GDPR e monitoraggio alert
