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

function parseCustomerRow(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    campaign: row.campaign || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    total_orders: row.total_orders || 0,
    total_spent: row.total_spent || 0,
    first_purchase_date: row.first_purchase_date,
    last_purchase_date: row.last_purchase_date,
    ltv: row.total_spent || 0,
    aov: row.total_orders ? Number((row.total_spent / row.total_orders).toFixed(2)) : 0,
    status: row.status || 'new'
  };
}

function computeStatus(lastPurchaseDate, totalOrders) {
  if (!lastPurchaseDate || totalOrders === 0) return 'new';
  const daysSince = Math.floor((new Date() - new Date(lastPurchaseDate)) / (1000 * 60 * 60 * 24));
  if (daysSince > 180) return 'churn';
  if (daysSince > 90) return 'dormant';
  if (totalOrders >= 2) return 'repeat';
  return 'active';
}

function buildOrderStats(orders) {
  const stats = {};
  orders.forEach((order) => {
    const customerId = order.customer_id;
    if (!stats[customerId]) {
      stats[customerId] = {
        total_orders: 0,
        total_spent: 0,
        first_purchase_date: null,
        last_purchase_date: null
      };
    }

    const customerStats = stats[customerId];
    const amount = Number(order.amount) || 0;
    customerStats.total_orders += 1;
    customerStats.total_spent += amount;

    if (!customerStats.first_purchase_date || new Date(order.order_date) < new Date(customerStats.first_purchase_date)) {
      customerStats.first_purchase_date = order.order_date;
    }
    if (!customerStats.last_purchase_date || new Date(order.order_date) > new Date(customerStats.last_purchase_date)) {
      customerStats.last_purchase_date = order.order_date;
    }
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
  const expectedHeaders = ['full_name', 'phone', 'email', 'order_date', 'amount', 'source', 'campaign'];
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

  // Validate secret against configured webhooks (optional – just log)
  const name = body.name || body.full_name || body.customer_name || 'Unknown';
  const phone = body.phone || body.mobile || '';
  const email = body.email || '';
  const amount = Number(body.amount || body.total || body.price || 0);
  const orderDate = body.date || body.order_date || now.slice(0, 10);
  const source = body.source || `webhook:${secret}`;

  let existingCustomer = null;
  if (phone) {
    const { data } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
    existingCustomer = data || null;
  }
  if (!existingCustomer && email) {
    const { data } = await supabase.from('customers').select('*').eq('email', email).maybeSingle();
    existingCustomer = data || null;
  }

  let customerId;
  let isNewCustomer = false;

  if (existingCustomer) {
    customerId = existingCustomer.id;
    await supabase.from('customers').update({ updated_at: now }).eq('id', customerId);
  } else {
    const { data: newCust } = await supabase.from('customers').insert([{
      full_name: name,
      phone: phone || '',
      email: email || '',
      source,
      campaign: '',
      created_at: now,
      updated_at: now
    }]).select('*').single();
    customerId = newCust?.id;
    isNewCustomer = true;
    fireWebhooks('customer.created', newCust);
  }

  const { data: newOrder } = await supabase.from('orders').insert([{
    external_order_id: `WH-${secret.slice(0, 8)}-${Date.now()}`,
    customer_id: customerId,
    order_date: orderDate,
    amount,
    source,
    created_at: now
  }]).select('*').single();

  fireWebhooks('order.created', newOrder);

  res.json({ success: true, customer_id: customerId, new_customer: isNewCustomer });
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
  const orderDate = order.created_at ? order.created_at.slice(0, 10) : now.slice(0, 10);
  const source = order.source_name || 'shopify';

  let existingCustomer = null;
  if (phone) {
    const { data } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
    existingCustomer = data || null;
  }
  if (!existingCustomer && email) {
    const { data } = await supabase.from('customers').select('*').eq('email', email).maybeSingle();
    existingCustomer = data || null;
  }

  let customerId;
  let isNewCustomer = false;

  if (existingCustomer) {
    customerId = existingCustomer.id;
    await supabase.from('customers').update({ full_name: name, updated_at: now }).eq('id', customerId);
  } else {
    const { data: newCust } = await supabase.from('customers').insert([{
      full_name: name, phone, email, source, campaign: '', created_at: now, updated_at: now
    }]).select('*').single();
    customerId = newCust?.id;
    isNewCustomer = true;
    fireWebhooks('customer.created', newCust);
  }

  const { data: newOrder } = await supabase.from('orders').insert([{
    external_order_id: `SHOPIFY-${order.id || Date.now()}`,
    customer_id: customerId,
    order_date: orderDate,
    amount,
    source,
    created_at: now
  }]).select('*').single();

  fireWebhooks('order.created', newOrder);

  res.json({ success: true, customer_id: customerId, new_customer: isNewCustomer });
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
  const orderDate = order.date_created ? order.date_created.slice(0, 10) : now.slice(0, 10);
  const source = order.payment_method_title || 'woocommerce';

  let existingCustomer = null;
  if (phone) {
    const { data } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
    existingCustomer = data || null;
  }
  if (!existingCustomer && email) {
    const { data } = await supabase.from('customers').select('*').eq('email', email).maybeSingle();
    existingCustomer = data || null;
  }

  let customerId;
  let isNewCustomer = false;

  if (existingCustomer) {
    customerId = existingCustomer.id;
    await supabase.from('customers').update({ full_name: name, updated_at: now }).eq('id', customerId);
  } else {
    const { data: newCust } = await supabase.from('customers').insert([{
      full_name: name, phone, email, source, campaign: '', created_at: now, updated_at: now
    }]).select('*').single();
    customerId = newCust?.id;
    isNewCustomer = true;
    fireWebhooks('customer.created', newCust);
  }

  const { data: newOrder } = await supabase.from('orders').insert([{
    external_order_id: `WOO-${order.id || Date.now()}`,
    customer_id: customerId,
    order_date: orderDate,
    amount,
    source: 'woocommerce',
    created_at: now
  }]).select('*').single();

  fireWebhooks('order.created', newOrder);

  res.json({ success: true, customer_id: customerId, new_customer: isNewCustomer });
});

// Generic integration
app.post('/api/integrations/generic', async (req, res) => {
  const body = req.body || {};
  const now = new Date().toISOString();
  const name = body.name || body.full_name || 'Unknown';
  const phone = body.phone || body.mobile || '';
  const email = body.email || '';
  const amount = Number(body.amount || body.total || body.price || 0);
  const orderDate = body.date || body.order_date || now.slice(0, 10);
  const source = body.source || 'generic';

  let existingCustomer = null;
  if (phone) {
    const { data } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
    existingCustomer = data || null;
  }
  if (!existingCustomer && email) {
    const { data } = await supabase.from('customers').select('*').eq('email', email).maybeSingle();
    existingCustomer = data || null;
  }

  let customerId;
  let isNewCustomer = false;

  if (existingCustomer) {
    customerId = existingCustomer.id;
    await supabase.from('customers').update({ updated_at: now }).eq('id', customerId);
  } else {
    const { data: newCust } = await supabase.from('customers').insert([{
      full_name: name, phone, email, source, campaign: '', created_at: now, updated_at: now
    }]).select('*').single();
    customerId = newCust?.id;
    isNewCustomer = true;
    fireWebhooks('customer.created', newCust);
  }

  const { data: newOrder } = await supabase.from('orders').insert([{
    external_order_id: `GENERIC-${Date.now()}`,
    customer_id: customerId,
    order_date: orderDate,
    amount,
    source,
    created_at: now
  }]).select('*').single();

  fireWebhooks('order.created', newOrder);

  res.json({ success: true, customer_id: customerId, new_customer: isNewCustomer });
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
  const id = Number(req.params.id);
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
  const id = Number(req.params.id);
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
  const id = Number(req.params.id);
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
  const id = Number(req.params.id);
  const { error } = await supabase.from('webhooks').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get('/api/webhooks/logs', requireAuth('manager'), async (req, res) => {
  const { data, error } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ─── Staff ────────────────────────────────────────────────────────────────────

function parseStaffRow(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role || 'manager',
    active: row.active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

app.get('/api/staff', async (req, res) => {
  const { data, error } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
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

  const now = new Date().toISOString();
  const { data, error } = await supabase.from('staff').insert([{
    full_name,
    email,
    role: role || 'manager',
    active: true,
    created_at: now,
    updated_at: now
  }]).select('*').single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(parseStaffRow(data));
});

// ─── Summary ──────────────────────────────────────────────────────────────────

app.get('/api/summary', async (req, res) => {
  const { data: orderRows, error: orderError } = await supabase.from('orders').select('amount, customer_id, order_date');
  if (orderError) {
    return res.status(500).json({ error: orderError.message });
  }

  const { data: customerRows, error: customerError } = await supabase.from('customers').select('*');
  if (customerError) {
    return res.status(500).json({ error: customerError.message });
  }

  const orderStats = buildOrderStats(orderRows || []);
  const totals = (orderRows || []).reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const avgOrderValue = orderRows && orderRows.length ? Number((totals / orderRows.length).toFixed(2)) : 0;

  const summary = {
    total: customerRows.length,
    total_collection: Number(totals.toFixed(2)),
    avg_order_value: avgOrderValue,
    active: 0,
    repeat: 0,
    dormant: 0,
    churn: 0
  };

  (customerRows || []).forEach((customer) => {
    const stats = orderStats[customer.id] || { total_orders: 0, last_purchase_date: null };
    const status = computeStatus(stats.last_purchase_date, stats.total_orders);
    summary[status] += 1;
  });

  res.json(summary);
});

// ─── Customers ────────────────────────────────────────────────────────────────

app.get('/api/customers', async (req, res) => {
  const { search, status, source, from_date, to_date } = req.query;
  let page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let perPage = Math.min(200, Math.max(1, parseInt(req.query.per_page, 10) || 50));

  const { data: customerRows, error: customerError } = await supabase.from('customers').select('*').order('updated_at', { ascending: false });
  if (customerError) {
    return res.status(500).json({ error: customerError.message });
  }

  const { data: orderRows, error: orderError } = await supabase.from('orders').select('*');
  if (orderError) {
    return res.status(500).json({ error: orderError.message });
  }

  const orderStats = buildOrderStats(orderRows || []);

  let customers = (customerRows || []).map((row) => {
    const stats = orderStats[row.id] || { total_orders: 0, total_spent: 0, first_purchase_date: null, last_purchase_date: null };
    const customerRow = { ...row, ...stats };
    return {
      ...parseCustomerRow(customerRow),
      status: computeStatus(stats.last_purchase_date, stats.total_orders)
    };
  });

  // Apply filters
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
  const id = Number(req.params.id);

  const { data: customerRow, error: customerError } = await supabase.from('customers').select('*').eq('id', id).single();
  if (customerError || !customerRow) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const { data: orders, error: ordersError } = await supabase.from('orders').select('*').eq('customer_id', id).order('order_date', { ascending: false });
  if (ordersError) {
    return res.status(500).json({ error: ordersError.message });
  }

  const stats = buildOrderStats(orders || [])[id] || { total_orders: 0, total_spent: 0, first_purchase_date: null, last_purchase_date: null };
  const customer = parseCustomerRow({
    ...customerRow,
    ...stats
  });
  customer.status = computeStatus(stats.last_purchase_date, stats.total_orders);

  res.json({ customer, orders: orders || [] });
});

app.put('/api/customers/:id', requireAuth('editor'), async (req, res) => {
  const id = Number(req.params.id);
  const { full_name, phone, email, source, campaign } = req.body;

  if (!full_name) {
    return res.status(400).json({ error: 'full_name is required' });
  }

  const { data: existing, error: existingError } = await supabase.from('customers').select('*').eq('id', id).single();
  if (existingError || !existing) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from('customers').update({
    full_name,
    phone: phone || '',
    email: email || '',
    source: source || existing.source || 'manual',
    campaign: campaign || existing.campaign || '',
    updated_at: now
  }).eq('id', id);

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  const { data: updated } = await supabase.from('customers').select('*').eq('id', id).single();
  res.json({ customer: updated });
});

// ─── Orders ───────────────────────────────────────────────────────────────────

app.get('/api/orders', async (req, res) => {
  const { data: orders, error } = await supabase.from('orders').select('*, customer:customers(full_name, phone, email)').order('order_date', { ascending: false });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json((orders || []).map((order) => ({
    ...order,
    customer_name: order.customer?.full_name || null,
    phone: order.customer?.phone || null,
    email: order.customer?.email || null
  })));
});

app.post('/api/orders', requireAuth('editor'), async (req, res) => {
  let { external_order_id, customer, order_date, amount, source } = req.body;
  if (!order_date || !amount) {
    return res.status(400).json({ error: 'order_date and amount are required' });
  }

  if (!external_order_id) {
    external_order_id = `AUTO-${Date.now()}`;
  }

  const { full_name, phone, email, campaign } = customer || {};
  const now = new Date().toISOString();

  let existingCustomer = null;
  if (phone) {
    const { data, error } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    existingCustomer = data || null;
  }
  if (!existingCustomer && email) {
    const { data, error } = await supabase.from('customers').select('*').eq('email', email).maybeSingle();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    existingCustomer = data || null;
  }

  let customerId;
  let isNewCustomer = false;

  if (existingCustomer) {
    customerId = existingCustomer.id;
    const { error: updateError } = await supabase.from('customers').update({
      full_name: full_name || existingCustomer.full_name,
      phone: phone || existingCustomer.phone,
      email: email || existingCustomer.email,
      source: source || existingCustomer.source || 'manual',
      campaign: campaign || existingCustomer.campaign || '',
      updated_at: now
    }).eq('id', customerId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }
  } else {
    const { data, error: insertError } = await supabase.from('customers').insert([{
      full_name: full_name || 'Unknown',
      phone: phone || '',
      email: email || '',
      source: source || 'manual',
      campaign: campaign || '',
      created_at: now,
      updated_at: now
    }]).select('*').single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }
    customerId = data.id;
    isNewCustomer = true;
    fireWebhooks('customer.created', data);
  }

  const { data: newOrder, error: orderInsertError } = await supabase.from('orders').insert([{
    external_order_id,
    customer_id: customerId,
    order_date,
    amount: Number(amount),
    source: source || 'manual',
    created_at: now
  }]).select('*').single();

  if (orderInsertError) {
    return res.status(500).json({ error: orderInsertError.message });
  }

  fireWebhooks('order.created', newOrder);

  const { data: detail, error: detailError } = await supabase.from('customers').select('*').eq('id', customerId).single();
  if (detailError) {
    return res.status(500).json({ error: detailError.message });
  }

  res.json({ success: true, customer: detail });
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

    if (!row.full_name || !row.order_date || !row.amount) {
      return res.status(400).json({ error: `Baris ${lineNumber} mesti mempunyai full_name, order_date dan amount.` });
    }

    if (Number.isNaN(amount)) {
      return res.status(400).json({ error: `Jumlah tidak sah pada baris ${lineNumber}.` });
    }

    let existingCustomer = null;
    if (row.phone) {
      const { data, error } = await supabase.from('customers').select('*').eq('phone', row.phone).maybeSingle();
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      existingCustomer = data || null;
    }
    if (!existingCustomer && row.email) {
      const { data, error } = await supabase.from('customers').select('*').eq('email', row.email).maybeSingle();
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      existingCustomer = data || null;
    }

    const now = new Date().toISOString();
    let customerId;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      const { error } = await supabase.from('customers').update({
        full_name: row.full_name || existingCustomer.full_name,
        phone: row.phone || existingCustomer.phone,
        email: row.email || existingCustomer.email,
        source: row.source || existingCustomer.source || 'manual',
        campaign: row.campaign || existingCustomer.campaign || '',
        updated_at: now
      }).eq('id', customerId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }
    } else {
      const { data, error } = await supabase.from('customers').insert([{
        full_name: row.full_name,
        phone: row.phone || '',
        email: row.email || '',
        source: row.source || 'manual',
        campaign: row.campaign || '',
        created_at: now,
        updated_at: now
      }]).select('*').single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      customerId = data.id;
      fireWebhooks('customer.created', data);
    }

    const { data: newOrder, error: orderError } = await supabase.from('orders').insert([{
      external_order_id: `BULK-${Date.now()}-${index + 1}`,
      customer_id: customerId,
      order_date: row.order_date,
      amount,
      source: row.source || 'manual',
      created_at: now
    }]).select('*').single();

    if (orderError) {
      return res.status(500).json({ error: orderError.message });
    }

    fireWebhooks('order.created', newOrder);
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
