import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { supabase, initDb } from './db/db.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));

await initDb();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ihsanku.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'supersecret-admin-token';
const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.ADMIN_TOKEN || 'supersecret-admin-token';

// ─── Auth helpers ────────────────────────────────────────────────────────────

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const derivedHash = scryptSync(password, salt, 64).toString('hex');
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derivedHash, 'hex'));
  } catch {
    return false;
  }
}

function generateToken(userId, email, role) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { userId, email, role, iat: now, exp: now + 30 * 24 * 60 * 60 };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', TOKEN_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = createHmac('sha256', TOKEN_SECRET).update(payloadB64).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

const ROLE_LEVEL = { admin: 4, manager: 3, editor: 2, viewer: 1 };

function requireAuth(minRole = 'viewer') {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Legacy token support
    if (token === ADMIN_TOKEN) {
      req.user = { userId: 0, email: ADMIN_EMAIL, role: 'admin' };
      return next();
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Token tidak sah atau telah tamat tempoh.' });
    }

    const userLevel = ROLE_LEVEL[payload.role] || 0;
    const minLevel = ROLE_LEVEL[minRole] || 1;
    if (userLevel < minLevel) {
      return res.status(403).json({ error: 'Akses ditolak. Peranan tidak mencukupi.' });
    }

    req.user = payload;
    next();
  };
}

// ─── Helper functions ─────────────────────────────────────────────────────────

// Maps a donors row to the shape the frontend expects (uses full_name, not name)
function parseDonorRow(row) {
  return {
    id: row.id,
    full_name: row.name || row.full_name || '',
    phone: row.phone || '',
    email: row.email || '',
    source: row.source || '',
    campaign: row.campaign || '',
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    total_orders: row.total_orders || 0,
    total_spent: row.total_spent || 0,
    first_purchase_date: row.first_purchase_date || null,
    last_purchase_date: row.last_purchase_date || null,
    ltv: row.total_spent || 0,
    aov: row.total_orders ? Number(((row.total_spent || 0) / row.total_orders).toFixed(2)) : 0,
    status: row.status || 'new'
  };
}

function computeStatus(lastDonationDate, totalDonations) {
  if (!lastDonationDate || totalDonations === 0) return 'new';
  const daysSince = Math.floor((new Date() - new Date(lastDonationDate)) / (1000 * 60 * 60 * 24));
  if (daysSince > 180) return 'churn';
  if (daysSince > 90) return 'dormant';
  if (totalDonations >= 2) return 'repeat';
  return 'active';
}

function buildDonationStats(donations) {
  const stats = {};
  donations.forEach((donation) => {
    const donorId = donation.donor_id;
    if (!stats[donorId]) {
      stats[donorId] = {
        total_orders: 0,
        total_spent: 0,
        first_purchase_date: null,
        last_purchase_date: null,
        source: donation.source || 'manual'
      };
    }

    const s = stats[donorId];
    const amount = Number(donation.amount) || 0;
    s.total_orders += 1;
    s.total_spent += amount;
    s.source = donation.source || s.source;

    const date = donation.donation_date;
    if (!s.first_purchase_date || date < s.first_purchase_date) s.first_purchase_date = date;
    if (!s.last_purchase_date || date > s.last_purchase_date) s.last_purchase_date = date;
  });

  return stats;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(csvText) {
  const expectedHeaders = ['name', 'phone', 'email', 'donation_date', 'amount', 'source', 'campaign'];
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV mesti mempunyai baris tajuk dan sekurang-kurangnya satu baris rekod.');
  }

  const header = parseCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
  if (header.length !== expectedHeaders.length || expectedHeaders.some((column, index) => header[index] !== column)) {
    throw new Error(`Tajuk CSV mesti: ${expectedHeaders.join(', ')}.`);
  }

  return lines.slice(1).map((line, index) => {
    const row = parseCsvLine(line);
    if (row.length !== expectedHeaders.length) {
      throw new Error(`Baris ${index + 2} tidak mempunyai ${expectedHeaders.length} lajur.`);
    }
    return expectedHeaders.reduce((acc, column, columnIndex) => {
      acc[column] = row[columnIndex]?.trim() || '';
      return acc;
    }, {});
  });
}

// Upsert a donor by phone/email, return { donorId, isNew, donor }
async function upsertDonor({ name, phone, email }) {
  let existing = null;

  if (phone) {
    const { data } = await supabase.from('donors').select('*').eq('phone', phone).limit(1);
    existing = (data && data.length > 0) ? data[0] : null;
  }
  if (!existing && email) {
    const { data } = await supabase.from('donors').select('*').eq('email', email).limit(1);
    existing = (data && data.length > 0) ? data[0] : null;
  }

  if (existing) {
    return { donorId: existing.id, isNew: false, donor: existing };
  }

  const now = new Date().toISOString();
  const { data: newDonor } = await supabase.from('donors').insert([{
    name: name || 'Unknown',
    phone: phone || null,
    email: email || null,
    created_at: now
  }]).select('*').single();

  return { donorId: newDonor?.id, isNew: true, donor: newDonor };
}

// ─── Inbound log helper ───────────────────────────────────────────────────────

