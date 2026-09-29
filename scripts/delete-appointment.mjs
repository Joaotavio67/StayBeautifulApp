const supabaseUrl = 'https://uobbgzlcryhqwkrrnxu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function deleteAppointment() {
  try {
    console.log('Procurando agendamento de "joao"...');

    // Search for appointments
    const searchUrl = `${supabaseUrl}/rest/v1/appointments?client_name=eq.joao&appointment_date=eq.2026-09-29&select=*`;

    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      }
    });

    if (!searchRes.ok) {
      throw new Error(`Search failed: ${searchRes.status} ${searchRes.statusText}`);
    }

    const appointments = await searchRes.json();

    if (!appointments || appointments.length === 0) {
      console.log('Nenhum agendamento encontrado para joao em 2026-09-29');
      process.exit(1);
    }

    console.log(`Encontrado ${appointments.length} agendamento(s):`);
    appointments.forEach(a => {
      console.log(`  - ID: ${a.id}`);
      console.log(`    Nome: ${a.client_name}`);
      console.log(`    Serviço: ${a.service_id}`);
      console.log(`    Data: ${a.appointment_date} ${a.appointment_time}`);
      console.log(`    Status: ${a.status}`);
    });

    // Delete all found appointments
    const appointmentIds = appointments.map(a => a.id);

    for (const id of appointmentIds) {
      const deleteUrl = `${supabaseUrl}/rest/v1/appointments?id=eq.${id}`;

      const deleteRes = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        }
      });

      if (!deleteRes.ok) {
        throw new Error(`Delete failed for ID ${id}: ${deleteRes.status} ${deleteRes.statusText}`);
      }
    }

    console.log(`\n✅ Deletado com sucesso!`);
    console.log(`${appointmentIds.length} agendamento(s) removido(s) do banco de dados`);

  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

deleteAppointment();
