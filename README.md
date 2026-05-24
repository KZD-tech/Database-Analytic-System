# IhsanKu — Donor Analytics System

Sistem pengurusan dan analitik derma untuk NGO. Dibina dengan React + Express + Supabase.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Express.js (Node.js ES Modules) |
| Database | Supabase (PostgreSQL) |
| Hosting | Railway |
| Auth | HMAC-SHA256 stateless token |

---

## Database Structure

### Tables

#### `donors`
Satu row per orang unik. Duplikat dicegah melalui UNIQUE constraint pada `phone` dan `email`.

| Column | Type | Keterangan |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `name` | text | Nama donor |
| `phone` | text (UNIQUE) | Nombor telefon |
| `email` | text (UNIQUE) | Emel |
| `created_at` | timestamptz | Tarikh masuk sistem |
| `updated_at` | timestamptz | Tarikh kemaskini terakhir |

#### `donations`
Satu row per transaksi derma. Linked ke `donors` melalui `donor_id`.

| Column | Type | Keterangan |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `donor_id` | uuid (FK) | Rujuk `donors.id` |
| `donation_date` | date | Tarikh derma |
| `amount` | numeric(12,2) | Jumlah (RM) |
| `source` | text | Sumber (Facebook, Website, dll) |
| `campaign_name` | text | Nama kempen |
| `created_at` | timestamptz | Tarikh rekod dibuat |

#### `donor_summary` (VIEW — auto-compute)
Dikira secara automatik dari `donors` + `donations`. **Tiada data disimpan di sini.**

| Column | Dikira dari |
|---|---|
| `kekerapan` | `COUNT(donations)` |
| `jumlah_keseluruhan` | `SUM(amount)` |
| `tarikh_sumbangan_terdahulu` | `MIN(donation_date)` |
| `tarikh_sumbangan_terkini` | `MAX(donation_date)` |
| `highvalue` | `jumlah_keseluruhan >= 1000` |
| `aov` | `jumlah / kekerapan` |

#### `users`
Akaun login untuk staff sistem.

| Column | Type | Keterangan |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `email` | text (UNIQUE) | Email login |
| `password_hash` | text | scrypt hash |
| `full_name` | text | Nama penuh |
| `role` | text | `admin` / `manager` / `editor` / `viewer` |
| `active` | boolean | Status akaun |

#### `donor_notes`
Nota internal per donor.

#### `webhooks` + `webhook_logs`
Konfigurasi dan log outbound webhook.

---

## CSV Upload Flow

Format CSV yang diterima (7 kolum wajib):

```
name,phone,email,donation_date,amount,source,campaign
Ali Ahmad,60123456789,ali@gmail.com,2024-01-15,50.00,Facebook,FB-ramadan
```

**Flow bila upload:**

```
CSV
 │
 ▼
Parse & validate (headers + every row)
 │
 ├── Chunk 300 baris setiap kali:
 │
 │   1. Cek phone/email dalam donors table
 │        ├── Ada  → guna ID existing
 │        └── Tiada → INSERT baru ke donors
 │
 │   2. INSERT ke donations (linked via donor_id)
 │
 ▼
donor_summary VIEW auto-update
```

**Penting:** Upload CSV yang sama dua kali akan **duplikat donations**. Donors tidak duplikat (protected by UNIQUE constraint) tetapi transaksi akan dikira dua kali.

---

## Roles & Akses

| Role | Dashboard | Analytics | Add Donation | Duplicates | Webhooks | Staff | Users |
|---|---|---|---|---|---|---|---|
| `viewer` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `editor` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `manager` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Environment Variables

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=yourpassword
TOKEN_SECRET=random-secret-string
PORT=4000
```

---

## Getting Started (Local)

```bash
npm install
npm run dev     # frontend: http://localhost:5173
npm run server  # backend:  http://localhost:4000
```

---

## Supabase Schema Setup

Jalankan SQL ini dalam **Supabase → SQL Editor** untuk setup tables dari mula:

```sql
CREATE TABLE donors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  phone      text,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX donors_phone_unique
  ON donors (phone) WHERE phone IS NOT NULL AND trim(phone) != '';

CREATE UNIQUE INDEX donors_email_unique
  ON donors (lower(email)) WHERE email IS NOT NULL AND trim(email) != '';

CREATE TABLE donations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id      uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  donation_date date NOT NULL,
  amount        numeric(12,2) NOT NULL CHECK (amount >= 0),
  source        text,
  campaign_name text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX donations_donor_id_idx ON donations (donor_id);
CREATE INDEX donations_date_idx     ON donations (donation_date);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  role          text NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('admin','manager','editor','viewer')),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE donor_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id   uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhooks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  url        text NOT NULL,
  events     text NOT NULL,
  secret     text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id    uuid REFERENCES webhooks(id) ON DELETE SET NULL,
  event         text,
  status        text,
  response_code integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE VIEW donor_summary AS
SELECT
  d.id,
  d.name AS nama,
  d.phone, d.email, d.created_at, d.updated_at,
  COALESCE(s.donation_count, 0) AS kekerapan,
  COALESCE(s.total_amount, 0)   AS jumlah_keseluruhan,
  s.first_donation_date         AS tarikh_sumbangan_terdahulu,
  s.last_donation_date          AS tarikh_sumbangan_terkini,
  COALESCE(s.main_source, 'manual') AS source,
  CASE WHEN COALESCE(s.total_amount,0) >= 1000 THEN 'Ya' ELSE 'Tidak' END AS highvalue,
  CASE WHEN COALESCE(s.donation_count,0) = 0 THEN 0
       ELSE ROUND(s.total_amount / s.donation_count, 2) END AS aov,
  COALESCE(s.total_amount, 0) AS ltv
FROM donors d
LEFT JOIN (
  SELECT donor_id,
    COUNT(*)         AS donation_count,
    SUM(amount)      AS total_amount,
    MIN(donation_date) AS first_donation_date,
    MAX(donation_date) AS last_donation_date,
    (SELECT source FROM donations d2
     WHERE d2.donor_id = donations.donor_id AND d2.source IS NOT NULL
     ORDER BY donation_date DESC LIMIT 1) AS main_source
  FROM donations GROUP BY donor_id
) s ON s.donor_id = d.id;
```