async function logInbound(event) {
  try {
    await supabase.from('webhook_logs').insert([{
      event,
      status: 'success',
      response_code: 200,
      created_at: new Date().toISOString()
    }]);
  } catch { /* nullable FK — ignore if column constraint blocks it */ }
}

// ─── Outbound Webhooks ────────────────────────────────────────────────────────

async function fireWebhooks(event, data) {
  try {
    const { data: webhooks } = await supabase.from('webhooks').select('*').eq('active', true);
    if (!webhooks || webhooks.length === 0) return;

    const matching = webhooks.filter((wh) => {
      const events = (wh.events || '').split(',').map((e) => e.trim());
      return events.includes('*') || events.includes(event);
    });

    for (const wh of matching) {
      const payload = { event, data, timestamp: new Date().toISOString() };
      const headers = { 'Content-Type': 'application/json' };
      if (wh.secret) {
        headers['X-Webhook-Secret'] = wh.secret;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      let status = 'error';
      let responseCode = null;

      try {
        const resp = await fetch(wh.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        responseCode = resp.status;
        status = resp.ok ? 'success' : 'error';
      } catch {
        status = 'error';
      } finally {
        clearTimeout(timeout);
      }

      await supabase.from('webhook_logs').insert([{
        webhook_id: wh.id,
        event,
        status,
        response_code: responseCode,
        created_at: new Date().toISOString()
      }]);
    }
  } catch {
    // fire-and-forget, swallow errors
  }
}

// ─── Public routes (no auth) ──────────────────────────────────────────────────

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan kata laluan diperlukan.' });
  }

  // Try users table first
  const { data: userRow } = await supabase.from('users').select('*').eq('email', email).maybeSingle();

  if (userRow) {
    if (!userRow.active) {
      return res.status(401).json({ error: 'Akaun tidak aktif.' });
    }
    if (!verifyPassword(password, userRow.password_hash)) {
      return res.status(401).json({ error: 'Emel atau kata laluan tidak sah.' });
    }
    const token = generateToken(userRow.id, userRow.email, userRow.role);
    return res.json({
      token,
      user: { id: userRow.id, email: userRow.email, full_name: userRow.full_name, role: userRow.role }
    });
  }

  // Fallback: env var credentials
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({
      token: ADMIN_TOKEN,
      user: { id: 0, email: ADMIN_EMAIL, full_name: 'Admin', role: 'admin' }
    });
  }

  return res.status(401).json({ error: 'Emel atau kata laluan tidak sah.' });
});

// Inbound webhook – receive generic JSON
app.post('/api/webhooks/receive/:secret', async (req, res) => {
  const { secret } = req.params;
  const body = req.body || {};
  const now = new Date().toISOString();

  const name = body.name || body.full_name || body.customer_name || 'Unknown';
  const phone = body.phone || body.mobile || '';
  const email = body.email || '';
  const amount = Number(body.amount || body.total || body.price || 0);
  const donationDate = body.date || body.donation_date || body.order_date || now.slice(0, 10);
  const source = body.source || `webhook:${secret}`;

  const { donorId, isNew, donor } = await upsertDonor({ name, phone, email });

  if (isNew) fireWebhooks('donor.created', donor);

  const { data: newDonation } = await supabase.from('donations').insert([{
    donor_id: donorId,
    donation_date: donationDate,
    amount,
    source,
    created_at: now
  }]).select('*').single();

  fireWebhooks('donation.created', newDonation);

  logInbound('inbound.receive');
  res.json({ success: true, donor_id: donorId, new_donor: isNew });
});

// Shopify integration
app.post('/api/integrations/shopify', async (req, res) => {
  const order = req.body || {};
  const now = new Date().toISOString();
  const customer = order.customer || {};
  const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown';
  const phone = customer.phone || '';
  const email = customer.email || '';
  const amount = Number(order.total_price || 0);
  const donationDate = order.created_at ? order.created_at.slice(0, 10) : now.slice(0, 10);
  const source = order.source_name || 'shopify';

  const { donorId, isNew, donor } = await upsertDonor({ name, phone, email });

  if (isNew) fireWebhooks('donor.created', donor);

  const { data: newDonation } = await supabase.from('donations').insert([{
    donor_id: donorId,
    donation_date: donationDate,
    amount,
    source,
    created_at: now
  }]).select('*').single();

  fireWebhooks('donation.created', newDonation);

  logInbound('inbound.shopify');
  res.json({ success: true, donor_id: donorId, new_donor: isNew });
});

