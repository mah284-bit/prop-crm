import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password, full_name, role, company_id } = req.body

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name, 
        role,
        company_id: company_id || null  // passed to trigger
      }
    })

    if (authError) throw authError

    // Also explicitly update profile in case trigger runs before metadata is set
    await new Promise(r => setTimeout(r, 1500));
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        role,
        is_active: true,
        company_id: company_id || null,
      })
      .eq('id', authData.user.id)

    if (profileError) console.error('Profile update error:', profileError.message)

    return res.status(200).json({ user: authData.user })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}
