import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Require authorization header with a secret token
  const authHeader = req.headers.authorization
  const expectedToken = `Bearer ${process.env.ADMIN_CLEANUP_TOKEN}`

  if (!authHeader || authHeader !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Get all cancelled appointments
    const { data: allAppointments, error: fetchError } = await supabase
      .from('appointments')
      .select('id, created_at, updated_at, status')
      .eq('status', 'cancelled')

    if (fetchError) {
      throw fetchError
    }

    if (!allAppointments || allAppointments.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No cancelled appointments found',
        deleted: 0,
      })
    }

    // Calculate 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Find appointments older than 7 days
    const appointmentsToDelete = allAppointments.filter((appt) => {
      const updatedDate = new Date(appt.updated_at || appt.created_at)
      return updatedDate < sevenDaysAgo
    })

    if (appointmentsToDelete.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No cancelled appointments older than 7 days found',
        deleted: 0,
      })
    }

    // Delete the old appointments
    const idsToDelete = appointmentsToDelete.map((a) => a.id)

    const { error: deleteError, count } = await supabase
      .from('appointments')
      .delete()
      .in('id', idsToDelete)
      .select('*', { head: true, count: 'exact' })

    if (deleteError) {
      throw deleteError
    }

    console.log(`Manual cleanup completed. Deleted ${count} cancelled appointments older than 7 days.`)

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${count} cancelled appointments older than 7 days`,
      deleted: count,
      appointmentIds: idsToDelete,
      cutoffDate: sevenDaysAgo.toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Manual cleanup error:', error)
    return res.status(500).json({
      error: 'Manual cleanup failed',
      message: error?.message || 'Unknown error',
    })
  }
}