// WooCommerce integration
app.post('/api/integrations/woocommerce', async (req, res) => {
  const order = req.body || {};
  const now = new Date().toISOString();
  const billing = order.billing || {};
  const name = `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Unknown';
  const phone = billing.phone || '';
  const email = billing.email || '';
  const amount = Number(order.total || 0);
  const donationDate = order.date_created ? order.date_created.slice(0, 10) : now.slice(0, 10);

  const { donorId, isNew, donor } = await upsertDonor({ name, phone, email });

  if (isNew) fireWebhooks('donor.created', donor);

  const { data: newDonation } = await supabase.from('donations').insert([{
    donor_id: donorId,
    donation_date: donationDate,
    amount,
    source: 'woocommerce',
    created_at: now
  }]).select('*').single();

  fireWebhooks('donation.created', newDonation);

  logInbound('inbound.woocommerce');
  res.json({ success: true, donor_id: donorId, new_donor: isNew });
});

// Generic integration
app.post('/api/integrations/generic', async (req, res) => {
  const body = req.body || {};
  const now = new Date().toISOString();
  const name = body.name || body.full_name || 'Unknown';
  const phone = body.phone || body.mobile || '';
  const email = body.email || '';
  const amount = Number(body.amount || body.total || body.price || 0);
  const donationDate = body.date || body.donation_date || body.order_date || now.slice(0, 10);
  const source = body.source || 'generic';

  const { donorId, isNew, donor } = await upsertDonor({ name, phone, email });

  if (isNew) fireWebhooks('donor.created', donor);

  const { data: newDonation } = await supabase.from('donations').insert([{
    donor_id: donorId,
    donation_date: donationDate,
    amount,
    source,
    created_at: now
  }]).select('*').single();

  fireWebhooks('donation.created', newDonation);

  logInbound('inbound.generic');
  res.json({ success: true, donor_id: donorId, new_donor: isNew });
});

// ─── Protected routes ─────────────────────────────────────────────────────────

app.use('/api', requireAuth('viewer'));

// ─── User management ──────────────────────────────────────────────────────────

app.get('/api/users/me', (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/users', requireAuth('admin'), async (req, res) => {
  const { data, error } = await supabase.from('users').select('id, email, full_name, role, active, created_at, updated_at').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/users', requireAuth('admin'), async (req, res) => {
  const { email, password, full_name, role } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Emel, kata laluan dan nama penuh diperlukan.' });
  }
  const validRoles = ['admin', 'manager', 'editor', 'viewer'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Peranan tidak sah.' });
  }

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) return res.status(400).json({ error: 'Emel sudah digunakan.' });

  const now = new Date().toISOString();
  const password_hash = hashPassword(password);

  const { data, error } = await supabase.from('users').insert([{
    email, password_hash, full_name, role: role || 'viewer', active: true, created_at: now, updated_at: now
  }]).select('id, email, full_name, role, active, created_at, updated_at').single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/users/:id', requireAuth('admin'), async (req, res) => {
  const id = req.params.id;
  const { full_name, role, active, password } = req.body;

  const now = new Date().toISOString();
  const updates = { updated_at: now };
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (active !== undefined) updates.active = active;
  if (password) updates.password_hash = hashPassword(password);

  const { error } = await supabase.from('users').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  const { data } = await supabase.from('users').select('id, email, full_name, role, active, created_at, updated_at').eq('id', id).single();
  res.json(data);
});

app.delete('/api/users/:id', requireAuth('admin'), async (req, res) => {
  const id = req.params.id;
  const now = new Date().toISOString();
  const { error } = await supabase.from('users').update({ active: false, updated_at: now }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Webhook management ───────────────────────────────────────────────────────

app.get('/api/webhooks', requireAuth('manager'), async (req, res) => {
  const { data, error } = await supabase.from('webhooks').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/webhooks', requireAuth('manager'), async (req, res) => {
  const { name, url, events, secret } = req.body;
  if (!name || !url || !events) {
    return res.status(400).json({ error: 'Nama, URL dan acara diperlukan.' });
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('webhooks').insert([{
    name, url, events, secret: secret || null, active: true, created_at: now
  }]).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/webhooks/:id', requireAuth('manager'), async (req, res) => {
  const id = req.params.id;
  const { name, url, events, secret, active } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (url !== undefined) updates.url = url;
  if (events !== undefined) updates.events = events;
  if (secret !== undefined) updates.secret = secret;
  if (active !== undefined) updates.active = active;

  const { error } = await supabase.from('webhooks').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  const { data } = await supabase.from('webhooks').select('*').eq('id', id).single();
  res.json(data);
});

app.delete('/api/webhooks/:id', requireAuth('manager'), async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from('webhooks').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get('/api/webhooks/logs', requireAuth('manager'), async (req, res) => {
  const { data, error } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ─── Staff (uses users table) ─────────────────────────────────────────────────

function parseStaffRow(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role || 'viewer',
    active: row.active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

app.get('/api/staff', async (req, res) => {
  const { data, error } = await supabase.from('users').select('id, full_name, email, role, active, created_at, updated_at').order('created_at', { ascending: false });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json((data || []).map(parseStaffRow));
});

app.post('/api/staff', requireAuth('manager'), async (req, res) => {
  const { full_name, email, role } = req.body;
  if (!full_name || !email) {
    return res.status(400).json({ error: 'Nama dan emel diperlukan.' });
  }

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) {
    return res.status(400).json({ error: 'Emel sudah digunakan.' });
  }

  const now = new Date().toISOString();
  // Generate a temporary password (user should reset via admin panel)
  const tempPassword = randomBytes(8).toString('hex');
  const password_hash = hashPassword(tempPassword);

  const { data, error } = await supabase.from('users').insert([{
    full_name,
    email,
    password_hash,
    role: role || 'viewer',
    active: true,
    created_at: now,
    updated_at: now
  }]).select('id, full_name, email, role, active, created_at, updated_at').single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(parseStaffRow(data));
});

// ─── donor_summary row mapper ─────────────────────────────────────────────────

function parseSummaryRow(row) {
  // Column names from Supabase donor_summary table
  const total_orders = Number(row.kekerapan ?? row.total_donations ?? row.donation_count ?? 0);
  const total_spent = Number(row.jumlah_keseluruhan ?? row.total_amount ?? row.total_spent ?? 0);
  const first_date = row.tarikh_sumbangan_terdahulu ?? row.first_donation_date ?? null;
  const last_date = row.tarikh_sumbangan_terkini ?? row.last_donation_date ?? null;
  const aov = Number(row.aov ?? (total_orders > 0 ? (total_spent / total_orders).toFixed(2) : 0));
  const ltv = Number(row.ltv ?? total_spent);

  return {
    id: row.id ?? row.donor_id,
    full_name: row.nama ?? row.name ?? row.full_name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    source: row.source ?? '',
    campaign: row.campaign ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    total_orders,
    total_spent,
    first_purchase_date: first_date,
    last_purchase_date: last_date,
    ltv,
    aov,
    highvalue: row.highvalue ?? 'Tidak',
    status: computeStatus(last_date, total_orders)
  };
}

// ─── Summary ──────────────────────────────────────────────────────────────────

app.get('/api/summary', async (req, res) => {
  // Get total donor count without fetching all rows
  const { count: totalCount, error: countError } = await supabase
    .from('donor_summary')
    .select('*', { count: 'exact', head: true });

  if (countError) return res.status(500).json({ error: countError.message });

  // Paginate through all rows to compute accurate aggregate totals
  let totalCollection = 0;
  let totalTransactions = 0;
  const statusCounts = { active: 0, repeat: 0, dormant: 0, churn: 0, new: 0 };
  const batchSize = 1000;

  for (let offset = 0; offset < (totalCount || 0); offset += batchSize) {
    const { data: batch, error: batchError } = await supabase
      .from('donor_summary')
      .select('kekerapan, jumlah_keseluruhan, tarikh_sumbangan_terkini')
      .range(offset, offset + batchSize - 1);

    if (batchError) return res.status(500).json({ error: batchError.message });

    (batch || []).forEach((row) => {
      const kekerapan = Number(row.kekerapan || 0);
      totalCollection += Number(row.jumlah_keseluruhan || 0);
      totalTransactions += kekerapan;
      const status = computeStatus(row.tarikh_sumbangan_terkini, kekerapan);
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
  }

  const avgDonationValue = totalTransactions > 0
    ? Number((totalCollection / totalTransactions).toFixed(2))
    : 0;

  res.json({
    total: totalCount || 0,
    total_collection: Number(totalCollection.toFixed(2)),
    total_transactions: totalTransactions,
    avg_order_value: avgDonationValue,
    ...statusCounts
  });
});

// ─── Donation chart (monthly aggregation) ────────────────────────────────────

app.get('/api/donations/chart', async (req, res) => {
  const { from_date, to_date } = req.query;

  let countQuery = supabase.from('donations').select('*', { count: 'exact', head: true });
  if (from_date) countQuery = countQuery.gte('donation_date', from_date);
  if (to_date) countQuery = countQuery.lte('donation_date', to_date);

  const { count: totalCount, error: countError } = await countQuery;
  if (countError) return res.status(500).json({ error: countError.message });

  const monthlyTotals = {};
  const batchSize = 1000;

  for (let offset = 0; offset < (totalCount || 0); offset += batchSize) {
    let query = supabase
      .from('donations')
      .select('donation_date, amount')
      .order('donation_date', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (from_date) query = query.gte('donation_date', from_date);
    if (to_date) query = query.lte('donation_date', to_date);

    const { data: batch, error: batchError } = await query;
    if (batchError) return res.status(500).json({ error: batchError.message });

    (batch || []).forEach((d) => {
      if (!d.donation_date) return;
      const date = new Date(d.donation_date);
      const key = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthlyTotals[key] = (monthlyTotals[key] || 0) + Number(d.amount || 0);
    });
  }

  const entries = Object.entries(monthlyTotals).sort(
    (a, b) => new Date(a[0]) - new Date(b[0])
  );

  res.json(entries.map(([label, value]) => ({ label, value })));
});

// ─── Customers (donors) ───────────────────────────────────────────────────────

app.get('/api/customers', async (req, res) => {
  const { search, status, source, from_date, to_date } = req.query;
  let page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let perPage = Math.min(200, Math.max(1, parseInt(req.query.per_page, 10) || 50));

  // Build query with filters pushed to Supabase
  let query = supabase.from('donor_summary').select('*', { count: 'exact' });

  if (search) {
    query = query.or(`nama.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  if (from_date) {
    query = query.gte('tarikh_sumbangan_terkini', from_date);
  }

  if (to_date) {
    query = query.lte('tarikh_sumbangan_terkini', to_date);
  }

  // Apply DB-level pagination
  const rangeStart = (page - 1) * perPage;
  const rangeEnd = rangeStart + perPage - 1;
  query = query.range(rangeStart, rangeEnd);

  const { data: summaryRows, count, error: summaryError } = await query;
  if (summaryError) {
    return res.status(500).json({ error: summaryError.message });
  }

  let customers = (summaryRows || []).map(parseSummaryRow);

  // Status filter is computed (not stored), apply client-side on current page
  if (status && status !== 'all') {
    customers = customers.filter((c) => c.status === status);
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / perPage) || 1;

  res.json({ customers, total, page, per_page: perPage, total_pages: totalPages });
});

