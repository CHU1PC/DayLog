import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { updateTimeEntryInSheet, writeTimeEntryToSheet, TimeEntryData } from '@/lib/google-sheets'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // ユーザー認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // リクエストボディから時間エントリーIDとタイムゾーンを取得
    const { timeEntryId, timezone = 'Asia/Tokyo' } = await request.json()

    if (!timeEntryId) {
      return NextResponse.json(
        { error: 'timeEntryId is required' },
        { status: 400 }
      )
    }

    // 時間エントリーとタスク情報を取得
    console.log('[Spreadsheet Update API] Fetching time entry with relations:', timeEntryId)
    console.log('[Spreadsheet Update API] Current user:', user.id)

    // time_entryとtaskを取得（linear_team_idはFKではないので別クエリで取得）
    const [timeEntryResult, userApprovalResult] = await Promise.all([
      supabase
        .from('time_entries')
        .select(`
          *,
          tasks:task_id (*)
        `)
        .eq('id', timeEntryId)
        .single(),
      supabase
        .from('user_approvals')
        .select('name')
        .eq('user_id', user.id)
        .single()
    ])

    const { data: timeEntry, error: timeEntryError } = timeEntryResult

    console.log('[Spreadsheet Update API] Time entry result:', timeEntry)
    console.log('[Spreadsheet Update API] Error:', timeEntryError)

    if (timeEntryError || !timeEntry) {
      console.error('Error fetching time entry:', timeEntryError)
      return NextResponse.json(
        { error: 'Time entry not found', details: timeEntryError },
        { status: 404 }
      )
    }

    // タスクデータを取得
    const task = timeEntry.tasks

    // linear_team_idとlinear_project_idがある場合は別途取得
    let teamName: string | null = null
    let projectName: string | null = null

    if (task?.linear_team_id || task?.linear_project_id) {
      const [teamResult, projectResult] = await Promise.all([
        task?.linear_team_id
          ? supabase.from('linear_teams').select('name').eq('id', task.linear_team_id).single()
          : Promise.resolve({ data: null }),
        task?.linear_project_id
          ? supabase.from('linear_projects').select('name').eq('id', task.linear_project_id).single()
          : Promise.resolve({ data: null })
      ])
      teamName = teamResult.data?.name || null
      projectName = projectResult.data?.name || null
    }

    console.log('[Spreadsheet Update API] Task data:', task)
    console.log('[Spreadsheet Update API] Team name:', teamName)
    console.log('[Spreadsheet Update API] Project name:', projectName)

    // グローバルタスク（管理者作成のその他タスク）の場合、Team名とProject名にタスク名を使用
    const isGlobalTask = task?.assignee_email === 'TaskForAll@task.com'
    if (isGlobalTask && task?.name) {
      teamName = task.name
      projectName = task.name
    }

    // ユーザー名を取得（並列クエリで既に取得済み）
    const assigneeName = userApprovalResult.data?.name || null

    // 時間エントリーがログインユーザーのものか確認
    if (timeEntry.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: This time entry does not belong to you' },
        { status: 403 }
      )
    }

    // 開始時刻と終了時刻が両方存在するか確認
    if (!timeEntry.start_time || !timeEntry.end_time) {
      return NextResponse.json(
        { error: 'Time entry is incomplete' },
        { status: 400 }
      )
    }

    // 稼働時間を計算（時間単位）
    const startTime = new Date(timeEntry.start_time)
    const endTime = new Date(timeEntry.end_time)
    const workingHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

    // タイムゾーンに基づいて日時をフォーマット
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
    const formatOptionsWithTime: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }

    // スプレッドシートに書き込むデータを準備
    const sheetData: TimeEntryData = {
      timeEntryId: timeEntryId,
      date: startTime.toLocaleDateString('ja-JP', formatOptions),
      teamName: teamName,
      projectName: projectName,
      issueName: task?.linear_identifier || task?.name || null,
      comment: timeEntry.comment || '',
      workingHours,
      assigneeName: assigneeName,
      startTime: startTime.toLocaleString('ja-JP', formatOptionsWithTime),
      endTime: endTime.toLocaleString('ja-JP', formatOptionsWithTime),
    }

    console.log('[Spreadsheet Update API] Sheet data to update:', sheetData)

    // Google Sheetsで更新を試行
    const updateResult = await updateTimeEntryInSheet(sheetData)

    let action: string
    if (updateResult.action === 'not_found') {
      // 見つからない場合は新規作成を試行（重複チェック付き）
      console.log('[Spreadsheet Update API] Entry not found, attempting to write:', timeEntryId)
      const writeResult = await writeTimeEntryToSheet(sheetData)
      action = writeResult.action === 'created' ? 'created' : 'already_exists'
    } else {
      action = 'updated'
    }

    console.log('[Spreadsheet Update API] Successfully processed time entry:', {
      timeEntryId,
      date: sheetData.date,
      action,
    })

    return NextResponse.json({
      message: 'Time entry processed in spreadsheet successfully',
      timeEntryId,
      action,
    }, { status: 200 })

  } catch (error) {
    console.error('Error updating time entry in spreadsheet:', error)
    return NextResponse.json(
      {
        error: 'Failed to update time entry in spreadsheet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
