import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { PostgrestError } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('Migration: checking and creating enable_payment column...')

    // Step 1: Check if column exists
    const { error: testError } = await supabase
      .from('services')
      .select('enable_payment')
      .limit(1)

    if (!testError) {
      return res.status(200).json({
        success: true,
        message: '✅ Column already exists - migration complete!',
        timestamp: new Date().toISOString(),
      })
    }

    // Step 2: Column doesn't exist - try to create it via RPC
    console.log('Column does not exist, attempting to create...')

    // Try to use sql.run via Supabase admin client
    const { data, error: migrationError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE services ADD COLUMN enable_payment BOOLEAN DEFAULT false;',
    }).catch(err => ({ data: null, error: err }))

    if (!migrationError && data) {
      return res.status(200).json({
        success: true,
        message: '✅ Migration executed successfully!',
        result: data,
        timestamp: new Date().toISOString(),
      })
    }

    // Step 3: If RPC failed, try direct query via Postgres
    console.log('RPC not available, trying alternative method...')

    // Try using the query method if available
    const query = 'ALTER TABLE services ADD COLUMN IF NOT EXISTS enable_payment BOOLEAN DEFAULT false;'

    // Attempt via fetch to admin API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ sql: query }),
    }).catch(err => null)

    if (response && response.ok) {
      return res.status(200).json({
        success: true,
        message: '✅ Migration created successfully!',
        timestamp: new Date().toISOString(),
      })
    }

    // Step 4: All methods failed - suggest manual approach
    console.log('Could not execute migration automatically')
    return res.status(400).json({
      error: 'Auto-migration not available',
      message: 'Please run this SQL query manually in Supabase SQL Editor:',
      query: 'ALTER TABLE services ADD COLUMN IF NOT EXISTS enable_payment BOOLEAN DEFAULT false;',
      manualSteps: [
        '1. Go to: https://app.supabase.com',
        '2. Select your project',
        '3. Click "SQL Editor" (left sidebar)',
        '4. Click "New Query"',
        '5. Paste: ALTER TABLE services ADD COLUMN IF NOT EXISTS enable_payment BOOLEAN DEFAULT false;',
        '6. Click "Run"',
        '7. Done! The column is created',
      ],
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Migration error:', error)

    return res.status(500).json({
      error: 'Migration process failed',
      message: error?.message || 'Unknown error',
      suggestion: 'Try running the SQL query manually in Supabase SQL Editor',
      query: 'ALTER TABLE services ADD COLUMN IF NOT EXISTS enable_payment BOOLEAN DEFAULT false;',
      timestamp: new Date().toISOString(),
    })
  }
}
