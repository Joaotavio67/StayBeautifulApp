import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return res.status(200).json({
    success: true,
    message: 'Cleanup system is active',
    info: {
      cronJob: 'Runs daily at 00:00 UTC',
      method: 'Automatically deletes cancelled appointments older than 7 days',
      lastStatus: 'System configured and deployed',
    },
    timestamp: new Date().toISOString(),
  })
}
