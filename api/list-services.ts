import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select('id, name, price, duration_minutes')
      .eq('is_active', true)
      .order('name')

    if (error) throw error

    return res.status(200).json({
      success: true,
      services: services || [],
    })
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to list services',
      message: error?.message || 'Unknown error',
    })
  }
}
