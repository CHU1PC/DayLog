import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUserLinearTeams } from '@/lib/linear'

/**
 * ログインユーザーの所属Team一覧を取得
 * Linear APIを使ってユーザーが所属しているチームを取得（1回のAPI呼び出しで全チーム取得）
 * GET /api/users/me/teams
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Linear API Keyの確認
    const linearApiKey = process.env.LINEAR_API_KEY
    if (!linearApiKey) {
      return NextResponse.json({ error: 'LINEAR_API_KEY not configured' }, { status: 500 })
    }

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // ユーザーのメールアドレスを取得
    const { data: userApproval } = await supabase
      .from('user_approvals')
      .select('email')
      .eq('user_id', user.id)
      .single()

    if (!userApproval?.email) {
      return NextResponse.json({
        teams: [],
        count: 0,
      })
    }

    // Linear APIからユーザーの所属チームを1回で取得
    console.log('[/api/users/me/teams] Fetching teams for email:', userApproval.email)
    const linearTeams = await getUserLinearTeams(linearApiKey, userApproval.email)
    console.log('[/api/users/me/teams] Linear API returned teams:', linearTeams)

    if (linearTeams.length === 0) {
      console.log('[/api/users/me/teams] No teams found from Linear API')
      return NextResponse.json({
        teams: [],
        count: 0,
      })
    }

    // Linear Team IDのリストを取得
    const linearTeamIds = linearTeams.map(t => t.id)
    console.log('[/api/users/me/teams] Linear team IDs:', linearTeamIds)

    // DBから該当するチームの詳細情報を取得
    const { data: dbTeams, error: teamsError } = await supabase
      .from('linear_teams')
      .select('id, linear_team_id, name, key, description, icon, color, url')
      .in('linear_team_id', linearTeamIds)
      .order('name')

    console.log('[/api/users/me/teams] DB teams found:', dbTeams)

    if (teamsError) {
      console.error('Failed to fetch teams from DB:', teamsError)
      return NextResponse.json(
        { error: 'Team情報の取得に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      teams: dbTeams || [],
      count: dbTeams?.length || 0,
    })
  } catch (error) {
    console.error('User teams fetch error:', error)
    return NextResponse.json(
      {
        error: 'Team情報の取得に失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー',
      },
      { status: 500 }
    )
  }
}
