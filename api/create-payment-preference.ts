import { VercelRequest, VercelResponse } from '@vercel/node'
import { MercadoPagoConfig, Preference } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { appointmentId, clientName, serviceName, price, appointmentDate, appointmentTime } = req.body

  // Validate required fields
  if (!appointmentId || !clientName || !serviceName || !price || price <= 0) {
    return res.status(400).json({ error: 'Missing or invalid required fields' })
  }

  try {
    const preference = new Preference(client)

    const result = await preference.create({
      body: {
        items: [
          {
            id: appointmentId,
            title: `Agendamento: ${serviceName}`,
            description: `Data: ${appointmentDate} às ${appointmentTime}\nCliente: ${clientName}`,
            quantity: 1,
            unit_price: price,
            currency_id: 'BRL',
          },
        ],
        payer: {
          name: clientName,
        },
        // Redirect URLs
        back_urls: {
          success: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'}/confirmacao`,
          failure: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'}/confirmacao`,
          pending: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'}/confirmacao`,
        },
        auto_return: 'approved',
        // Metadata to track appointment
        metadata: {
          appointmentId,
        },
      },
    })

    return res.status(200).json({
      success: true,
      init_point: result.init_point,
      preferenceId: result.id,
    })
  } catch (error: any) {
    console.error('Mercado Pago error:', error)
    return res.status(500).json({
      error: 'Failed to create payment preference',
      message: error?.message || 'Unknown error',
    })
  }
}
