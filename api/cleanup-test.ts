import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  const expectedToken = `Bearer ${process.env.ADMIN_CLEANUP_TOKEN}`

  if (!authHeader || authHeader !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized', received: authHeader })
  }

  // Test if env vars are present
  const hasUrl = !!process.env.VITE_SUPABASE_URL
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const hasToken = !!process.env.ADMIN_CLEANUP_TOKEN

  return res.status(200).json({
    success: true,
    message: 'Cleanup test endpoint',
    envVars: {
      VITE_SUPABASE_URL: hasUrl ? '✓ Present' : '✗ Missing',
      SUPABASE_SERVICE_ROLE_KEY: hasKey ? '✓ Present' : '✗ Missing',
      ADMIN_CLEANUP_TOKEN: hasToken ? '✓ Present' : '✗ Missing',
    },
    timestamp: new Date().toISOString(),
  })
}
