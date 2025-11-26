import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * ログインユーザーの所属Team一覧を取得
 * Team管理と同様、一つでもそのチームにアサインされているIssueがあればチームに所属していると判断
 * GET /api/users/me/teams
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

    // ユーザーにアサインされているタスクから、所属チームを取得
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('linear_team_id')
      .eq('assignee_email', userApproval.email)
      .not('linear_team_id', 'is', null)
      .not('linear_issue_id', 'is', null)

    if (tasksError) {
      console.error('Failed to fetch user tasks:', tasksError)
      return NextResponse.json(
        { error: 'Team情報の取得に失敗しました' },
        { status: 500 }
      )
    }

    // ユニークなlinear_team_idを取得
    const uniqueTeamIds = [...new Set(tasks?.map(t => t.linear_team_id).filter(Boolean))]

    if (uniqueTeamIds.length === 0) {
      return NextResponse.json({
        teams: [],
        count: 0,
      })
    }

    // チーム情報を取得
    const { data: teams, error: teamsError } = await supabase
      .from('linear_teams')
      .select('id, linear_team_id, name, key, description, icon, color, url')
      .in('linear_team_id', uniqueTeamIds)
      .order('name')

    if (teamsError) {
      console.error('Failed to fetch teams:', teamsError)
      return NextResponse.json(
        { error: 'Team情報の取得に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      teams: teams || [],
      count: teams?.length || 0,
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
