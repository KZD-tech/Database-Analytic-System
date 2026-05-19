-- Supabase / PostgreSQL schema for customers and orders

CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY,
  full_name text NOT NULL,
  phone text,
  email text,
  source text,
  campaign text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY,
  external_order_id text NOT NULL,
  customer_id integer NOT NULL REFERENCES customers(id),
  order_date date NOT NULL,
  amount numeric NOT NULL,
  source text,
  created_at timestamptz NOT NULL
);
