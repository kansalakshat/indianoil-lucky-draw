const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Simple JSON file storage (no native deps) ---
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'entries.json');

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { entries: [], winners: [] };
  }
}
function saveDB(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
if (!fs.existsSync(DB_FILE)) saveDB({ entries: [], winners: [] });

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Twilio posts form-encoded
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---
function normalizePhone(raw) {
  if (!raw) return '';
  return String(raw).replace(/[^\d+]/g, '').replace(/^whatsapp:/i, '');
}

// Add an entry, de-duplicating on phone + bill number.
function addEntry({ name, phone, bill, source }) {
  name = (name || '').trim();
  phone = normalizePhone(phone);
  bill = (bill || '').trim();
  if (!name || !phone || !bill) {
    return { ok: false, error: 'name, phone and bill are all required' };
  }
  const db = loadDB();
  const dup = db.entries.find(
    (e) => e.phone === phone && e.bill.toLowerCase() === bill.toLowerCase()
  );
  if (dup) return { ok: false, error: 'This bill number is already registered for this phone', entry: dup };

  const entry = {
    id: crypto.randomUUID(),
    name,
    phone,
    bill,
    source: source || 'web',
    createdAt: new Date().toISOString(),
  };
  db.entries.push(entry);
  saveDB(db);
  return { ok: true, entry };
}

/*
 * Parse a free-text SMS / WhatsApp message into name, phone, bill.
 * Accepted styles (flexible):
 *   " Akshat Kansal, 9876543210, INV-2201"
 *   " Akshat Kansal / 9876543210 / INV2201"
 *   "Name: Akshat Kansal Phone: 9876543210 Bill: INV2201"
 * If phone isn't in the text, the sender's number (from) is used.
 */
function parseMessage(text, fromNumber) {
  const result = { name: '', phone: '', bill: '' };
  if (!text) return result;
  const cleaned = text.trim();

  // Labelled form first. Name stops before the next label keyword or a separator.
  const nameM = cleaned.match(/name\s*[:\-]\s*(.+?)(?=\s+(?:phone|mobile|number|bill|invoice)\b|[,\/|\n]|$)/i);
  const phoneM = cleaned.match(/(?:phone|mobile|number)\s*[:\-]\s*([+\d][\d\s]{7,})/i);
  // Require an explicit ":" so "INV-3090" (a value) isn't mistaken for a "bill:" label.
  const billM = cleaned.match(/(?:bill|invoice)\s*(?:no\.?|number)?\s*:\s*([A-Za-z0-9\-\/]+)/i);

  if (nameM) result.name = nameM[1].trim();
  if (phoneM) result.phone = phoneM[1].trim();
  if (billM) result.bill = billM[1].trim();

  // Fallback: split on commas / slashes / pipes -> [name, phone, bill]
  if (!result.name || !result.phone || !result.bill) {
    const parts = cleaned.split(/[,\/|]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      if (!result.name) result.name = parts[0];
      if (!result.phone) result.phone = (parts[1].match(/[+\d][\d\s]{7,}/) || [parts[1]])[0].trim();
      if (!result.bill) result.bill = parts[2];
    } else if (parts.length === 2) {
      if (!result.name) result.name = parts[0];
      if (!result.bill) result.bill = parts[1];
    }
  }

  if (!result.phone && fromNumber) result.phone = normalizePhone(fromNumber);
  return result;
}

// ================= Public / intake API =================

// Web form submission
app.post('/api/entries', (req, res) => {
  const r = addEntry({ ...req.body, source: 'web' });
  res.status(r.ok ? 201 : 400).json(r);
});

// Twilio SMS webhook (Content-Type: application/x-www-form-urlencoded)
app.post('/webhook/sms', (req, res) => {
  const parsed = parseMessage(req.body.Body, req.body.From);
  const r = addEntry({ ...parsed, source: 'sms' });
  const reply = r.ok
    ? `Thank you ${r.entry.name}! Your IndianOil lucky draw entry (Bill ${r.entry.bill}) is registered.`
    : `Sorry, we couldn't register your entry: ${r.error}. Please send: Name, Phone, Bill No.`;
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`);
});

// Twilio WhatsApp webhook (same shape as SMS; From looks like "whatsapp:+91...")
app.post('/webhook/whatsapp', (req, res) => {
  const parsed = parseMessage(req.body.Body, req.body.From);
  const r = addEntry({ ...parsed, source: 'whatsapp' });
  const reply = r.ok
    ? `Thank you ${r.entry.name}! Your IndianOil lucky draw entry (Bill ${r.entry.bill}) is registered.`
    : `Sorry, we couldn't register your entry: ${r.error}. Please send: Name, Phone, Bill No.`;
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`);
});

// Meta WhatsApp Cloud API webhook verification
app.get('/webhook/meta', (req, res) => {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'indianoil-verify';
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// Meta WhatsApp Cloud API incoming message
app.post('/webhook/meta', (req, res) => {
  try {
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg?.text?.body) {
      const parsed = parseMessage(msg.text.body, msg.from);
      addEntry({ ...parsed, source: 'whatsapp' });
    }
  } catch (e) { /* ignore malformed */ }
  res.sendStatus(200);
});

// ================= Admin API =================
app.get('/api/entries', (req, res) => {
  const db = loadDB();
  res.json({ count: db.entries.length, entries: db.entries.slice().reverse() });
});

app.delete('/api/entries/:id', (req, res) => {
  const db = loadDB();
  const before = db.entries.length;
  db.entries = db.entries.filter((e) => e.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true, removed: before - db.entries.length });
});

// Pick a random winner
app.post('/api/winner', (req, res) => {
  const db = loadDB();
  const pool = db.entries;
  if (pool.length === 0) return res.status(400).json({ ok: false, error: 'No entries yet' });
  const winner = pool[crypto.randomInt(pool.length)];
  const record = { ...winner, wonAt: new Date().toISOString() };
  db.winners.push(record);
  saveDB(db);
  res.json({ ok: true, winner: record });
});

app.get('/api/winners', (req, res) => {
  const db = loadDB();
  res.json({ winners: db.winners.slice().reverse() });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n  IndianOil Lucky Draw running:`);
  console.log(`   Entry form   ->  http://localhost:${PORT}/`);
  console.log(`   Admin panel  ->  http://localhost:${PORT}/admin.html\n`);
});
