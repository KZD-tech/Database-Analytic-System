import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { scryptSync, randomBytes } from 'crypto';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase;
let initDb;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  });

  initDb = async () => {
    const { error } = await supabase.from('customers').select('id').limit(1);
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
  };
} else {
  console.warn('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) are not set. Using fallback in-memory database.');

  const now = () => new Date().toISOString();

  // Compute default admin password hash at module load time
  const adminSalt = 'defaultsalt0000000000000000000000'; // fixed 32 chars for reproducibility
  const adminHash = scryptSync('admin123', adminSalt, 64).toString('hex');
  const adminPasswordHash = `${adminSalt}:${adminHash}`;

  const mockData = {
    customers: [
      {
        id: 1,
        full_name: 'Admin Demo',
        phone: '0123456789',
        email: 'admin@ihsanku.local',
        source: 'manual',
        campaign: 'Demo',
        created_at: now(),
        updated_at: now(),
        total_orders: 0,
        total_spent: 0
      }
    ],
    orders: [],
    staff: [
      {
        id: 1,
        full_name: 'Super Admin',
        email: 'admin@ihsanku.local',
        role: 'manager',
        active: true,
        created_at: now(),
        updated_at: now()
      }
    ],
    users: [
      {
        id: 1,
        email: 'admin@ihsanku.local',
        password_hash: adminPasswordHash,
        full_name: 'Super Admin',
        role: 'admin',
        active: true,
        created_at: now(),
        updated_at: now()
      }
    ],
    webhooks: [],
    webhook_logs: []
  };

  const cloneRow = (row) => JSON.parse(JSON.stringify(row));

  const normalizeSelect = (value) => (typeof value === 'string' ? value : '*');

  const createQueryBuilder = (tableName) => {
    const state = {
      tableName,
      selected: null,
      filters: [],
      sort: null,
      limitCount: null,
      single: null,
      pendingInsert: null,
      pendingUpdate: null,
      pendingDelete: false
    };

    const getRows = () => {
      const rows = mockData[tableName].map(cloneRow);
      let filtered = rows;

      state.filters.forEach((filter) => {
        filtered = filtered.filter(filter);
      });

      if (state.sort) {
        filtered.sort((a, b) => {
          const left = a[state.sort.field];
          const right = b[state.sort.field];
          if (left === right) return 0;
          return state.sort.ascending ? (left > right ? 1 : -1) : (left < right ? 1 : -1);
        });
      }

      if (state.limitCount != null) {
        filtered = filtered.slice(0, state.limitCount);
      }

      return filtered;
    };

    const resolveData = () => {
      // Handle insert chains: insert().select().single()
      if (state.pendingInsert !== null) {
        const insertRows = Array.isArray(state.pendingInsert) ? state.pendingInsert : [state.pendingInsert];
        const nextId = mockData[tableName].reduce((max, row) => Math.max(max, row.id || 0), 0) + 1;
        const inserted = insertRows.map((row, index) => {
          const newRow = { ...row, id: nextId + index };
          mockData[tableName].push(newRow);
          return cloneRow(newRow);
        });

        if (state.single === 'single') {
          if (inserted.length === 1) return { data: inserted[0], error: null };
          return { data: null, error: { message: 'Expected single row' } };
        }
        if (state.single === 'maybe') {
          return { data: inserted[0] || null, error: null };
        }
        return { data: inserted, error: null };
      }

      // Handle delete chains
      if (state.pendingDelete) {
        const rowsToDelete = getRows();
        rowsToDelete.forEach((row) => {
          const idx = mockData[tableName].findIndex((item) => item.id === row.id);
          if (idx !== -1) mockData[tableName].splice(idx, 1);
        });
        return { data: rowsToDelete, error: null };
      }

      // Handle update chains
      if (state.pendingUpdate !== null) {
        const rowsToUpdate = getRows();
        const updated = rowsToUpdate.map((row) => {
          const existing = mockData[tableName].find((item) => item.id === row.id);
          if (!existing) return row;
          Object.assign(existing, state.pendingUpdate);
          return cloneRow(existing);
        });

        if (state.single === 'single') {
          if (updated.length === 1) return { data: updated[0], error: null };
          return { data: null, error: { message: 'Expected single row' } };
        }
        if (state.single === 'maybe') {
          return { data: updated[0] || null, error: null };
        }
        return { data: updated, error: null };
      }

      // Handle select chains
      let rows = getRows();
      let data = rows;

      if (state.selected && tableName === 'orders' && state.selected.includes('customer:customers(')) {
        const joined = rows.map((order) => {
          const customer = mockData.customers.find((customerRow) => customerRow.id === order.customer_id);
          return {
            ...order,
            customer: customer
              ? {
                  full_name: customer.full_name,
                  phone: customer.phone,
                  email: customer.email
                }
              : null
          };
        });
        data = joined;
      }

      if (state.single === 'maybe') {
        return { data: data[0] || null, error: null };
      }

      if (state.single === 'single') {
        if (data.length >= 1) {
          return { data: data[0], error: null };
        }
        return { data: null, error: { message: 'No data found' } };
      }

      return { data, error: null };
    };

    const query = {
      select(columns) {
        state.selected = normalizeSelect(columns);
        return this;
      },
      eq(field, value) {
        state.filters.push((row) => row[field] === value);
        return this;
      },
      neq(field, value) {
        state.filters.push((row) => row[field] !== value);
        return this;
      },
      ilike(field, pattern) {
        // Convert SQL ILIKE pattern to regex: %foo% => /foo/i
        const regexStr = pattern.replace(/%/g, '.*').replace(/_/g, '.');
        const regex = new RegExp(`^${regexStr}$`, 'i');
        state.filters.push((row) => regex.test(String(row[field] || '')));
        return this;
      },
      gte(field, value) {
        state.filters.push((row) => row[field] >= value);
        return this;
      },
      lte(field, value) {
        state.filters.push((row) => row[field] <= value);
        return this;
      },
      order(field, opts = {}) {
        state.sort = { field, ascending: opts.ascending !== false };
        return this;
      },
      limit(count) {
        state.limitCount = count;
        return this;
      },
      insert(rows) {
        state.pendingInsert = rows;
        return this;
      },
      update(values) {
        state.pendingUpdate = values;
        return this;
      },
      delete() {
        state.pendingDelete = true;
        return this;
      },
      maybeSingle() {
        state.single = 'maybe';
        return this;
      },
      single() {
        state.single = 'single';
        return this;
      },
      then(resolve, reject) {
        try {
          resolve(resolveData());
        } catch (err) {
          resolve({ data: null, error: { message: err.message } });
        }
      }
    };

    return query;
  };

  supabase = {
    from(tableName) {
      if (!mockData[tableName]) {
        // Auto-create unknown tables as empty arrays
        mockData[tableName] = [];
      }
      return createQueryBuilder(tableName);
    }
  };

  initDb = async () => {
    return Promise.resolve();
  };
}

export { supabase, initDb };
