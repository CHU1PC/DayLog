import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getLinearTeamMembers } from '@/lib/linear'

/**
 * 全Teamとそのメンバー情報を取得（管理者のみ）
 * GET /api/admin/teams/members
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 管理者チェック
    const { data: userData, error: userError } = await supabase
      .from('user_approvals')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    // Linear API Keyの確認
    const linearApiKey = process.env.LINEAR_API_KEY
    if (!linearApiKey) {
      return NextResponse.json({ error: 'LINEAR_API_KEY not configured' }, { status: 500 })
    }

    // 全Teamを取得
    const { data: teams, error: teamsError } = await supabase
      .from('linear_teams')
      .select('*')
      .order('name', { ascending: true })

    if (teamsError) {
      return NextResponse.json(
        { error: 'Team一覧の取得に失敗しました' },
        { status: 500 }
      )
    }

    // 各TeamのメンバーとProject数を取得（Linear APIを使用）
    const teamsWithCounts = await Promise.all(
      (teams || []).map(async (team) => {
        // Linear APIからメンバーを取得
        let linearMembers: Array<{ id: string; email: string; name: string; displayName?: string; active: boolean }> = []
        try {
          linearMembers = await getLinearTeamMembers(linearApiKey, team.linear_team_id)
        } catch (err) {
          console.error('Failed to fetch members from Linear for team:', team.id, err)
        }

        // DBのuser_approvalsとマッチングして追加情報を取得
        const memberEmails = linearMembers.map(m => m.email).filter(Boolean)
        let dbMembers: any[] = []
        if (memberEmails.length > 0) {
          const { data: dbUsers } = await supabase
            .from('user_approvals')
            .select('user_id, email, role, approved')
            .in('email', memberEmails)
          dbMembers = dbUsers || []
        }

        // Linear APIのメンバー情報とDBの情報をマージ
        const members = linearMembers.map(lm => {
          const dbUser = dbMembers.find(u => u.email === lm.email)
          return {
            user_id: dbUser?.user_id || null,
            email: lm.email,
            name: lm.name || lm.displayName || lm.email,
            role: dbUser?.role || null,
            approved: dbUser?.approved || false,
            active: lm.active,
          }
        })

        // プロジェクト数を取得
        const { count: projectCount } = await supabase
          .from('linear_projects')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id)

        return {
          ...team,
          members,
          memberCount: members.length,
          projectCount: projectCount || 0,
        }
      })
    )

    return NextResponse.json({
      teams: teamsWithCounts,
      count: teamsWithCounts.length,
    })
  } catch (error) {
    console.error('Teams with members fetch error:', error)
    return NextResponse.json(
      {
        error: 'Team情報の取得に失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー',
      },
      { status: 500 }
    )
  }
}