app.get('/api/customers/:id', async (req, res) => {
  const id = req.params.id;

  const { data: donorRow, error: donorError } = await supabase.from('donors').select('*').eq('id', id).single();
  if (donorError || !donorRow) {
    return res.status(404).json({ error: 'Donor not found' });
  }

  const { data: donations, error: donationsError } = await supabase.from('donations').select('*').eq('donor_id', id).order('donation_date', { ascending: false });
  if (donationsError) {
    return res.status(500).json({ error: donationsError.message });
  }

  const stats = buildDonationStats(donations || [])[id] || { total_orders: 0, total_spent: 0, first_purchase_date: null, last_purchase_date: null };
  const customer = parseDonorRow({ ...donorRow, ...stats });
  customer.status = computeStatus(stats.last_purchase_date, stats.total_orders);

  res.json({
    customer,
    orders: (donations || []).map((d) => ({
      ...d,
      order_date: d.donation_date,
      customer_id: d.donor_id,
      campaign_name: d.campaign_name || null
    }))
  });
});

app.put('/api/customers/:id', requireAuth('editor'), async (req, res) => {
  const id = req.params.id;
  const { full_name, phone, email } = req.body;

  if (!full_name) {
    return res.status(400).json({ error: 'full_name is required' });
  }

  const { data: existing, error: existingError } = await supabase.from('donors').select('*').eq('id', id).single();
  if (existingError || !existing) {
    return res.status(404).json({ error: 'Donor not found' });
  }

  const { error: updateError } = await supabase.from('donors').update({
    name: full_name,
    phone: phone || '',
    email: email || ''
  }).eq('id', id);

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  const { data: updated } = await supabase.from('donors').select('*').eq('id', id).single();
  res.json({ customer: parseDonorRow(updated) });
});

