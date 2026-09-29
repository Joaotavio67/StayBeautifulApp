import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Crons always use GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Calculate date 3 days ago (as ISO timestamp)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const cutoffISODate = threeDaysAgo.toISOString() // Full ISO string for proper timestamp comparison

    // Count cancelled appointments to be deleted
    const { count: deleteCount } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .lt('created_at', cutoffISODate)

    // Delete cancelled appointments older than 3 days
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('status', 'cancelled')
      .lt('created_at', cutoffISODate)

    if (error) {
      console.error('Supabase delete error:', error)
      return res.status(500).json({
        error: 'Failed to delete cancelled appointments',
        message: error.message,
      })
    }

    console.log(`Cleanup job completed. Deleted ${deleteCount} cancelled appointments older than 3 days.`)

    return res.status(200).json({
      success: true,
      message: `Deleted ${deleteCount} cancelled appointments older than 3 days`,
      cutoffDate: cutoffISODate.split('T')[0],
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
