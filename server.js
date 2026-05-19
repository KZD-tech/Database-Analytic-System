import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, initDb } from './db/db.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

await initDb();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ihsanku.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'supersecret-admin-token';

function getRequestToken(req) {
  const authHeader = req.headers.authorization || '';
  const [type, token] = authHeader.split(' ');
  return type === 'Bearer' ? token : null;
}

function requireAdminAuth(req, res, next) {
  if (req.path === '/admin/login') {
    return next();
  }

  const token = getRequestToken(req);
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({ token: ADMIN_TOKEN });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

app.use('/api', requireAdminAuth);

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

app.post('/api/orders/bulk-upload', async (req, res) => {
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
      }]).select('id').single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      customerId = data.id;
    }

    const { error: orderError } = await supabase.from('orders').insert([{
      external_order_id: `BULK-${Date.now()}-${index + 1}`,
      customer_id: customerId,
      order_date: row.order_date,
      amount,
      source: row.source || 'manual',
      created_at: now
    }]);

    if (orderError) {
      return res.status(500).json({ error: orderError.message });
    }

    created.push(row);
  }

  res.json({ success: true, imported: created.length });
});

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

app.post('/api/staff', async (req, res) => {
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

app.get('/api/customers', async (req, res) => {
  const { data: customerRows, error: customerError } = await supabase.from('customers').select('*').order('updated_at', { ascending: false });
  if (customerError) {
    return res.status(500).json({ error: customerError.message });
  }

  const { data: orderRows, error: orderError } = await supabase.from('orders').select('*');
  if (orderError) {
    return res.status(500).json({ error: orderError.message });
  }

  const orderStats = buildOrderStats(orderRows || []);
  const customers = (customerRows || []).map((row) => {
    const stats = orderStats[row.id] || { total_orders: 0, total_spent: 0, first_purchase_date: null, last_purchase_date: null };
    const customerRow = {
      ...row,
      ...stats
    };
    return {
      ...parseCustomerRow(customerRow),
      status: computeStatus(stats.last_purchase_date, stats.total_orders)
    };
  });

  res.json(customers);
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

app.put('/api/customers/:id', async (req, res) => {
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

app.post('/api/orders', async (req, res) => {
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
    }]).select('id').single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }
    customerId = data.id;
  }

  const { error: orderInsertError } = await supabase.from('orders').insert([{
    external_order_id,
    customer_id: customerId,
    order_date,
    amount: Number(amount),
    source: source || 'manual',
    created_at: now
  }]);

  if (orderInsertError) {
    return res.status(500).json({ error: orderInsertError.message });
  }

  const { data: detail, error: detailError } = await supabase.from('customers').select('*').eq('id', customerId).single();
  if (detailError) {
    return res.status(500).json({ error: detailError.message });
  }

  res.json({ success: true, customer: detail });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