// ─── Orders (donations) ───────────────────────────────────────────────────────

app.get('/api/orders', async (req, res) => {
  const { data: donations, error } = await supabase.from('donations').select('*').order('donation_date', { ascending: false });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const donorIds = [...new Set((donations || []).map((d) => d.donor_id).filter(Boolean))];
  let donorMap = {};

  if (donorIds.length > 0) {
    const { data: donors } = await supabase.from('donors').select('id, name, phone, email');
    (donors || []).forEach((d) => { donorMap[d.id] = d; });
  }

  res.json((donations || []).map((donation) => ({
    ...donation,
    order_date: donation.donation_date,
    customer_id: donation.donor_id,
    customer_name: donorMap[donation.donor_id]?.name || null,
    phone: donorMap[donation.donor_id]?.phone || null,
    email: donorMap[donation.donor_id]?.email || null
  })));
});

app.post('/api/orders', requireAuth('editor'), async (req, res) => {
  const { customer, order_date, donation_date, amount, source, campaign } = req.body;
  const finalDate = donation_date || order_date;
  if (!finalDate || !amount) {
    return res.status(400).json({ error: 'donation_date and amount are required' });
  }

  const { full_name, phone, email } = customer || {};
  const now = new Date().toISOString();

  const { donorId, isNew, donor } = await upsertDonor({ name: full_name, phone, email });

  if (isNew) fireWebhooks('donor.created', donor);

  const { data: newDonation, error: donationInsertError } = await supabase.from('donations').insert([{
    donor_id: donorId,
    donation_date: finalDate,
    amount: Number(amount),
    source: source || null,
    campaign_name: campaign || null,
    created_at: now
  }]).select('*').single();

  if (donationInsertError) {
    return res.status(500).json({ error: donationInsertError.message });
  }

  fireWebhooks('donation.created', newDonation);

  const { data: detail } = await supabase.from('donors').select('*').eq('id', donorId).single();
  res.json({ success: true, customer: detail ? parseDonorRow(detail) : null });
});

