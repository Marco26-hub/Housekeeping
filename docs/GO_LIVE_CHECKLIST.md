# Checklist go-live

## Configurazione

- [ ] Creare progetto Supabase di produzione nella regione corretta.
- [ ] Eseguire, in ordine, `schema.sql`, `migration_v1.sql`, `seed.sql`, `storage_setup.sql`.
- [ ] Configurare tutte le variabili di `.env.production.example` su Netlify.
- [ ] Usare un `SETUP_SECRET` casuale di almeno 32 caratteri.
- [ ] Impostare `NEXT_PUBLIC_APP_URL` sul dominio HTTPS definitivo.
- [ ] Eseguire `/setup` una sola volta e verificare il login admin.

## Collaudo

- [ ] `/api/health` restituisce HTTP 200 e `status: ok`.
- [ ] Admin crea immobile, template e operatore.
- [ ] Operatore crea e completa un report da telefono reale.
- [ ] Upload, visualizzazione e cancellazione foto funzionano.
- [ ] Firma operatore/cliente e PDF risultano corretti.
- [ ] Email e Telegram funzionano con credenziali reali.
- [ ] Logout su dispositivo condiviso non mostra dati dalla cache.
- [ ] Installazione PWA verificata su Android e iOS.

## Operatività

- [ ] Abilitare backup Supabase e provare un ripristino.
- [ ] Definire retention per foto, firme e PDF e informativa privacy GDPR.
- [ ] Collegare error tracking e alert al controllo `/api/health`.
- [ ] Ruotare immediatamente qualsiasi chiave eventualmente esposta.
- [ ] Eseguire `npm run check` prima di ogni rilascio.
