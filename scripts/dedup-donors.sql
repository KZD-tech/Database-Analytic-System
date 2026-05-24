-- Step 1: Re-assign all donations from duplicate email donors to the oldest donor
UPDATE donations
SET donor_id = keeper.id
FROM (
  SELECT DISTINCT ON (lower(trim(email)))
    id,
    email
  FROM donors
  WHERE email IS NOT NULL AND trim(email) <> ''
  ORDER BY lower(trim(email)), created_at ASC
) AS keeper
JOIN donors AS dup
  ON lower(trim(dup.email)) = lower(trim(keeper.email))
  AND dup.id <> keeper.id
WHERE donations.donor_id = dup.id;

-- Step 2: Delete duplicate email donors (keep oldest)
DELETE FROM donors
WHERE id IN (
  SELECT dup.id
  FROM donors AS dup
  JOIN (
    SELECT DISTINCT ON (lower(trim(email)))
      id,
      email
    FROM donors
    WHERE email IS NOT NULL AND trim(email) <> ''
    ORDER BY lower(trim(email)), created_at ASC
  ) AS keeper
    ON lower(trim(dup.email)) = lower(trim(keeper.email))
    AND dup.id <> keeper.id
);

-- Step 3: Re-assign donations from duplicate phone donors to oldest donor
UPDATE donations
SET donor_id = keeper.id
FROM (
  SELECT DISTINCT ON (trim(phone))
    id,
    phone
  FROM donors
  WHERE phone IS NOT NULL AND trim(phone) <> ''
  ORDER BY trim(phone), created_at ASC
) AS keeper
JOIN donors AS dup
  ON trim(dup.phone) = trim(keeper.phone)
  AND dup.id <> keeper.id
WHERE donations.donor_id = dup.id;

-- Step 4: Delete duplicate phone donors (keep oldest)
DELETE FROM donors
WHERE id IN (
  SELECT dup.id
  FROM donors AS dup
  JOIN (
    SELECT DISTINCT ON (trim(phone))
      id,
      phone
    FROM donors
    WHERE phone IS NOT NULL AND trim(phone) <> ''
    ORDER BY trim(phone), created_at ASC
  ) AS keeper
    ON trim(dup.phone) = trim(keeper.phone)
    AND dup.id <> keeper.id
);

-- Check result
SELECT COUNT(*) AS total_donors_after FROM donors;
