import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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
    console.log('Checking if enable_payment column exists...')

    // Check if column exists by trying to select it
    const { error: testError } = await supabase
      .from('services')
      .select('enable_payment')
      .limit(1)

    if (!testError) {
      return res.status(200).json({
        success: true,
        message: 'Column already exists - migration complete!',
        timestamp: new Date().toISOString(),
      })
    }

    // Column doesn't exist - provide instructions
    return res.status(400).json({
      error: 'Column does not exist yet',
      message: 'Please run this SQL query in Supabase SQL Editor:',
      query: 'ALTER TABLE services ADD COLUMN enable_payment BOOLEAN DEFAULT false;',
      instructions: [
        '1. Go to Supabase dashboard: https://app.supabase.com',
        '2. Select your project',
        '3. Navigate to "SQL Editor" in the left sidebar',
        '4. Click "New Query"',
        '5. Copy and paste: ALTER TABLE services ADD COLUMN enable_payment BOOLEAN DEFAULT false;',
        '6. Click "Run" button',
        '7. After success, call this endpoint again to verify',
      ],
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Migration check error:', error)

    return res.status(500).json({
      error: 'Migration check failed',
      message: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    })
  }
}
