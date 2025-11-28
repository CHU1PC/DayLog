"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type { Task, TimeEntry } from "@/lib/types"
import { Play, Square, Clock } from "lucide-react"
import { generateId } from "@/lib/utils"
import { useAuth } from "@/lib/contexts/AuthContext"
import { logger } from "@/lib/logger"
import {
  isNotificationSupported,
  requestNotificationPermission,
  showTimerStartNotification,
  showTimerStopNotification,
  showTimerProgressNotification,
  closeNotification,
} from "@/lib/notifications"
import { useLanguage } from "@/lib/contexts/LanguageContext"

// タイムゾーン定義
const TIMEZONES = {
  'Asia/Tokyo': { offset: 9 },
  'America/New_York': { offset: -5 }, // 冬時間、夏時間は-4
  'America/Los_Angeles': { offset: -8 }, // 冬時間、夏時間は-7
  'Europe/London': { offset: 0 }, // 冬時間、夏時間は+1
  'Asia/Shanghai': { offset: 8 },
  'Asia/Kolkata': { offset: 5.5 },
  'Europe/Paris': { offset: 1 }, // 冬時間、夏時間は+2
  'Australia/Sydney': { offset: 10 }, // 冬時間、夏時間は+11
  'Pacific/Auckland': { offset: 12 }, // 冬時間、夏時間は+13
} as const

type TimezoneKey = keyof typeof TIMEZONES

