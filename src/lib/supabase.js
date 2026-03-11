import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Initializing Supabase client...')
console.log('Supabase URL:', supabaseUrl)
console.log('Anon Key present:', !!supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials!')
    throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'crimex-auth-token',
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'x-application-name': 'crimex-web-dashboard'
        }
    }
})

// Helper function to get current session
export const getCurrentSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
}

// Helper function to get current user
export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
}

// Helper function to sign out
export const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

// IMPORTANT: remove default export to avoid import mismatches
// export default supabase