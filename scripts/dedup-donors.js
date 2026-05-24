/**
 * One-time script to merge duplicate donor records that share the same email or phone.
 * For each duplicate group: keep the oldest record, re-point all donations to it, delete the rest.
 *
 * Run with: node --env-file=.env scripts/dedup-donors.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY,
  { auth: { persistSession: false } }
);

async function fetchAll(table, columns = '*') {
  const batchSize = 1000;
  let all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(offset, offset + batchSize - 1);
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }
  return all;
}

async function mergeGroup(keep, duplicates, label) {
  const dupIds = duplicates.map((d) => d.id);
  console.log(`  Keeping donor ${keep.id} (${keep.name || keep.email}), merging ${dupIds.length} duplicate(s): [${dupIds.join(', ')}]`);

  // Re-assign all donations from duplicate donors to the kept donor
  for (const dupId of dupIds) {
    const { error } = await supabase
      .from('donations')
      .update({ donor_id: keep.id })
      .eq('donor_id', dupId);
    if (error) throw new Error(`Re-assign donations for donor ${dupId}: ${error.message}`);
  }

  // Delete the duplicate donor records
  for (const dupId of dupIds) {
    const { error } = await supabase.from('donors').delete().eq('id', dupId);
    if (error) throw new Error(`Delete donor ${dupId}: ${error.message}`);
  }
}

async function run() {
  console.log('Fetching all donors…');
  const donors = await fetchAll('donors', 'id, name, phone, email, created_at');
  console.log(`Total donors: ${donors.length}`);

  // --- Deduplicate by EMAIL ---
  const byEmail = {};
  for (const d of donors) {
    const key = (d.email || '').trim().toLowerCase();
    if (!key) continue;
    if (!byEmail[key]) byEmail[key] = [];
    byEmail[key].push(d);
  }

  let emailMergeCount = 0;
  for (const [email, group] of Object.entries(byEmail)) {
    if (group.length < 2) continue;
    // Keep the oldest (smallest created_at), fallback to smallest id string
    group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const [keep, ...duplicates] = group;
    console.log(`\n[EMAIL] "${email}" has ${group.length} records:`);
    await mergeGroup(keep, duplicates, 'email');
    emailMergeCount += duplicates.length;
  }

  // --- Re-fetch donors after email dedup ---
  console.log('\nRe-fetching donors after email dedup…');
  const donors2 = await fetchAll('donors', 'id, name, phone, email, created_at');

  // --- Deduplicate by PHONE ---
  const byPhone = {};
  for (const d of donors2) {
    const key = (d.phone || '').trim().replace(/\s+/g, '');
    if (!key) continue;
    if (!byPhone[key]) byPhone[key] = [];
    byPhone[key].push(d);
  }

  let phoneMergeCount = 0;
  for (const [phone, group] of Object.entries(byPhone)) {
    if (group.length < 2) continue;
    group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const [keep, ...duplicates] = group;
    console.log(`\n[PHONE] "${phone}" has ${group.length} records:`);
    await mergeGroup(keep, duplicates, 'phone');
    phoneMergeCount += duplicates.length;
  }

  console.log('\n✓ Deduplication complete.');
  console.log(`  Merged by email: ${emailMergeCount} duplicate(s) removed`);
  console.log(`  Merged by phone: ${phoneMergeCount} duplicate(s) removed`);
  console.log(`  Total removed: ${emailMergeCount + phoneMergeCount}`);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
