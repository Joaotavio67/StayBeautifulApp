import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { clientName, appointmentDate } = req.query

  if (!clientName || !appointmentDate) {
    return res.status(400).json({
      error: 'Missing required parameters: clientName and appointmentDate',
    })
  }

  try {
    // Find appointments
    const { data: appointments, error: fetchError } = await supabase
      .from('appointments')
      .select('id, client_name, appointment_date, appointment_time, service_id, status')
      .eq('client_name', clientName as string)
      .eq('appointment_date', appointmentDate as string)

    if (fetchError) throw fetchError

    if (!appointments || appointments.length === 0) {
      return res.status(404).json({
        error: 'No appointments found',
        searched: { clientName, appointmentDate },
      })
    }

    // Delete appointments
    const idsToDelete = appointments.map((a) => a.id)

    const { error: deleteError } = await supabase
      .from('appointments')
      .delete()
      .in('id', idsToDelete)

    if (deleteError) throw deleteError

    return res.status(200).json({
      success: true,
      message: `Deleted ${idsToDelete.length} appointment(s)`,
      deleted: {
        count: idsToDelete.length,
        ids: idsToDelete,
        appointments: appointments,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Delete appointment error:', error)
    return res.status(500).json({
      error: 'Failed to delete appointment',
      message: error?.message || 'Unknown error',
    })
  }
}