app.post('/api/orders/bulk-upload', requireAuth('editor'), async (req, res) => {
  const { csv } = req.body;
  if (!csv) {
    return res.status(400).json({ error: 'CSV diperlukan untuk muat naik berkumpulan.' });
  }

  let records;
  try {
    records = parseCsv(String(csv));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  // Validate all rows first before touching the database
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const lineNumber = i + 2;
    if (!row.name || !row.donation_date || !row.amount) {
      return res.status(400).json({ error: `Row ${lineNumber} must have name, donation_date and amount.` });
    }
    if (Number.isNaN(Number(row.amount))) {
      return res.status(400).json({ error: `Invalid amount at row ${lineNumber}.` });
    }
  }

  const now = new Date().toISOString();

  // Step 1: Load all existing donors into memory (phone + email maps)
  const { data: existingDonors } = await supabase.from('donors').select('id, phone, email');
  const phoneMap = {};
  const emailMap = {};
  (existingDonors || []).forEach((d) => {
    if (d.phone) phoneMap[d.phone.trim()] = d.id;
    if (d.email) emailMap[d.email.trim().toLowerCase()] = d.id;
  });

  // Step 2: Resolve donor IDs, collect new donors to insert
  const newDonors = [];
  const rowDonorKeys = [];

  const resolveMapVal = (val) => {
    if (!val) return null;
    if (typeof val === 'number') return { type: 'new', idx: val };
    return { type: 'existing', id: val };
  };

  for (const row of records) {
    const phone = (row.phone || '').trim();
    const email = (row.email || '').trim().toLowerCase();
    const phoneKey = phone || null;
    const emailKey = email || null;

    const fromPhone = phoneKey ? phoneMap[phoneKey] : undefined;
    const fromEmail = emailKey ? emailMap[emailKey] : undefined;
    const match = fromPhone !== undefined ? fromPhone : fromEmail;

    if (match !== undefined) {
      rowDonorKeys.push(resolveMapVal(match));
    } else {
      const idx = newDonors.length;
      newDonors.push({ name: row.name || 'Unknown', phone: phoneKey || null, email: emailKey || null, created_at: now });
      rowDonorKeys.push({ type: 'new', idx });
      // Store idx (number) so resolveMapVal knows it's a pending new donor
      if (phoneKey) phoneMap[phoneKey] = idx;
      if (emailKey) emailMap[emailKey] = idx;
    }
  }

  // Step 3: Batch insert new donors in chunks of 500
  const insertedDonors = [];
  const CHUNK = 500;
  for (let i = 0; i < newDonors.length; i += CHUNK) {
    const chunk = newDonors.slice(i, i + CHUNK);
    const { data, error } = await supabase.from('donors').insert(chunk).select('id');
    if (error) return res.status(500).json({ error: `Insert donors: ${error.message}` });
    insertedDonors.push(...(data || []));
  }

  // Step 4: Build final donor ID list per row
  const donorIds = rowDonorKeys.map((k) => {
    if (k.type === 'existing') return k.id;
    return insertedDonors[k.idx]?.id ?? null;
  });

  // Step 5: Build donations array and batch insert in chunks of 500
  const donationRows = records.map((row, i) => ({
    donor_id: donorIds[i],
    donation_date: row.donation_date,
    amount: Number(row.amount),
    source: row.source || null,
    campaign_name: row.campaign || null,
    created_at: now
  }));

  let imported = 0;
  for (let i = 0; i < donationRows.length; i += CHUNK) {
    const chunk = donationRows.slice(i, i + CHUNK);
    const { error } = await supabase.from('donations').insert(chunk);
    if (error) return res.status(500).json({ error: `Insert donations: ${error.message}` });
    imported += chunk.length;
  }

  res.json({ success: true, imported });
});

// ─── Donor notes ─────────────────────────────────────────────────────────────

app.get('/api/customers/:id/notes', async (req, res) => {
  const { data, error } = await supabase.from('donor_notes')
    .select('*').eq('donor_id', req.params.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/customers/:id/notes', requireAuth('editor'), async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content is required.' });
  const { data, error } = await supabase.from('donor_notes').insert([{
    donor_id: req.params.id,
    content: content.trim(),
    created_by: req.user.full_name || req.user.email || 'staff',
    created_at: new Date().toISOString()
  }]).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/customers/:id/notes/:noteId', requireAuth('editor'), async (req, res) => {
  const { error } = await supabase.from('donor_notes')
    .delete().eq('id', req.params.noteId).eq('donor_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Duplicate detection & merge ──────────────────────────────────────────────

app.get('/api/donors/duplicates', requireAuth('manager'), async (req, res) => {
  const { data: donors, error } = await supabase
    .from('donors').select('id, name, phone, email, created_at').limit(5000);
  if (error) return res.status(500).json({ error: error.message });

  const pairs = [];
  const seen = new Set();

  const addPair = (a, b, reason) => {
    const key = [a.id, b.id].sort().join(':');
    if (!seen.has(key)) { seen.add(key); pairs.push({ donor_a: a, donor_b: b, reason }); }
  };

  const phoneGroups = {};
  const emailGroups = {};
  const nameGroups = {};

  donors.forEach((d) => {
    if (d.phone?.trim()) {
      const k = d.phone.trim().replace(/\D/g, '');
      if (k.length >= 7) { if (!phoneGroups[k]) phoneGroups[k] = []; phoneGroups[k].push(d); }
    }
    if (d.email?.trim()) {
      const k = d.email.trim().toLowerCase();
      if (!emailGroups[k]) emailGroups[k] = []; emailGroups[k].push(d);
    }
    if (d.name?.trim()) {
      const k = d.name.trim().toLowerCase();
      if (!nameGroups[k]) nameGroups[k] = []; nameGroups[k].push(d);
    }
  });

  for (const group of Object.values(phoneGroups)) {
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) addPair(group[i], group[j], 'Same phone');
  }
  for (const group of Object.values(emailGroups)) {
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) addPair(group[i], group[j], 'Same email');
  }
  for (const group of Object.values(nameGroups)) {
    if (group.length >= 2 && group.length <= 10) {
      for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) addPair(group[i], group[j], 'Same name');
    }
  }

  const allIds = [...new Set(pairs.flatMap((p) => [p.donor_a.id, p.donor_b.id]))];
  const donationCounts = {};
  if (allIds.length > 0) {
    const { data: donations } = await supabase.from('donations').select('donor_id').in('donor_id', allIds);
    (donations || []).forEach((d) => { donationCounts[d.donor_id] = (donationCounts[d.donor_id] || 0) + 1; });
  }

  res.json(pairs.slice(0, 200).map((p) => ({
    ...p,
    donor_a: { ...p.donor_a, full_name: p.donor_a.name, donation_count: donationCounts[p.donor_a.id] || 0 },
    donor_b: { ...p.donor_b, full_name: p.donor_b.name, donation_count: donationCounts[p.donor_b.id] || 0 },
  })));
});

