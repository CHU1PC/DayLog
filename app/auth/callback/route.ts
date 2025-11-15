import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Cookie setting is handled by proxy/middleware
            // This is intentionally left empty per Supabase SSR docs
          },
        },
      }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('❌ Error exchanging code for session:', error)
      return NextResponse.redirect(`${origin}/login?error=認証に失敗しました`)
    }

    // 承認状態を確認
    if (data.user) {
      const { data: approvalData } = await supabase
        .from('user_approvals')
        .select('approved')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (approvalData && approvalData.approved) {
        console.log('✅ User is approved, redirecting to:', `${origin}/`)
        return NextResponse.redirect(`${origin}${next}`)
      } else {
        console.log('⏳ User is not approved yet, redirecting to pending-approval')
        return NextResponse.redirect(`${origin}/pending-approval`)
      }
    }

    return NextResponse.redirect(`${origin}${next}`)
  }

  // codeがない場合はログインページにリダイレクト
  return NextResponse.redirect(`${origin}/login`)
}
