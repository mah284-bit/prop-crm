import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user_id, password } = req.body

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password })
    if (error) throw error
    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}