app.post('/api/donors/merge', requireAuth('manager'), async (req, res) => {
  const { keep_id, delete_id } = req.body;
  if (!keep_id || !delete_id) return res.status(400).json({ error: 'keep_id and delete_id required.' });
  if (keep_id === delete_id) return res.status(400).json({ error: 'Cannot merge a donor with itself.' });

  const { error: donErr } = await supabase.from('donations').update({ donor_id: keep_id }).eq('donor_id', delete_id);
  if (donErr) return res.status(500).json({ error: donErr.message });

  await supabase.from('donor_notes').update({ donor_id: keep_id }).eq('donor_id', delete_id).catch(() => {});

  const { error: delErr } = await supabase.from('donors').delete().eq('id', delete_id);
  if (delErr) return res.status(500).json({ error: delErr.message });

  res.json({ success: true });
});

// ─── Top donors ──────────────────────────────────────────────────────────────

app.get('/api/top-donors', async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const campaign = req.query.campaign || '';

  if (campaign) {
    const { data: donations, error } = await supabase
      .from('donations').select('donor_id, amount').eq('campaign_name', campaign).limit(10000);
    if (error) return res.status(500).json({ error: error.message });

    const totals = {};
    const counts = {};
    (donations || []).forEach((d) => {
      if (!d.donor_id) return;
      totals[d.donor_id] = (totals[d.donor_id] || 0) + Number(d.amount || 0);
      counts[d.donor_id] = (counts[d.donor_id] || 0) + 1;
    });

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit);
    if (sorted.length === 0) return res.json([]);

    const ids = sorted.map(([id]) => id);
    const { data: donors } = await supabase.from('donors').select('id, name, email').in('id', ids);
    const donorMap = {};
    (donors || []).forEach((d) => { donorMap[d.id] = d; });

    return res.json(sorted.map(([id, total], i) => ({
      rank: i + 1,
      donor_id: id,
      full_name: donorMap[id]?.name || 'Unknown',
      email: donorMap[id]?.email || '',
      total_spent: Number(total.toFixed(2)),
      total_orders: counts[id] || 0,
    })));
  }

  const { data, error } = await supabase
    .from('donor_summary')
    .select('id, nama, email, jumlah_keseluruhan, kekerapan')
    .order('jumlah_keseluruhan', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map((row, i) => ({
    rank: i + 1,
    donor_id: row.id,
    full_name: row.nama || '',
    email: row.email || '',
    total_spent: Number(row.jumlah_keseluruhan || 0),
    total_orders: Number(row.kekerapan || 0),
  })));
});

// ─── Campaign list ────────────────────────────────────────────────────────────

app.get('/api/campaigns', async (req, res) => {
  const { data, error } = await supabase
    .from('donations').select('campaign_name').not('campaign_name', 'is', null).neq('campaign_name', '').limit(2000);
  if (error) return res.status(500).json({ error: error.message });
  const unique = [...new Set((data || []).map((d) => d.campaign_name))].sort();
  res.json(unique);
});

// ─── Campaign chart ───────────────────────────────────────────────────────────

app.get('/api/donations/campaign-chart', async (req, res) => {
  const { from_date, to_date } = req.query;

  let query = supabase.from('donations').select('campaign_name, amount').limit(10000);
  if (from_date) query = query.gte('donation_date', from_date);
  if (to_date) query = query.lte('donation_date', to_date);

  const { data: donations, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const totals = {};
  const counts = {};
  (donations || []).forEach((d) => {
    const key = d.campaign_name || 'Uncategorized';
    totals[key] = (totals[key] || 0) + Number(d.amount || 0);
    counts[key] = (counts[key] || 0) + 1;
  });

  res.json(
    Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([campaign, total]) => ({ campaign, total: Number(total.toFixed(2)), count: counts[campaign] || 0 }))
  );
});

// ─── Monthly report ───────────────────────────────────────────────────────────

