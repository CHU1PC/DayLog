import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.error('[API] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized', details: authError.message }, { status: 401 })
    }
    if (!user) {
      console.error('[API] No user found')
      return NextResponse.json({ error: 'Unauthorized', details: 'No user found' }, { status: 401 })
    }

    // 管理者チェック
    const { data: userData, error: userError } = await supabase
      .from('user_approvals')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 全ユーザーを取得
    const { data: users, error: usersError } = await supabase
      .from('user_approvals')
      .select('user_id, email, name, role, approved')
      .eq('approved', true)
      .order('name')

    if (usersError) {
      throw usersError
    }

    // 各ユーザーのTeam情報を取得
    const usersWithTeams = await Promise.all(
      (users || []).map(async (user) => {
        // ユーザーが現在作業中のタスクを取得（end_timeがnullの時間エントリ）
        console.log(`[API] Querying time_entries for user_id: ${user.user_id}`)

        const { data: activeTimeEntries, error: timeEntriesError } = await supabase
          .from('time_entries')
          .select(`
            id,
            task_id,
            start_time,
            tasks (
              id,
              name,
              color,
              linear_identifier,
              linear_state_type,
              priority
            )
          `)
          .eq('user_id', user.user_id)
          .is('end_time', null)
          .order('start_time', { ascending: false })

        console.log(`[API] Active time entries for user ${user.email} (user_id: ${user.user_id}):`, activeTimeEntries)

        const currentTask = activeTimeEntries && activeTimeEntries.length > 0
          ? {
              task_id: activeTimeEntries[0].task_id,
              task_name: (activeTimeEntries[0].tasks as any)?.name || 'Unknown',
              task_color: (activeTimeEntries[0].tasks as any)?.color || '#6366f1',
              linear_identifier: (activeTimeEntries[0].tasks as any)?.linear_identifier || null,
              linear_state_type: (activeTimeEntries[0].tasks as any)?.linear_state_type || null,
              priority: (activeTimeEntries[0].tasks as any)?.priority || 0,
              start_time: activeTimeEntries[0].start_time,
            }
          : null

        console.log(`[API] Current task for user ${user.email}:`, currentTask)

        if (timeEntriesError) {
          console.error('Error fetching active time entries for user:', user.user_id, timeEntriesError)
        }

        // ユーザーにアサインされているすべてのIssueを取得
        const { data: userIssues, error: issuesError } = await supabase
          .from('tasks')
          .select('id, name, linear_issue_id, linear_team_id, linear_state_type, linear_identifier, description, assignee_email, assignee_name, priority, linear_url')
          .eq('assignee_email', user.email)
          .not('linear_issue_id', 'is', null)

        if (issuesError) {
          console.error('Error fetching issues for user:', user.user_id, issuesError)
          return { ...user, teams: [], currentTask }
        }

        console.log(`[API] Fetched ${userIssues?.length || 0} total issues for user ${user.email}`)

        // TeamごとにIssueをグループ化
        const teamIssuesMap = new Map<string, any[]>()

        ;(userIssues || []).forEach((issue) => {
          if (!issue.linear_team_id) return

          if (!teamIssuesMap.has(issue.linear_team_id)) {
            teamIssuesMap.set(issue.linear_team_id, [])
          }

          teamIssuesMap.get(issue.linear_team_id)!.push(issue)
        })

        // 各TeamのIssuesをソート: Done以外を上に、その上で優先度順（高い方が上）
        teamIssuesMap.forEach((issues) => {
          issues.sort((a, b) => {
            // 1. まずDone（completed/canceled）かどうかで分ける
            const aIsDone = a.linear_state_type === 'completed' || a.linear_state_type === 'canceled'
            const bIsDone = b.linear_state_type === 'completed' || b.linear_state_type === 'canceled'

            if (aIsDone !== bIsDone) {
              return aIsDone ? 1 : -1 // Done以外を上に
            }

            // 2. 同じグループ内では優先度順（1が最高、4が最低、0は未設定）
            const aPriority = a.priority || 999 // 優先度未設定は最下位
            const bPriority = b.priority || 999

            return aPriority - bPriority // 数字が小さい方（高優先度）が上
          })
        })

        // Team情報を取得
        const teamIds = Array.from(teamIssuesMap.keys())

        if (teamIds.length === 0) {
          return { ...user, teams: [], currentTask }
        }

        const { data: teamsData, error: teamsError } = await supabase
          .from('linear_teams')
          .select('id, linear_team_id, name, key, description, color, url')
          .in('linear_team_id', teamIds)

        if (teamsError) {
          console.error('Error fetching teams:', teamsError)
          return { ...user, teams: [], currentTask }
        }

        // Teamsデータを整形
        const teams = (teamsData || []).map((team) => {
          const issues = teamIssuesMap.get(team.linear_team_id) || []
          console.log(`[API] Team ${team.name}: ${issues.length} issues for user ${user.email}`)

          return {
            id: team.id,
            linear_team_id: team.linear_team_id,
            name: team.name,
            key: team.key,
            color: team.color,
            url: team.url,
            description: team.description,
            issues,
          }
        })

        return {
          user_id: user.user_id,
          email: user.email,
          name: user.name,
          role: user.role,
          teams,
          currentTask,
        }
      })
    )

    return NextResponse.json({ users: usersWithTeams })
  } catch (error) {
    console.error('Error in GET /api/admin/users/teams:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
