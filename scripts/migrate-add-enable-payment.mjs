import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uobbgzlcryhqwkrrnxu.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  try {
    console.log('Checking if enable_payment column exists...');

    // Try to fetch with the new column
    const { data: testData, error: testError } = await supabase
      .from('services')
      .select('enable_payment')
      .limit(1);

    if (!testError) {
      console.log('✅ Column already exists!');
      process.exit(0);
    }

    console.log('Adding enable_payment column to services table...');

    // Execute the migration via Postgres RPC or direct SQL
    // Since we don't have RPC, we'll use the admin API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_migration`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'params=single-object',
      },
      body: JSON.stringify({
        sql: `ALTER TABLE services ADD COLUMN enable_payment BOOLEAN DEFAULT false;`,
      }),
    });

    if (!response.ok) {
      // If RPC doesn't work, try direct SQL via pg_dump alternative
      console.log('RPC not available, attempting alternative approach...');

      // Update all existing services to have enable_payment = false
      const { error: updateError } = await supabase
        .from('services')
        .update({ enable_payment: false })
        .neq('id', null);

      if (updateError?.message?.includes('column') && updateError?.message?.includes('does not exist')) {
        throw new Error('Please add enable_payment column manually via Supabase dashboard');
      }

      if (updateError) throw updateError;
    }

    console.log('✅ Migration completed successfully!');
    console.log('All existing services have enable_payment = false');
    console.log('You can now enable payment for specific services in the admin panel');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error('\n📝 Manual workaround:');
    console.error('1. Go to Supabase dashboard');
    console.error('2. Navigate to SQL Editor');
    console.error('3. Run this query:');
    console.error('   ALTER TABLE services ADD COLUMN enable_payment BOOLEAN DEFAULT false;');
    process.exit(1);
  }
}

migrate();
