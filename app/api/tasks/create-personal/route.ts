import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // リクエストボディからタスク名、チームIDを取得
    const body = await request.json()
    const { taskName, teamId } = body

    if (!taskName || typeof taskName !== 'string') {
      return NextResponse.json({ error: 'Task name is required' }, { status: 400 })
    }

    // チームIDが指定された場合、linear_team_idを取得
    let linearTeamId: string | null = null
    if (teamId && typeof teamId === 'string') {
      const { data: team } = await supabase
        .from('linear_teams')
        .select('linear_team_id')
        .eq('id', teamId)
        .single()

      if (team?.linear_team_id) {
        linearTeamId = team.linear_team_id
      }
    }

    // ユーザー情報を取得
    const { data: userApproval } = await supabase
      .from('user_approvals')
      .select('email, approved')
      .eq('user_id', user.id)
      .single()

    if (!userApproval?.approved) {
      return NextResponse.json({ error: 'User not approved' }, { status: 403 })
    }

    if (!userApproval?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // 同名の個人タスクが既に存在するかチェック
    const { data: existingTask } = await supabase
      .from('tasks')
      .select('id, name')
      .eq('name', taskName)
      .eq('assignee_email', userApproval.email)
      .is('linear_issue_id', null)
      .maybeSingle()

    if (existingTask) {
      return NextResponse.json({
        message: `「${taskName}」タスクは既に存在します`,
        task: existingTask
      }, { status: 200 })
    }

    // 個人タスクを作成
    const { data: newTask, error: insertError } = await supabase
      .from('tasks')
      .insert({
        name: taskName,
        color: '#8b5cf6', // 紫色（個人タスク用）
        user_id: user.id,
        // 個人タスク用の設定
        linear_issue_id: null,
        linear_team_id: linearTeamId, // チームが選択された場合はそのチームID
        linear_project_id: null,
        linear_state_type: null,
        assignee_email: userApproval.email, // 自分のメールを設定（自分だけに見える）
        assignee_name: null,
        linear_identifier: null, // グループ分けはlinear_team_idで行う
        linear_url: null,
        priority: null,
        description: null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating personal task:', insertError)
      return NextResponse.json({
        error: 'Failed to create personal task',
        details: insertError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      message: `「${taskName}」タスクを作成しました`,
      task: newTask
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
