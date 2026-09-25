import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuid } from 'crypto'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { serviceId, clientName, clientPhone, appointmentDate, appointmentTime } = req.body

  if (!serviceId || !clientName || !clientPhone || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Generate cancel token
    const cancelToken = uuid().replace(/-/g, '').substring(0, 32)

    // Get service to get price
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('price')
      .eq('id', serviceId)
      .single()

    if (serviceError || !service) {
      return res.status(404).json({ error: 'Service not found' })
    }

    // Insert appointment
    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        service_id: serviceId,
        client_name: clientName,
        client_phone: clientPhone.replace(/\D/g, ''),
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        status: 'confirmed',
        cancel_token: cancelToken,
        price: service.price,
        avisado_whatsapp: false,
      })
      .select('*')
      .single()

    if (insertError || !appointment) {
      throw insertError || new Error('Failed to create appointment')
    }

    return res.status(200).json({
      success: true,
      message: 'Appointment created successfully',
      appointment,
    })
  } catch (error: any) {
    console.error('Create appointment error:', error)
    return res.status(500).json({
      error: 'Failed to create appointment',
      message: error?.message || 'Unknown error',
    })
  }
}
