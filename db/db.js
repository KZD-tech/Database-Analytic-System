import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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
    ]
  };

  const cloneRow = (row) => JSON.parse(JSON.stringify(row));

  const normalizeSelect = (value) => (typeof value === 'string' ? value : '*');

  const createQueryBuilder = (tableName) => {
    const state = {
      tableName,
      selected: null,
      filters: [],
      sort: null,
      limitCount: null
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

    const query = {
      select(columns) {
        state.selected = normalizeSelect(columns);
        return this;
      },
      eq(field, value) {
        state.filters.push((row) => row[field] === value);
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
        const nextId = mockData[tableName].reduce((max, row) => Math.max(max, row.id || 0), 0) + 1;
        const inserted = (Array.isArray(rows) ? rows : [rows]).map((row, index) => {
          const newRow = { ...row, id: nextId + index };
          mockData[tableName].push(newRow);
          return cloneRow(newRow);
        });
        return {
          then(resolve) {
            resolve({ data: inserted, error: null });
          }
        };
      },
      update(values) {
        const rows = getRows();
        const updated = rows.map((row) => {
          const existing = mockData[tableName].find((item) => item.id === row.id);
          if (!existing) return row;
          Object.assign(existing, values);
          return cloneRow(existing);
        });
        return {
          then(resolve) {
            resolve({ data: updated, error: null });
          }
        };
      },
      maybeSingle() {
        state.single = 'maybe';
        return this;
      },
      single() {
        state.single = 'single';
        return this;
      },
      then(resolve) {
        const rows = getRows();
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
          resolve({ data: data[0] || null, error: null });
          return;
        }

        if (state.single === 'single') {
          if (data.length === 1) {
            resolve({ data: data[0], error: null });
          } else {
            resolve({ data: null, error: { message: 'No data found' } });
          }
          return;
        }

        resolve({ data, error: null });
      }
    };

    return query;
  };

  supabase = {
    from(tableName) {
      if (!mockData[tableName]) {
        throw new Error(`Unknown table: ${tableName}`);
      }
      return createQueryBuilder(tableName);
    }
  };

  initDb = async () => {
    return Promise.resolve();
  };
}

export { supabase, initDb };
