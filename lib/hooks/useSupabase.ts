"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import type { Task, TimeEntry } from "@/lib/types"
import { useAuth } from "@/lib/contexts/AuthContext"
import { logger } from "@/lib/logger"

export function useSupabase() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [useLocalStorage, setUseLocalStorage] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')

  const { user, isAdmin, loading: authLoading } = useAuth()
  const supabase = createClient()

  // Supabaseが利用可能かチェック
  const isSupabaseConfigured = () => {
    return !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_project_url'
    )
  }

  // タスクを取得
  const fetchTasks = async () => {
    // LocalStorage モード
    if (useLocalStorage) {
      const savedTasks = localStorage.getItem("tasks")
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks))
      }
      setConnectionStatus('disconnected')
      return
    }

    // Supabase モード
    try {
      logger.log('[fetchTasks] Current user ID:', user?.id)
      logger.log('[fetchTasks] Current user email:', user?.email)

      // ユーザーの所属TeamのLinear Team IDを取得（Linear APIを使用）
      let userTeamIds: string[] = []
      try {
        const teamsResponse = await fetch('/api/users/me/teams')
        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json()
          userTeamIds = (teamsData.teams || []).map((t: any) => t.linear_team_id)
          logger.log('[fetchTasks] User team IDs from Linear API:', userTeamIds)
        } else {
          logger.error('Failed to fetch user teams from API:', teamsResponse.status)
        }
      } catch (err) {
        logger.error('Failed to fetch team memberships:', err)
      }

      logger.log('User team IDs for task filtering:', userTeamIds)

      // タスクを取得
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error

      // 管理者: 全タスクを取得（未アサインタスクを表示するため）
      // 一般ユーザー: 自分のemailとassignee_emailが一致するタスク + グローバルタスク + 所属チームのチームタスクのみ表示
      const filteredData = isAdmin
        ? (data || [])
        : (data || []).filter((task) => {
            // 1. グローバルタスク（全員が見える）
            if (task.assignee_email === 'TaskForAll@task.com') {
              logger.log('[useSupabase] ✅ Including global task:', task.name, 'assignee_email:', task.assignee_email)
              return true
            }
            // 2. 自分にアサインされているタスク
            if (task.assignee_email === user?.email) {
              logger.log('[useSupabase] ✅ Including user task:', task.name, 'assignee_email:', task.assignee_email)
              return true
            }
            // 3. チームタスク（assignee_emailがnullで、自分の所属チームに紐づくタスク）
            if (task.assignee_email === null && task.linear_team_id && userTeamIds.includes(task.linear_team_id)) {
              logger.log('[useSupabase] ✅ Including team task:', task.name, 'linear_team_id:', task.linear_team_id)
              return true
            }
            // 4. それ以外（他人のタスク）は非表示
            logger.log('[useSupabase] ❌ Excluding task:', task.name, 'assignee_email:', task.assignee_email, 'user email:', user?.email)
            return false
          })

      logger.log(`[useSupabase] Filtered ${filteredData.length} tasks from ${data?.length || 0} total tasks (user email: ${user?.email}, isAdmin: ${isAdmin})`)
      logger.log('[useSupabase] Filtered task names:', filteredData.map(t => `${t.name} (${t.assignee_email})`).join(', '))

      const mappedTasks: Task[] = filteredData.map((task) => ({
        id: task.id,
        user_id: task.user_id,
        name: task.name,
        color: task.color,
        createdAt: task.created_at,
        linear_issue_id: task.linear_issue_id,
        linear_team_id: task.linear_team_id,
        linear_state_type: task.linear_state_type,
        linear_project_id: task.linear_project_id,
        description: task.description,
        assignee_email: task.assignee_email,
        assignee_name: task.assignee_name,
        linear_identifier: task.linear_identifier,
        linear_url: task.linear_url,
        priority: task.priority,
        linear_updated_at: task.linear_updated_at,
      }))

      setTasks(mappedTasks)
      setConnectionStatus('connected')
    } catch (err) {
      console.warn("Supabase not available, falling back to localStorage")
      setUseLocalStorage(true)
      setConnectionStatus('disconnected')
      const savedTasks = localStorage.getItem("tasks")
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks))
      }
    }
  }

  // 時間エントリを取得
  const fetchTimeEntries = async () => {
    // LocalStorage モード
    if (useLocalStorage) {
      const savedEntries = localStorage.getItem("timeEntries")
      if (savedEntries) {
        setTimeEntries(JSON.parse(savedEntries))
      }
      return
    }

    // Supabase モード
    try {
      // 現在のユーザーのエントリのみ取得
      let query = supabase
        .from("time_entries")
        .select("*")
        .order("start_time", { ascending: false })

      // ユーザーIDでフィルタリング
      if (user?.id) {
        query = query.eq("user_id", user.id)
      }

      const { data, error } = await query

      if (error) throw error

      const mappedEntries: TimeEntry[] = (data || []).map((entry) => ({
        id: entry.id,
        user_id: entry.user_id,
        taskId: entry.task_id,
        startTime: entry.start_time,
        endTime: entry.end_time,
        comment: entry.comment || "",
        date: entry.date,
      }))

      setTimeEntries(mappedEntries)
    } catch (err) {
      console.warn("Supabase not available, falling back to localStorage")
      setUseLocalStorage(true)
      const savedEntries = localStorage.getItem("timeEntries")
      if (savedEntries) {
        setTimeEntries(JSON.parse(savedEntries))
      }
    }
  }

  // 初期データ読み込み
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      // Supabaseが設定されていない場合の警告
      if (!isSupabaseConfigured()) {
        console.warn('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
        setUseLocalStorage(true)
        setConnectionStatus('disconnected')
      }

      // 常にSupabaseを試みる（設定されている場合）
      await Promise.all([fetchTasks(), fetchTimeEntries()])
      setLoading(false)
    }

    // 認証ロード中は何もしない（タブ切り替え時の一時的なnullを無視）
    if (authLoading) return

    // userが存在する場合のみデータを読み込む
    if (user) {
      loadData()
    } else {
      // 本当にログアウトした場合のみクリア
      setTasks([])
      setTimeEntries([])
      setLoading(false)

      // localStorageもクリア（念のため）
      if (typeof window !== 'undefined') {
        localStorage.removeItem("tasks")
        localStorage.removeItem("timeEntries")
        console.log('[useSupabase] Cleared tasks and timeEntries on user logout')
      }
    }
    // user?.idを使うことで、userオブジェクトの参照が変わっても同じユーザーなら再取得しない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, authLoading])

  // LocalStorageに保存
  useEffect(() => {
    if (useLocalStorage && tasks.length > 0) {
      localStorage.setItem("tasks", JSON.stringify(tasks))
    }
  }, [tasks, useLocalStorage])

  useEffect(() => {
    if (useLocalStorage && timeEntries.length > 0) {
      localStorage.setItem("timeEntries", JSON.stringify(timeEntries))
    }
  }, [timeEntries, useLocalStorage])

  // タスクを追加
  const addTask = async (task: Omit<Task, "id">) => {
    // LocalStorage モード
    if (useLocalStorage) {
      const { generateId } = await import("@/lib/utils")
      const newTask: Task = {
        id: generateId(),
        ...task,
      }
      setTasks((prev) => [newTask, ...prev])
      return newTask
    }

    // Supabase モード
    try {
      console.log("Attempting to add task to Supabase:", task)
      console.log("useLocalStorage flag:", useLocalStorage)
      console.log("Current user:", user?.id)

      const insertData: Record<string, unknown> = {
        name: task.name,
        color: task.color,
        created_at: task.createdAt,
      }

      // user_idカラムが存在する場合のみ追加
      if (user?.id) {
        insertData.user_id = user.id
      }

      // Linear Issue情報を追加
      if (task.linear_issue_id) {
        insertData.linear_issue_id = task.linear_issue_id
      }
      if (task.linear_team_id) {
        insertData.linear_team_id = task.linear_team_id
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert([insertData])
        .select()
        .single()

      console.log("Supabase response data:", data)
      console.log("Supabase response error:", error)

      if (error) {
        console.error("Supabase error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })

        // RLSポリシーのエラーの可能性をチェック
        if (error.code === '42501' || error.message?.includes('policy')) {
          console.error("⚠️ Row Level Security (RLS) policy error detected!")
          console.error("Please check your Supabase RLS policies for the 'tasks' table.")
          console.error("You may need to disable RLS or add appropriate policies.")
        }

        throw new Error(error.message || "Supabase insert failed")
      }

      if (!data) {
        console.error("⚠️ No data returned from Supabase, but no error either")
        console.error("This usually means:")
        console.error("1. RLS policies are blocking the insert")
        console.error("2. The table doesn't exist")
        console.error("3. Network/configuration issue")
        throw new Error("No data returned from Supabase insert - possibly RLS policy blocking")
      }

      const newTask: Task = {
        id: data.id,
        name: data.name,
        color: data.color,
        createdAt: data.created_at,
      }

      setTasks((prev) => [newTask, ...prev])
      return newTask
    } catch (err) {
      console.error("Error adding task:", err)
      if (err instanceof Error) {
        console.error("Error message:", err.message)
        console.error("Error stack:", err.stack)
      }
      throw err
    }
  }

  // タスクを更新
  const updateTask = async (id: string, updates: Partial<Task>) => {
    // LocalStorage モード
    if (useLocalStorage) {
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task)))
      return
    }

    // Supabase モード
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          name: updates.name,
          color: updates.color,
        })
        .eq("id", id)

      if (error) throw error

      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task)))
    } catch (err) {
      console.error("Error updating task:", err)
      throw err
    }
  }

  // タスクを削除
  const deleteTask = async (id: string) => {
    // LocalStorage モード
    if (useLocalStorage) {
      setTasks((prev) => prev.filter((task) => task.id !== id))
      return
    }

    // Supabase モード
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id)

      if (error) throw error

      setTasks((prev) => prev.filter((task) => task.id !== id))
    } catch (err) {
      console.error("Error deleting task:", err)
      throw err
    }
  }

  // 時間エントリを追加
  const addTimeEntry = async (entry: Omit<TimeEntry, "id"> | TimeEntry) => {
    // LocalStorage モード
    if (useLocalStorage) {
      const { generateId } = await import("@/lib/utils")
      const newEntry: TimeEntry = {
        id: 'id' in entry ? entry.id : generateId(),
        ...entry,
      }
      setTimeEntries((prev) => [newEntry, ...prev])
      return newEntry
    }

    // Supabase モード
    try {
      // useAuthから既に取得済みのユーザー情報を使用（getUser()の1-2秒APIコールを削減）
      if (!user) {
        logger.error('[addTimeEntry] User not authenticated')
        throw new Error('User must be authenticated to create time entries')
      }

      // 楽観的UI更新: 一時的なIDでUIに即座に反映
      const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const optimisticEntry: TimeEntry = {
        id: optimisticId,
        taskId: entry.taskId,
        startTime: entry.startTime,
        endTime: entry.endTime,
        comment: entry.comment,
        date: entry.date,
      }

      // UIを即座に更新（ユーザーには瞬時に反映される）
      setTimeEntries((prev) => [optimisticEntry, ...prev])
      logger.log('[addTimeEntry] Optimistically added entry to UI:', optimisticId)

      // バックグラウンドでDB保存（awaitで完了を待つ）
      const insertData: Record<string, unknown> = {
        task_id: entry.taskId,
        start_time: entry.startTime,
        end_time: entry.endTime,
        comment: entry.comment,
        date: entry.date,
        user_id: user.id,
      }

      const { data, error } = await supabase
        .from("time_entries")
        .insert([insertData])
        .select()
        .single()

      if (error) {
        // エラー時は楽観的に追加したエントリを削除
        logger.error('[addTimeEntry] Failed to save, rolling back optimistic update')
        setTimeEntries((prev) => prev.filter(e => e.id !== optimisticId))
        throw error
      }

      // 保存成功: 一時IDを実際のIDに置き換え
      setTimeEntries((prev) =>
        prev.map(e => e.id === optimisticId ? {
          ...e,
          id: data.id,
        } : e)
      )

      logger.log('[addTimeEntry] Successfully saved with ID:', data.id)

      return {
        id: data.id,
        taskId: data.task_id,
        startTime: data.start_time,
        endTime: data.end_time,
        comment: data.comment || "",
        date: data.date,
      }
    } catch (err) {
      logger.error("Error adding time entry:", err)
      throw err
    }
  }

  // 時間エントリを更新
  const updateTimeEntry = async (id: string, updates: Partial<TimeEntry>) => {
    console.log('[updateTimeEntry] Called with id:', id, 'updates:', updates)
    console.log('[updateTimeEntry] useLocalStorage:', useLocalStorage)
    console.log('[updateTimeEntry] Current user:', user?.id)

    // LocalStorage モード
    if (useLocalStorage) {
      console.log('[updateTimeEntry] Using localStorage mode')
      setTimeEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)))
      return
    }

    // Supabase モード
    // 元のエントリを保持（ロールバック用）
    const originalEntry = timeEntries.find(e => e.id === id)
    if (!originalEntry) {
      console.error('[updateTimeEntry] Entry not found:', id)
      throw new Error('Entry not found')
    }

    // 楽観的UI更新: まずローカル状態を即座に更新
    setTimeEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)))
    console.log('[updateTimeEntry] Optimistically updated local state')

    // 更新するフィールドのみを含むオブジェクトを作成
    const updateData: Record<string, unknown> = {}
    if (updates.taskId !== undefined) updateData.task_id = updates.taskId
    if (updates.startTime !== undefined) updateData.start_time = updates.startTime
    if (updates.endTime !== undefined) updateData.end_time = updates.endTime
    if (updates.comment !== undefined) updateData.comment = updates.comment
    if (updates.date !== undefined) updateData.date = updates.date

    // DB更新（バックグラウンドで実行、エラー時のみロールバック）
    supabase
      .from("time_entries")
      .update(updateData)
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          // エラー時はロールバック（元のエントリを復元）
          console.error('[updateTimeEntry] DB update failed, rolling back:', error)
          setTimeEntries((prev) => prev.map((entry) =>
            entry.id === id ? originalEntry : entry
          ))
        } else {
          console.log('[updateTimeEntry] DB update successful')

          // スプレッドシート同期もバックグラウンドで実行
          const timezone = typeof window !== 'undefined'
            ? localStorage.getItem('taskTimerTimezone') || 'Asia/Tokyo'
            : 'Asia/Tokyo'

          fetch('/api/spreadsheet/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeEntryId: id, timezone }),
            keepalive: true,
          }).then(async (res) => {
            if (res.ok) {
              const result = await res.json()
              console.log('[updateTimeEntry] Spreadsheet sync success:', result)
            } else {
              const errorText = await res.text()
              console.error('[updateTimeEntry] Spreadsheet sync failed:', res.status, errorText)
            }
          }).catch(err => {
            console.error('[updateTimeEntry] Spreadsheet sync error:', err)
          })
        }
      })
  }

  // 時間エントリを削除
  const deleteTimeEntry = async (id: string) => {
    // LocalStorage モード
    if (useLocalStorage) {
      setTimeEntries((prev) => prev.filter((entry) => entry.id !== id))
      return
    }

    // Supabase モード
    try {
      // ローカルstateから開始時刻を取得（DBクエリ不要）
      const entryToDelete = timeEntries.find(e => e.id === id)
      const startTime = entryToDelete?.startTime

      console.log('[deleteTimeEntry] Entry to delete:', id, 'startTime:', startTime)

      // 楽観的UI更新: まずローカル状態から削除
      setTimeEntries((prev) => prev.filter((entry) => entry.id !== id))

      // DB削除（バックグラウンドで実行）
      supabase.from("time_entries").delete().eq("id", id)
        .then(({ error }) => {
          if (error) {
            console.error('[deleteTimeEntry] DB delete failed:', error)
            // エラー時はエントリを復元
            if (entryToDelete) {
              setTimeEntries((prev) => [...prev, entryToDelete])
            }
          } else {
            console.log('[deleteTimeEntry] DB deleted successfully')
          }
        })

      // スプレッドシートからも削除（バックグラウンドで実行、awaitしない）
      if (startTime) {
        fetch('/api/spreadsheet/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeEntryId: id,
            startTime: startTime,
          }),
          keepalive: true,
        }).then(response => {
          if (!response.ok) {
            console.error('[deleteTimeEntry] Spreadsheet delete failed:', response.status)
          } else {
            console.log('[deleteTimeEntry] Spreadsheet deleted successfully')
          }
        }).catch(err => {
          console.error('[deleteTimeEntry] Spreadsheet delete error:', err)
        })
      }
    } catch (err) {
      console.error("Error deleting time entry:", err)
      throw err
    }
  }

  return {
    tasks,
    timeEntries,
    loading,
    error,
    connectionStatus,
    isLocalStorageMode: useLocalStorage,
    addTask,
    updateTask,
    deleteTask,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    setTasks,
    setTimeEntries,
  }
}
