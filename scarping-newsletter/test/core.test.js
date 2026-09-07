import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/discovery.js';
import { calculateScore, query, run, upsertLead } from '../src/db.js';

test('legge CSV con valori tra virgolette', () => {
  const rows = parseCsv('company,city,email\n"Pulito, Srl",Milano,info@pulito.it');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].company, 'Pulito, Srl');
  assert.equal(rows[0].email, 'info@pulito.it');
});

test('calcola lo score sulla completezza del contatto', () => {
  assert.equal(calculateScore({}), 25);
  assert.equal(calculateScore({ website:'https://a.it', email:'a@a.it', phone:'123', address:'via Roma' }), 100);
});

test('salva e recupera un lead con parametri nominati', () => {
  const company = `Lead regressione ${Date.now()}`;
  upsertLead({ company, city:'Milano', email:'test@example.it', phone:'0212345678' });
  const rows = query('SELECT * FROM leads WHERE company=$company', { $company:company });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].score, 70);
  run('DELETE FROM leads WHERE company=?', [company]);
});
