-- Run this in Supabase → SQL Editor
-- This replaces 65+ API calls with a single DB query for the dashboard

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'total',             COUNT(*),
    'total_collection',  COALESCE(ROUND(SUM(jumlah_keseluruhan)::numeric, 2), 0),
    'total_transactions',COALESCE(SUM(kekerapan), 0),
    'avg_order_value',   CASE
                           WHEN COALESCE(SUM(kekerapan), 0) > 0
                           THEN ROUND((SUM(jumlah_keseluruhan) / SUM(kekerapan))::numeric, 2)
                           ELSE 0
                         END,
    'new',     COUNT(*) FILTER (WHERE
                 kekerapan = 0
                 OR tarikh_sumbangan_terkini IS NULL
                 OR (kekerapan = 1
                     AND NOW() - tarikh_sumbangan_terkini::timestamptz <= INTERVAL '30 days')
               ),
    'active',  COUNT(*) FILTER (WHERE
                 kekerapan = 1
                 AND NOW() - tarikh_sumbangan_terkini::timestamptz > INTERVAL '30 days'
                 AND NOW() - tarikh_sumbangan_terkini::timestamptz <= INTERVAL '90 days'
               ),
    'repeat',  COUNT(*) FILTER (WHERE
                 kekerapan >= 2
                 AND NOW() - tarikh_sumbangan_terkini::timestamptz <= INTERVAL '90 days'
               ),
    'dormant', COUNT(*) FILTER (WHERE
                 tarikh_sumbangan_terkini IS NOT NULL
                 AND kekerapan > 0
                 AND NOW() - tarikh_sumbangan_terkini::timestamptz > INTERVAL '90 days'
                 AND NOW() - tarikh_sumbangan_terkini::timestamptz <= INTERVAL '365 days'
               ),
    'churn',   COUNT(*) FILTER (WHERE
                 tarikh_sumbangan_terkini IS NOT NULL
                 AND kekerapan > 0
                 AND NOW() - tarikh_sumbangan_terkini::timestamptz > INTERVAL '365 days'
               )
  )
  FROM donor_summary;
$$;
