/**
 * Donor CSV Preparation Script
 *
 * Input  : raw CSV export (any of these column formats are supported)
 * Output : donors-ready.csv — ready to bulk upload via web app
 *
 * Usage:
 *   node scripts/prepare-csv.js <input-file.csv>
 *
 * Example:
 *   node scripts/prepare-csv.js raw-data.csv
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node scripts/prepare-csv.js <input-file.csv>');
  process.exit(1);
}

// ─── Source normalisation ─────────────────────────────────────────────────────
const SOURCE_MAP = {
  facebook: 'facebook',
  fb: 'facebook',
  google: 'google',
  youtube: 'youtube',
  instagram: 'instagram',
  ig: 'instagram',
  tiktok: 'tiktok',
  website: 'website',
  web: 'website',
  'lain-lain': 'other',
  lain: 'other',
  drm: 'other',
  crm: 'other',
  manual: 'other',
};

const normalizeSource = (s) => SOURCE_MAP[(s || '').trim().toLowerCase()] || (s?.trim() ? 'other' : '');

// ─── Date normalisation ───────────────────────────────────────────────────────
// Accepts: MM-DD-YYYY, MM/DD/YYYY, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
const normalizeDate = (raw) => {
  const d = (raw || '').trim().replace(/\//g, '-');
  const p = d.split('-');
  if (p.length !== 3) return '';

  // Already YYYY-MM-DD
  if (p[0].length === 4) return d;

  // MM-DD-YYYY (US format — day never > 12 ambiguity resolved by source data)
  if (p[2].length === 4) {
    return `${p[2]}-${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}`;
  }

  return '';
};

// ─── Amount normalisation ─────────────────────────────────────────────────────
const normalizeAmount = (a) => {
  const n = parseFloat((a || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : '';
};

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const parseLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      values.push(current); current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
};

const fmtCsv = (v) => {
  const s = String(v ?? '');
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ─── Column aliases ───────────────────────────────────────────────────────────
// Maps various column names from different raw exports to standard names
const COLUMN_ALIASES = {
  name:          ['name', 'full_name', 'fullname', 'nama', 'nama penuh', 'customer_name', 'donor_name'],
  phone:         ['phone', 'telefon', 'tel', 'mobile', 'no_telefon', 'phone_number'],
  email:         ['email', 'emel', 'email_address'],
  donation_date: ['donation_date', 'order_date', 'date', 'tarikh', 'tarikh_sumbangan', 'transaction_date'],
  amount:        ['amount', 'jumlah', 'amaun', 'total', 'price', 'value'],
  source:        ['source', 'sumber', 'channel'],
  campaign:      ['campaign', 'kempen', 'campaign_name'],
};

const resolveHeader = (rawHeader) => {
  const map = {};
  rawHeader.forEach((col, i) => {
    const key = col.trim().toLowerCase();
    for (const [std, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(key)) { map[std] = i; break; }
    }
  });
  return map;
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const raw = readFileSync(inputFile, 'utf-8');
const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

if (lines.length < 2) {
  console.error('CSV must have a header row and at least one data row.');
  process.exit(1);
}

const headerRaw = parseLine(lines[0]);
const colMap = resolveHeader(headerRaw);

const required = ['name', 'donation_date', 'amount'];
const missing = required.filter(f => colMap[f] === undefined);
if (missing.length > 0) {
  console.error(`Missing required columns: ${missing.join(', ')}`);
  console.error(`Found columns: ${headerRaw.join(', ')}`);
  process.exit(1);
}

const OUTPUT_HEADER = ['name', 'phone', 'email', 'donation_date', 'amount', 'source', 'campaign'];
const out = [OUTPUT_HEADER.join(',')];

let skipped = 0;
const skipReasons = {};

for (let i = 1; i < lines.length; i++) {
  const cols = parseLine(lines[i]);
  const get = (field) => (colMap[field] !== undefined ? (cols[colMap[field]] || '').trim() : '');

  const name         = get('name') || 'Unknown';
  const phone        = get('phone');
  const email        = get('email');
  const donationDate = normalizeDate(get('donation_date'));
  const amount       = normalizeAmount(get('amount'));
  const source       = normalizeSource(get('source'));
  const campaign     = get('campaign');

  if (!donationDate) { skipped++; skipReasons['invalid date'] = (skipReasons['invalid date'] || 0) + 1; continue; }
  if (!amount)       { skipped++; skipReasons['invalid amount'] = (skipReasons['invalid amount'] || 0) + 1; continue; }

  out.push([name, phone, email, donationDate, amount, source, campaign].map(fmtCsv).join(','));
}

const outputName = path.join(path.dirname(inputFile), 'donors-ready.csv');
writeFileSync(outputName, out.join('\n'), 'utf-8');

console.log('');
console.log('✓ Done!');
console.log(`  Input rows   : ${lines.length - 1}`);
console.log(`  Output rows  : ${out.length - 1}`);
console.log(`  Skipped      : ${skipped}`);
if (Object.keys(skipReasons).length > 0) {
  Object.entries(skipReasons).forEach(([r, c]) => console.log(`    - ${r}: ${c} rows`));
}
console.log(`  Output file  : ${outputName}`);
console.log('');
console.log('Upload via: Add Donation → Import donations from CSV → select donors-ready.csv');
