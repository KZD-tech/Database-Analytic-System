import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { supabase, initDb } from './db/db.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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
    source: row.source || 'manual',
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
    const { data } = await supabase.from('donors').select('*').eq('phone', phone).maybeSingle();
    existing = data || null;
  }
  if (!existing && email) {
    const { data } = await supabase.from('donors').select('*').eq('email', email).maybeSingle();
    existing = data || null;
  }

  if (existing) {
    return { donorId: existing.id, isNew: false, donor: existing };
  }

  const now = new Date().toISOString();
  const { data: newDonor } = await supabase.from('donors').insert([{
    name: name || 'Unknown',
    phone: phone || '',
    email: email || '',
    created_at: now
  }]).select('*').single();

  return { donorId: newDonor?.id, isNew: true, donor: newDonor };
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
    source: row.source ?? 'manual',
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
  const { data: summaryRows, error } = await supabase.from('donor_summary').select('*');
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  let totalCollection = 0;
  let totalDonations = 0;
  const counts = { active: 0, repeat: 0, dormant: 0, churn: 0, new: 0 };

  (summaryRows || []).forEach((row) => {
    const parsed = parseSummaryRow(row);
    totalCollection += parsed.total_spent;
    totalDonations += parsed.total_orders;
    counts[parsed.status] = (counts[parsed.status] || 0) + 1;
  });

  const avgDonationValue = totalDonations > 0 ? Number((totalCollection / totalDonations).toFixed(2)) : 0;

  res.json({
    total: (summaryRows || []).length,
    total_collection: Number(totalCollection.toFixed(2)),
    avg_order_value: avgDonationValue,
    ...counts
  });
});

// ─── Customers (donors) ───────────────────────────────────────────────────────

app.get('/api/customers', async (req, res) => {
  const { search, status, source, from_date, to_date } = req.query;
  let page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let perPage = Math.min(200, Math.max(1, parseInt(req.query.per_page, 10) || 50));

  const { data: summaryRows, error: summaryError } = await supabase.from('donor_summary').select('*');
  if (summaryError) {
    return res.status(500).json({ error: summaryError.message });
  }

  let customers = (summaryRows || []).map(parseSummaryRow);

  if (search) {
    const q = search.toLowerCase();
    customers = customers.filter((c) =>
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }

  if (status && status !== 'all') {
    customers = customers.filter((c) => c.status === status);
  }

  if (source && source !== 'all') {
    customers = customers.filter((c) => (c.source || 'other') === source);
  }

  if (from_date) {
    customers = customers.filter((c) => c.last_purchase_date && c.last_purchase_date >= from_date);
  }

  if (to_date) {
    customers = customers.filter((c) => c.last_purchase_date && c.last_purchase_date <= to_date);
  }

  const total = customers.length;
  const totalPages = Math.ceil(total / perPage) || 1;
  page = Math.min(page, totalPages);
  const start = (page - 1) * perPage;
  const paged = customers.slice(start, start + perPage);

  res.json({ customers: paged, total, page, per_page: perPage, total_pages: totalPages });
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

  // Fetch campaign names for all campaign_ids in this donor's donations
  const campaignIds = [...new Set((donations || []).map((d) => d.campaign_id).filter(Boolean))];
  let campaignMap = {};
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabase.from('campaigns').select('id, name');
    (campaigns || []).forEach((c) => { campaignMap[c.id] = c.name; });
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
      campaign_name: campaignMap[d.campaign_id] || null
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
  const { customer, order_date, donation_date, amount, source } = req.body;
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
    source: source || 'manual',
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

  const created = [];

  for (let index = 0; index < records.length; index += 1) {
    const row = records[index];
    const lineNumber = index + 2;
    const amount = Number(row.amount);

    if (!row.name || !row.donation_date || !row.amount) {
      return res.status(400).json({ error: `Baris ${lineNumber} mesti mempunyai name, donation_date dan amount.` });
    }

    if (Number.isNaN(amount)) {
      return res.status(400).json({ error: `Jumlah tidak sah pada baris ${lineNumber}.` });
    }

    const now = new Date().toISOString();
    const { donorId, isNew, donor } = await upsertDonor({ name: row.name, phone: row.phone, email: row.email });

    if (isNew) fireWebhooks('donor.created', donor);

    const { data: newDonation, error: donationError } = await supabase.from('donations').insert([{
      donor_id: donorId,
      donation_date: row.donation_date,
      amount,
      source: row.source || 'manual',
      created_at: now
    }]).select('*').single();

    if (donationError) {
      return res.status(500).json({ error: donationError.message });
    }

    fireWebhooks('donation.created', newDonation);
    created.push(row);
  }

  res.json({ success: true, imported: created.length });
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
