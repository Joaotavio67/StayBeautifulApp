import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Crons always use GET and include a verification token
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify the request is from Vercel Cron
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0] // YYYY-MM-DD format

    // Count cancelled appointments to be deleted
    const { count: deleteCount } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .lt('created_at', cutoffDate)

    // Delete cancelled appointments older than 7 days
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('status', 'cancelled')
      .lt('created_at', cutoffDate)

    if (error) {
      console.error('Supabase delete error:', error)
      return res.status(500).json({
        error: 'Failed to delete cancelled appointments',
        message: error.message,
      })
    }

    console.log(`Cleanup job completed. Deleted ${deleteCount} cancelled appointments older than 7 days.`)

    return res.status(200).json({
      success: true,
      message: `Deleted ${deleteCount} cancelled appointments older than 7 days`,
      cutoffDate: cutoffDate,
      deleted: deleteCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Cleanup error:', error)
    return res.status(500).json({
      error: 'Cleanup job failed',
      message: error?.message || 'Unknown error',
    })
  }
}
