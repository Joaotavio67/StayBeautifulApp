import { supabase } from './src/lib/supabase'

async function deleteTestAppointment() {
  try {
    // Find and delete João Otávio's test appointment
    const { data: appointments, error: fetchError } = await supabase
      .from('appointments')
      .select('id, client_name, status')
      .eq('client_name', 'João Otávio')
      .eq('status', 'completed')

    if (fetchError) {
      console.error('Erro ao buscar agendamento:', fetchError)
      return
    }

    if (!appointments || appointments.length === 0) {
      console.log('Nenhum agendamento encontrado para João Otávio com status "completed"')
      return
    }

    console.log('Agendamentos encontrados:', appointments)

    // Delete each appointment
    for (const appt of appointments) {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appt.id)

      if (error) {
        console.error(`Erro ao deletar ${appt.id}:`, error)
      } else {
        console.log(`✅ Deletado: ${appt.id} (${appt.client_name})`)
      }
    }
  } catch (err) {
    console.error('Erro:', err)
  }
}

deleteTestAppointment()