app.get('/api/reports/monthly', async (req, res) => {
  const now = new Date();
  const rawMonth = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = rawMonth.split('-').map(Number);

  const fromDate = `${year}-${String(mon).padStart(2, '0')}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const toDate = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: donations, error } = await supabase
    .from('donations').select('donor_id, amount, campaign_name')
    .gte('donation_date', fromDate).lte('donation_date', toDate).limit(10000);
  if (error) return res.status(500).json({ error: error.message });

  const totalCollection = (donations || []).reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalTransactions = (donations || []).length;
  const uniqueDonors = new Set((donations || []).map((d) => d.donor_id).filter(Boolean)).size;

  const campaignMap = {};
  (donations || []).forEach((d) => {
    const key = d.campaign_name || 'Uncategorized';
    if (!campaignMap[key]) campaignMap[key] = { total: 0, count: 0 };
    campaignMap[key].total += Number(d.amount || 0);
    campaignMap[key].count += 1;
  });
  const campaigns = Object.entries(campaignMap)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, s]) => ({ name, total: Number(s.total.toFixed(2)), count: s.count }));

  const { count: newDonors } = await supabase.from('donors')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${fromDate}T00:00:00`).lte('created_at', `${toDate}T23:59:59`);

  res.json({
    month: rawMonth,
    from_date: fromDate,
    to_date: toDate,
    total_collection: Number(totalCollection.toFixed(2)),
    total_transactions: totalTransactions,
    unique_donors: uniqueDonors,
    new_donors: newDonors || 0,
    avg_donation: totalTransactions > 0 ? Number((totalCollection / totalTransactions).toFixed(2)) : 0,
    campaigns,
  });
});

// ─── Chart endpoints ──────────────────────────────────────────────────────────

app.get('/api/charts/donor-growth', async (req, res) => {
  const months = parseInt(req.query.months || '12', 10);
  const rows = [];
  const now = new Date();
  let cumulative = 0;

  const windowStart = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const windowStartStr = windowStart.toISOString().slice(0, 10);
  const { count: baseCumulative } = await supabase
    .from('donors').select('*', { count: 'exact', head: true })
    .lt('created_at', `${windowStartStr}T00:00:00`);
  cumulative = baseCumulative || 0;

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const from = `${year}-${mon}-01T00:00:00`;
    const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
    const to = `${year}-${mon}-${String(lastDay).padStart(2, '0')}T23:59:59`;
    const { count } = await supabase.from('donors').select('*', { count: 'exact', head: true })
      .gte('created_at', from).lte('created_at', to);
    const newCount = count || 0;
    cumulative += newCount;
    rows.push({ month: `${year}-${mon}`, new_donors: newCount, cumulative });
  }
  res.json(rows);
});

app.get('/api/charts/new-vs-returning', async (req, res) => {
  const months = parseInt(req.query.months || '12', 10);
  const rows = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const from = `${year}-${mon}-01`;
    const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
    const to = `${year}-${mon}-${String(lastDay).padStart(2, '0')}`;

    const { data: donatedThisMonth } = await supabase
      .from('donations').select('donor_id')
      .gte('donation_date', from).lte('donation_date', to).limit(10000);
    const donorIds = [...new Set((donatedThisMonth || []).map(d => d.donor_id).filter(Boolean))];

    let newCount = 0;
    if (donorIds.length > 0) {
      const { count } = await supabase.from('donors').select('*', { count: 'exact', head: true })
        .in('id', donorIds).gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`);
      newCount = count || 0;
    }
    const returningCount = Math.max(0, donorIds.length - newCount);
    rows.push({ month: `${year}-${mon}`, new: newCount, returning: returningCount });
  }
  res.json(rows);
});

app.get('/api/charts/source-breakdown', async (req, res) => {
  const { data, error } = await supabase.from('donations').select('source, amount').limit(50000);
  if (error) return res.status(500).json({ error: error.message });

  const map = {};
  (data || []).forEach(d => {
    const key = (d.source || 'Unknown').trim() || 'Unknown';
    if (!map[key]) map[key] = { count: 0, total: 0 };
    map[key].count += 1;
    map[key].total += Number(d.amount || 0);
  });

  const rows = Object.entries(map)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([source, v]) => ({ source, count: v.count, total: Number(v.total.toFixed(2)) }));
  res.json(rows);
});

app.get('/api/charts/yoy-comparison', async (req, res) => {
  const now = new Date();
  const curYear = now.getFullYear();
  const prevYear = curYear - 1;
  const rows = [];

  for (let m = 1; m <= 12; m++) {
    const mon = String(m).padStart(2, '0');
    const getTotal = async (year, month) => {
      const lastDay = new Date(year, month, 0).getDate();
      const { data } = await supabase.from('donations').select('amount')
        .gte('donation_date', `${year}-${month}-01`)
        .lte('donation_date', `${year}-${month}-${String(lastDay).padStart(2, '0')}`).limit(50000);
      return (data || []).reduce((s, d) => s + Number(d.amount || 0), 0);
    };
    const [cur, prev] = await Promise.all([getTotal(curYear, mon), getTotal(prevYear, mon)]);
    rows.push({ month: mon, current: Number(cur.toFixed(2)), previous: Number(prev.toFixed(2)) });
  }
  res.json({ current_year: curYear, previous_year: prevYear, data: rows });
});

// ─── Static files ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
