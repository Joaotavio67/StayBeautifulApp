import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync } from 'fs';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = new URL('../.env.local', import.meta.url).pathname;

try {
  const envContent = readFileSync(envPath.replace(/^\/%3A/, '').replace(/%/g, '%'), 'utf8');
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').replace(/^"|"$/g, '');
      process.env[key.trim()] = value;
    }
  });
} catch (e) {
  console.log('Could not load .env.local, using process.env');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAppointment() {
  try {
    // First, find the service ID for "Coloração e Escova"
    const { data: services, error: serviceError } = await supabase
      .from('services')
      .select('id, name, price')
      .ilike('name', '%coloração%')
      .ilike('name', '%escova%');

    if (serviceError) throw serviceError;

    if (!services || services.length === 0) {
      console.log('Service not found. Available services:');
      const { data: allServices } = await supabase
        .from('services')
        .select('id, name, price')
        .eq('is_active', true);
      console.table(allServices);
      process.exit(1);
    }

    const service = services[0];
    console.log(`Found service: ${service.name} (ID: ${service.id})`);

    // Create the appointment
    const cancelToken = randomUUID().replace(/-/g, '').substring(0, 32);
    const appointmentDate = '2026-09-24'; // Yesterday
    const appointmentTime = '20:00:00';
    const clientPhone = '11964157641'; // Remove formatting

    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        service_id: service.id,
        client_name: 'Lola',
        client_phone: clientPhone,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        status: 'confirmed',
        cancel_token: cancelToken,
        price: service.price,
        avisado_whatsapp: false,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    console.log('\n✅ Appointment created successfully!');
    console.log('Appointment Details:');
    console.table({
      'Client Name': appointment.client_name,
      'Phone': appointment.client_phone,
      'Service': service.name,
      'Date': appointment.appointment_date,
      'Time': appointment.appointment_time,
      'Price': appointment.price,
      'Status': appointment.status,
    });

    console.log('\nNow you can:');
    console.log('1. Go to Admin → Agenda');
    console.log('2. Find "Lola" in the appointments list');
    console.log('3. Click "✓ Concluído" to mark as completed');
    console.log('4. This will trigger the Google Maps review request via WhatsApp');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createAppointment();
