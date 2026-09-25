import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Use environment variables directly
const supabaseUrl = 'https://uobbgzlcryhqwkrrnxu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAppointment() {
  try {
    console.log('Searching for "Coloração e Escova" service...');

    // Find the service
    const { data: services, error: serviceError } = await supabase
      .from('services')
      .select('id, name, price')
      .eq('is_active', true)
      .order('name');

    if (serviceError) throw serviceError;

    if (!services || services.length === 0) {
      console.log('No services found');
      process.exit(1);
    }

    const coloracaoService = services.find(s =>
      s.name.toLowerCase().includes('coloração') &&
      s.name.toLowerCase().includes('escova')
    );

    if (!coloracaoService) {
      console.log('Available services:');
      services.forEach(s => console.log(`  - ${s.name} (ID: ${s.id})`));
      process.exit(1);
    }

    console.log(`✓ Found: ${coloracaoService.name}`);

    // Create appointment
    const cancelToken = randomUUID().replace(/-/g, '').substring(0, 32);

    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        service_id: coloracaoService.id,
        client_name: 'Lola',
        client_phone: '11964157641',
        appointment_date: '2026-09-24',
        appointment_time: '20:00:00',
        status: 'confirmed',
        cancel_token: cancelToken,
        price: coloracaoService.price,
        avisado_whatsapp: false,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    console.log('\n✅ Agendamento criado com sucesso!');
    console.log('Detalhes:');
    console.log(`  Cliente: ${appointment.client_name}`);
    console.log(`  Telefone: ${appointment.client_phone}`);
    console.log(`  Serviço: ${coloracaoService.name}`);
    console.log(`  Data: ${appointment.appointment_date}`);
    console.log(`  Hora: ${appointment.appointment_time.substring(0, 5)}`);
    console.log(`  Preço: R$ ${appointment.price}`);
    console.log(`\nProximos passos:`);
    console.log('1. Acesse: https://staybeautifuljoyce.vercel.app/admin/agenda');
    console.log('2. Encontre "Lola" na lista de agendamentos');
    console.log('3. Clique em "✓ Concluído"');
    console.log('4. A mensagem de avaliação será enviada automáticamente!');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createAppointment();
