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

    // リクエストボディからタスク名、ラベル、チームIDを取得
    const body = await request.json()
    const { taskName, label, teamId } = body

    if (!taskName || typeof taskName !== 'string') {
      return NextResponse.json({ error: 'Task name is required' }, { status: 400 })
    }

    if (!label || typeof label !== 'string') {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 })
    }

    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 })
    }

    // ユーザーのメールアドレスを取得
    const { data: userApproval } = await supabase
      .from('user_approvals')
      .select('email')
      .eq('user_id', user.id)
      .single()

    if (!userApproval?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // チーム情報を取得
    const { data: team, error: teamError } = await supabase
      .from('linear_teams')
      .select('id, linear_team_id, name, key')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // ユーザーがこのチームに所属しているか確認（アサインされているLinear Issueがあるか）
    const { data: membershipCheck } = await supabase
      .from('tasks')
      .select('id')
      .eq('assignee_email', userApproval.email)
      .eq('linear_team_id', team.linear_team_id)
      .not('linear_issue_id', 'is', null)
      .limit(1)

    if (!membershipCheck || membershipCheck.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 })
    }

    // 同名のチームタスクが既に存在するかチェック
    const { data: existingTask } = await supabase
      .from('tasks')
      .select('id, name')
      .eq('name', taskName)
      .is('linear_issue_id', null)
      .eq('linear_team_id', team.linear_team_id)
      .is('assignee_email', null)
      .maybeSingle()

    if (existingTask) {
      return NextResponse.json({
        message: `「${taskName}」タスクは既に存在します`,
        task: existingTask
      }, { status: 200 })
    }

    // チームタスクを作成（Linear連携なし、チームメンバーが使える）
    const { data: newTask, error: insertError } = await supabase
      .from('tasks')
      .insert({
        name: taskName,
        color: '#3b82f6', // 青色（チームタスク用）
        user_id: user.id,
        // Linear関連のフィールド
        linear_issue_id: null,
        linear_team_id: team.linear_team_id,
        linear_project_id: null,
        linear_state_type: null,
        assignee_email: null, // チームタスクはassignee_emailをnullに
        assignee_name: null,
        linear_identifier: label, // ラベル名を保存（グループ分けに使用）
        linear_url: null,
        priority: null,
        description: `このタスクは${team.name}チームのメンバーが使用できる共通タスクです`,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating team task:', insertError)
      return NextResponse.json({
        error: 'Failed to create team task',
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