// 指定したタイムゾーンで日付を取得するヘルパー関数
const getDateInTimezone = (date: Date, timezone: TimezoneKey): string => {
  const offset = TIMEZONES[timezone].offset
  // UTCタイムスタンプにオフセット時間を追加
  const tzDate = new Date(date.getTime() + (offset * 60 * 60 * 1000))
  const year = tzDate.getUTCFullYear()
  const month = String(tzDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(tzDate.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface TaskTimerProps {
  tasks: Task[]
  onAddEntry: (entry: TimeEntry) => Promise<TimeEntry | undefined>
  onUpdateEntry: (id: string, updates: Partial<TimeEntry>) => void
  timeEntries: TimeEntry[]
  isHeaderMode?: boolean
}

export function TaskTimer({ tasks, onAddEntry, onUpdateEntry, timeEntries, isHeaderMode = false }: TaskTimerProps) {
  const { user, userName } = useAuth()
  const { t } = useLanguage()
  const [selectedTaskId, setSelectedTaskId] = useState<string>("")
  const [isRunning, setIsRunning] = useState(false)
  const [startTime, setStartTime] = useState<string>("")
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [comment, setComment] = useState("")
  const [showCommentDialog, setShowCommentDialog] = useState(false)
  const [pendingComment, setPendingComment] = useState("")
  const [currentEntryId, setCurrentEntryId] = useState<string>("")
  const [timezone, setTimezone] = useState<TimezoneKey>('Asia/Tokyo')
  const [isSaving, setIsSaving] = useState(false)
  const [notificationInterval, setNotificationInterval] = useState<number>(3600000) // デフォルト: 1時間
  const [showNameRequiredDialog, setShowNameRequiredDialog] = useState(false)

  // スプレッドシートを同期する共通ヘルパー
  // update APIが内部でnot_foundの場合はwriteを呼び出すため、フロントエンドでのフォールバックは不要
  const syncSpreadsheetEntry = async (entryId: string, context: string) => {
    console.log(`[syncSpreadsheetEntry] start (${context})`, entryId)
    try {
      const updateRes = await fetch('/api/spreadsheet/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeEntryId: entryId }),
        keepalive: true,
      })

      if (updateRes.ok) {
        const result = await updateRes.json()
        console.log(`[syncSpreadsheetEntry] Spreadsheet synced (${context}) action=${result.action}`)
        return
      }

      // エラーの場合のみログを出力
      let updateError: unknown = null
      try {
        updateError = await updateRes.json()
      } catch (e) {
        updateError = 'Failed to parse update error response'
      }
      console.error(`[syncSpreadsheetEntry] Sync failed (${context}):`, updateRes.status, updateError)
    } catch (spreadsheetError) {
      console.error(`[syncSpreadsheetEntry] Error (${context}):`, spreadsheetError)
    }
  }

  // 通知権限をリクエスト & 通知間隔を読み込み
  useEffect(() => {
    if (isNotificationSupported()) {
      requestNotificationPermission()
    }

    // localStorageから通知間隔を読み込み
    const savedInterval = localStorage.getItem('timerNotificationInterval')
    if (savedInterval) {
      setNotificationInterval(Number(savedInterval))
    }
  }, [])

  // localStorageの変更を監視して通知間隔を更新
  useEffect(() => {
    const handleStorageChange = () => {
      const savedInterval = localStorage.getItem('timerNotificationInterval')
      if (savedInterval) {
        setNotificationInterval(Number(savedInterval))
      }
    }

    // storageイベントは他のタブからの変更を検知するため、
    // 同じタブ内での変更も検知できるようにカスタムイベントを使用
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('notificationIntervalChanged', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('notificationIntervalChanged', handleStorageChange)
    }
  }, [])

  // タイムゾーンをlocalStorageから読み込み
  useEffect(() => {
    const saved = localStorage.getItem('taskTimerTimezone')
    if (saved && saved in TIMEZONES) {
      setTimezone(saved as TimezoneKey)
    }
  }, [])

  // タイムゾーン変更時にlocalStorageに保存
  const handleTimezoneChange = (newTimezone: TimezoneKey) => {
    setTimezone(newTimezone)
    localStorage.setItem('taskTimerTimezone', newTimezone)
  }

  // タスクをフィルタリング: completed/canceledを除外し、assignee_emailが一致するもの + グローバルタスクのみ表示
  const availableTasks = tasks.filter((task) => {
    // linear_state_typeがcompleted, canceledの場合は除外
    if (task.linear_state_type === 'completed' || task.linear_state_type === 'canceled') {
      logger.log('[TaskTimer] Excluding completed/canceled task:', task.name)
      return false
    }

    // 1. グローバルタスク（全員が見える）
    if (task.assignee_email === 'TaskForAll@task.com') {
      logger.log('[TaskTimer] ✅ Including global task:', task.name)
      return true
    }

    // 2. 自分にアサインされているタスク
    if (task.assignee_email === user?.email) {
      logger.log('[TaskTimer] ✅ Including user task:', task.name)
      return true
    }

    // 3. それ以外は非表示
    logger.log('[TaskTimer] ❌ Filtering out task:', {
      taskName: task.name,
      taskAssigneeEmail: task.assignee_email,
      currentUserEmail: user?.email,
    })
    return false
  })

  logger.log('[TaskTimer] Total available tasks:', availableTasks.length, availableTasks.map(t => t.name))

  // タスクをTeamごとにグループ化してソート
  const groupedAvailableTasks = availableTasks.reduce((groups, task) => {
    // グローバルタスク（linear_team_idがnull）の場合は、linear_identifierをラベルとして使用
    // それ以外はTeam名を使用
    let teamName: string
    if (!task.linear_team_id && task.assignee_email === 'TaskForAll@task.com') {
      // グローバルタスク: linear_identifierをラベルとして使用（なければ「その他」）
      teamName = task.linear_identifier || 'その他'
    } else if (task.linear_team_id) {
      // 通常のLinearタスク: Team名を使用
      teamName = `Team: ${task.linear_identifier?.split('-')[0] || 'Unknown'}`
    } else {
      // その他
      teamName = t("taskMgmt.other")
    }

    if (!groups[teamName]) {
      groups[teamName] = []
    }
    groups[teamName].push(task)
    return groups
  }, {} as Record<string, typeof availableTasks>)

  // グループをソート: Teamグループを上に、グローバルタスクグループ（Team:で始まらない）を下に配置
  const sortedGroupedTasks = Object.entries(groupedAvailableTasks).sort(([teamA], [teamB]) => {
    const isTeamA = teamA.startsWith('Team:')
    const isTeamB = teamB.startsWith('Team:')

    // 両方ともTeamグループの場合、アルファベット順
    if (isTeamA && isTeamB) {
      return teamA.localeCompare(teamB)
    }

    // 片方だけTeamグループの場合、Teamグループを上に
    if (isTeamA) return -1
    if (isTeamB) return 1

    // 両方ともグローバルタスクグループの場合、アルファベット順
    return teamA.localeCompare(teamB)
  })

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isRunning && startTime) {
      interval = setInterval(() => {
        const now = new Date()
        const start = new Date(startTime)

        // 日付が変わったかチェック（選択されたタイムゾーン基準）
        const startDate = getDateInTimezone(start, timezone)
        const nowDate = getDateInTimezone(now, timezone)

        if (startDate !== nowDate) {
          // 24時を跨いだ場合、自動的に停止して再開
          console.log(`[TaskTimer] Midnight crossover detected (${TIMEZONES[timezone].name})`)
          console.log(`[TaskTimer] Start date: ${startDate}, Now date: ${nowDate}`)
          handleMidnightCrossover()
        } else {
          const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000)
          // 負の値を防ぐ
          setElapsedSeconds(Math.max(0, elapsed))
        }
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, startTime, selectedTaskId, currentEntryId, comment, pendingComment])

  // タイマー実行中の継続通知（ユーザー設定の間隔で更新）
  useEffect(() => {
    let notificationTimer: NodeJS.Timeout
    let initialTimer: NodeJS.Timeout

    if (isRunning && selectedTaskId && startTime) {
      // ユーザー設定の通知間隔を使用
      const notificationIntervalMs = notificationInterval

      // 通知が無効（0）の場合は何もしない
      if (notificationIntervalMs === 0) {
        return
      }

      const taskName = tasks.find(t => t.id === selectedTaskId)?.name || 'タスク'
      const start = new Date(startTime).getTime()
      const now = Date.now()
      const elapsedMs = now - start

      // 次の通知までの残り時間を計算（startTimeを基準）
      // 例: 間隔が5分(300000ms)で、経過時間が1分3秒(63000ms)の場合
      // 次の通知は 300000 - (63000 % 300000) = 300000 - 63000 = 237000ms後（約3分57秒後）
      const timeUntilNextNotification = notificationIntervalMs - (elapsedMs % notificationIntervalMs)

      // 最初の通知を正確なタイミングで設定
      initialTimer = setTimeout(() => {
        const currentElapsed = Math.floor((Date.now() - start) / 1000)
        showTimerProgressNotification(taskName, formatTime(Math.max(0, currentElapsed)))

        // その後は設定された間隔で通知を更新
        notificationTimer = setInterval(() => {
          const currentElapsed = Math.floor((Date.now() - start) / 1000)
          showTimerProgressNotification(taskName, formatTime(Math.max(0, currentElapsed)))
        }, notificationIntervalMs)
      }, timeUntilNextNotification)
    } else {
      // タイマー停止時は通知をクリア
      closeNotification('timer-progress')
    }

    return () => {
      if (initialTimer) clearTimeout(initialTimer)
      if (notificationTimer) clearInterval(notificationTimer)
    }
  }, [isRunning, selectedTaskId, tasks, startTime, notificationInterval])

  useEffect(() => {
    if (selectedTaskId && !comment) {
      const today = new Date().toISOString().split("T")[0]
      const todayEntries = timeEntries.filter(
        (entry) => entry.taskId === selectedTaskId && entry.date === today && entry.comment,
      )
      if (todayEntries.length > 0) {
        setComment(todayEntries[todayEntries.length - 1].comment)
        setPendingComment(todayEntries[todayEntries.length - 1].comment)
      }
    }
  }, [selectedTaskId, timeEntries, comment])

  // ページロード時に進行中のエントリを復元
  useEffect(() => {
    const activeEntry = timeEntries.find((entry) => !entry.endTime)
    if (activeEntry) {
      const now = new Date()
      const start = new Date(activeEntry.startTime)

      // 日付が変わっているかチェック（選択されたタイムゾーン基準）
      const startDate = getDateInTimezone(start, timezone)
      const nowDate = getDateInTimezone(now, timezone)

      if (startDate !== nowDate) {
        // 24時を跨いでいる場合は、前日分を自動で終了させる
        console.log(`[TaskTimer] Active entry from previous day detected (${TIMEZONES[timezone].name}), will handle midnight crossover`)
        console.log(`[TaskTimer] Start date: ${startDate}, Now date: ${nowDate}`)
        setCurrentEntryId(activeEntry.id)
        setSelectedTaskId(activeEntry.taskId)
        setStartTime(activeEntry.startTime)
        setIsRunning(true)
        setComment(activeEntry.comment)
        setPendingComment(activeEntry.comment)
        setElapsedSeconds(0)

        // handleMidnightCrossoverが次のuseEffectで呼ばれる
      } else {
        // 同じ日の場合は通常通り復元
        setCurrentEntryId(activeEntry.id)
        setSelectedTaskId(activeEntry.taskId)
        setStartTime(activeEntry.startTime)
        setIsRunning(true)
        setComment(activeEntry.comment)
        setPendingComment(activeEntry.comment)

        // 経過時間を計算（負の値を防ぐ）
        const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000)
        setElapsedSeconds(Math.max(0, elapsed))
      }
    }
  }, [])

  const handleMidnightCrossover = async () => {
    if (!isRunning || !selectedTaskId || !startTime || !currentEntryId) return

    // 前日の23:59:59を計算
    const previousDayEnd = new Date(startTime)
    previousDayEnd.setHours(23, 59, 59, 999)

    // 現在進行中のエントリを前日の23:59:59で終了
    await onUpdateEntry(currentEntryId, {
      endTime: previousDayEnd.toISOString(),
      comment: comment || pendingComment,
    })
    // DB更新が成功した場合にスプレッドシートも確実に同期（updateが見つからなければwriteを試行）
    await syncSpreadsheetEntry(currentEntryId, 'midnight crossover')

    // 新しい日の00:00:00で新しいタスクを開始
    const newDayStart = new Date(previousDayEnd)
    newDayStart.setHours(0, 0, 0, 0)
    newDayStart.setDate(newDayStart.getDate() + 1)

    const newEntry: TimeEntry = {
      id: generateId(),
      taskId: selectedTaskId,
      startTime: newDayStart.toISOString(),
      endTime: undefined,
      comment: comment || pendingComment || "",
      date: getDateInTimezone(newDayStart, timezone),
    }

    // 新しいエントリを追加して、実際のIDを取得
    try {
      const savedEntry = await onAddEntry(newEntry)
      const actualEntryId = savedEntry?.id || newEntry.id
      console.log(`[handleMidnightCrossover] New entry created with ID: ${actualEntryId}`)

      setCurrentEntryId(actualEntryId)
      setStartTime(newDayStart.toISOString())
      setElapsedSeconds(0)

      console.log(`Midnight crossover: Split task at ${previousDayEnd.toISOString()} and restarted at ${newDayStart.toISOString()}`)
    } catch (error) {
      console.error('[handleMidnightCrossover] Failed to create new entry:', error)
    }
  }

  const handleStart = async () => {
    if (!selectedTaskId) return

    // 名前が設定されていない場合はダイアログを表示
    if (!userName || !userName.trim()) {
      setShowNameRequiredDialog(true)
      return
    }

    const nowDate = new Date()
    const now = nowDate.toISOString()
    const newEntry: TimeEntry = {
      id: generateId(),
      taskId: selectedTaskId,
      startTime: now,
      endTime: undefined, // 進行中
      comment: comment || pendingComment || "",
      date: getDateInTimezone(nowDate, timezone),
    }

    console.log('[TaskTimer] Starting timer with entry:', newEntry)

    // すぐにサーバーに保存して、実際に保存されたIDを取得
    try {
      const savedEntry = await onAddEntry(newEntry)
      const actualEntryId = savedEntry?.id || newEntry.id
      console.log('[TaskTimer] Entry saved with actual ID:', actualEntryId)

      setCurrentEntryId(actualEntryId)
      setStartTime(now)
      setIsRunning(true)
      setElapsedSeconds(0)

      // タイマー開始通知を表示
      const taskName = tasks.find(t => t.id === selectedTaskId)?.name || 'タスク'
      showTimerStartNotification(taskName)
    } catch (error) {
      console.error('[TaskTimer] Failed to start timer:', error)
    }
  }

  const handleStop = () => {
    if (!isRunning || !selectedTaskId) return
    setShowCommentDialog(true)
  }

  const handleSaveEntry = async () => {
    // 既に保存処理中の場合は何もしない
    if (isSaving) {
      console.log('[handleSaveEntry] Already saving, ignoring duplicate click')
      return
    }

    setIsSaving(true)
    const now = new Date().toISOString()

    console.log('[handleSaveEntry] Stopping timer')
    console.log('[handleSaveEntry] Current entry ID:', currentEntryId)
    console.log('[handleSaveEntry] End time:', now)
    console.log('[handleSaveEntry] Comment:', pendingComment)

    // 現在進行中のエントリを更新
    if (currentEntryId) {
      try {
        // 1. 現在のエントリを更新
        await onUpdateEntry(currentEntryId, {
          endTime: now,
          comment: pendingComment,
        })
        console.log('[handleSaveEntry] Entry updated successfully')

        // スプレッドシート同期リスト（後で並列実行）
        const syncPromises: Promise<void>[] = []
        syncPromises.push(syncSpreadsheetEntry(currentEntryId, 'handleSaveEntry current'))

        // 2. 過去の連続したエントリを遡って更新
        // 現在のエントリ情報を取得（開始時刻を知るため）
        const currentEntry = timeEntries.find(e => e.id === currentEntryId)
        if (currentEntry) {
          let checkStartTime = new Date(currentEntry.startTime).getTime()

          // 過去のエントリを探索
          // 時間順にソート（新しい順）
          const sortedEntries = [...timeEntries]
            .filter(e => e.id !== currentEntryId && e.taskId === selectedTaskId && e.endTime)
            .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())

          // 連続エントリのDB更新を収集
          const contiguousUpdates: { id: string; startTime: number }[] = []

          for (const entry of sortedEntries) {
            const entryEndTime = new Date(entry.endTime!).getTime()

            // 終了時刻と開始時刻の差が1秒以内なら連続とみなす
            if (Math.abs(checkStartTime - entryEndTime) <= 1000) {
              console.log('[handleSaveEntry] Found previous contiguous entry:', entry.id)
              contiguousUpdates.push({ id: entry.id, startTime: new Date(entry.startTime).getTime() })
              // 次の探索のために基準時間を更新
              checkStartTime = new Date(entry.startTime).getTime()
            } else {
              // 連続していない場合は探索終了（ソートされているため）
              if (checkStartTime < entryEndTime) {
                // まだ新しいエントリを見ている場合はスキップ
                continue
              }
              break
            }
          }

          // 連続エントリのDB更新を並列実行
          await Promise.all(
            contiguousUpdates.map(({ id }) =>
              onUpdateEntry(id, { comment: pendingComment })
            )
          )

          // スプレッドシート同期を並列リストに追加
          contiguousUpdates.forEach(({ id }) => {
            syncPromises.push(syncSpreadsheetEntry(id, 'handleSaveEntry contiguous'))
          })
        }

        // 全スプレッドシート同期を並列実行（バックグラウンド、awaitしない）
        Promise.all(syncPromises).catch(err => {
          console.error('[handleSaveEntry] Spreadsheet sync error:', err)
        })

      } catch (error) {
        console.error('[handleSaveEntry] Failed to update entry:', error)
        setIsSaving(false) // エラー時はローディング状態を解除
        return // エラーが発生した場合は処理を中断
      }
    } else {
      console.error('[handleSaveEntry] No current entry ID found!')
      setIsSaving(false)
      return
    }

    // タイマー停止通知を表示
    const taskName = tasks.find(t => t.id === selectedTaskId)?.name || 'タスク'
    const duration = formatTime(elapsedSeconds)
    showTimerStopNotification(taskName, duration)

    setIsRunning(false)
    setStartTime("")
    setElapsedSeconds(0)
    setComment(pendingComment)
    setCurrentEntryId("")
    setShowCommentDialog(false)
    setIsSaving(false)
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId)

  if (isHeaderMode) {
    return (
      <>
        <div className="bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4">
                <h1 className="text-base sm:text-xl font-bold text-foreground">DayLog</h1>
                <Select value={timezone} onValueChange={(value) => handleTimezoneChange(value as TimezoneKey)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIMEZONES) as TimezoneKey[]).map((tz) => (
                      <SelectItem key={tz} value={tz} className="text-xs">
                        {t(`timezone.${tz}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:flex-1 sm:max-w-3xl">
                <Select value={selectedTaskId} onValueChange={setSelectedTaskId} disabled={isRunning}>
                  <SelectTrigger className="w-full sm:w-[240px]">
                    <SelectValue placeholder={t("timer.selectTask")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]" position="popper" sideOffset={4}>
                    {sortedGroupedTasks.map(([teamName, teamTasks]) => (
                      <div key={teamName}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                          {teamName} ({teamTasks.length})
                        </div>
                        {teamTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: task.color }} />
                              <span className="truncate">{task.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 sm:gap-3 bg-primary/10 px-3 sm:px-4 py-2 rounded-lg w-full sm:w-auto">
                  <Clock className={`w-3 h-3 sm:w-4 sm:h-4 ${isRunning ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                  <div className="text-base sm:text-lg font-mono font-bold text-foreground">{formatTime(elapsedSeconds)}</div>
                  {isRunning && selectedTask && (
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTask.color }} />
                      <span className="text-sm text-muted-foreground truncate max-w-[100px]">{selectedTask.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                  <Button onClick={handleStart} disabled={!selectedTaskId || isRunning} size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm">
                    <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    {t("timer.start")}
                  </Button>
                  <Button onClick={handleStop} disabled={!isRunning} variant="destructive" size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm">
                    <Square className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    {t("timer.stop")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("timer.commentTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t("timeEntry.comment")}</label>
                <Textarea
                  value={pendingComment}
                  onChange={(e) => setPendingComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSaving) {
                      handleSaveEntry()
                    }
                  }}
                  placeholder={t("timeEntry.commentPlaceholder")}
                  rows={4}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">{t("timeEntry.saveShortcut")}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCommentDialog(false)} disabled={isSaving}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSaveEntry} disabled={isSaving}>
                {isSaving ? t("settings.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showNameRequiredDialog} onOpenChange={setShowNameRequiredDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("timer.nameRequired")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("timer.nameRequiredDesc")}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowNameRequiredDialog(false)}>
                {t("timer.close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-bold text-foreground">DayLog</h1>

            <div className="flex items-center gap-4 flex-1 max-w-3xl">
              <Select value={selectedTaskId} onValueChange={setSelectedTaskId} disabled={isRunning}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder={t("timer.selectTask")} />
                </SelectTrigger>
                <SelectContent>
                  {availableTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: task.color }} />
                        {task.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-3 bg-primary/10 px-4 py-2 rounded-lg">
                <Clock className={`w-4 h-4 ${isRunning ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                <div className="text-lg font-mono font-bold text-foreground">{formatTime(elapsedSeconds)}</div>
                {isRunning && selectedTask && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTask.color }} />
                    <span className="text-sm text-muted-foreground">{selectedTask.name}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 ml-auto">
                <Button onClick={handleStart} disabled={!selectedTaskId || isRunning} size="sm">
                  <Play className="w-4 h-4 mr-1" />
                  {t("timer.start")}
                </Button>
                <Button onClick={handleStop} disabled={!isRunning} variant="destructive" size="sm">
                  <Square className="w-4 h-4 mr-1" />
                  {t("timer.stop")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("timer.commentTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t("timeEntry.comment")}</label>
              <Textarea
                value={pendingComment}
                onChange={(e) => setPendingComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSaving) {
                    handleSaveEntry()
                  }
                }}
                placeholder={t("timeEntry.commentPlaceholder")}
                rows={4}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">{t("timeEntry.saveShortcut")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommentDialog(false)} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveEntry} disabled={isSaving}>
              {isSaving ? t("settings.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNameRequiredDialog} onOpenChange={setShowNameRequiredDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("timer.nameRequired")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("timer.nameRequiredDesc")}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowNameRequiredDialog(false)}>
              {t("timer.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
