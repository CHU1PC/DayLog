"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Task, TimeEntry } from "@/lib/types"
import {
  Pencil, Trash2, RefreshCw, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Users
} from "lucide-react"
import { useAuth } from "@/lib/contexts/AuthContext"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useLanguage } from "@/lib/contexts/LanguageContext"
import { TaskTimeChart } from "@/components/task-time-chart"

interface TaskManagementProps {
  tasks: Task[]
  timeEntries: TimeEntry[]
  onTasksChange: (tasks: Task[]) => void
  onUpdateTask?: (id: string, updates: Partial<Task>) => Promise<void>
  onDeleteTask?: (id: string) => Promise<void>
}

const PRESET_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"]

interface TeamInfo {
  id: string
  linear_team_id: string
  name: string
  key: string
}

export function TaskManagement({ tasks, timeEntries, onTasksChange, onUpdateTask, onDeleteTask }: TaskManagementProps) {
  const { isAdmin } = useAuth()
  const { t } = useLanguage()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [creatingGlobalTask, setCreatingGlobalTask] = useState(false)
  const [showGlobalTaskDialog, setShowGlobalTaskDialog] = useState(false)
  const [newGlobalTaskName, setNewGlobalTaskName] = useState('')
  const [newGlobalTaskLabel, setNewGlobalTaskLabel] = useState('')
  // チームタスク作成用の状態
  const [showTeamTaskDialog, setShowTeamTaskDialog] = useState(false)
  const [newTeamTaskName, setNewTeamTaskName] = useState('')
  const [newTeamTaskLabel, setNewTeamTaskLabel] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [creatingTeamTask, setCreatingTeamTask] = useState(false)
  const [userTeams, setUserTeams] = useState<TeamInfo[]>([])

  // Team情報を取得（管理者用の全チーム）
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch('/api/admin/linear-teams')
        if (res.ok) {
          const data = await res.json()
          setTeams(data.teams || [])
        }
      } catch (err) {
        console.error('Failed to fetch teams:', err)
      }
    }
    fetchTeams()
  }, [])

  // ユーザーの所属チームを取得（チームタスク作成用）
  useEffect(() => {
    const fetchUserTeams = async () => {
      try {
        const res = await fetch('/api/users/me/teams')
        if (res.ok) {
          const data = await res.json()
          setUserTeams(data.teams || [])
        }
      } catch (err) {
        console.error('Failed to fetch user teams:', err)
      }
    }
    fetchUserTeams()
  }, [])

  // タスクをTeamごとにグループ化し、優先度とステータスでソート
  const groupedTasks = useMemo(() => {
    const grouped = new Map<string, { team: TeamInfo | null, tasks: Task[] }>()

    // Teamごとにタスクを分類
    tasks.forEach(task => {
      const teamId = task.linear_team_id || 'no-team'
      if (!grouped.has(teamId)) {
        const team = teams.find(t => t.linear_team_id === teamId) || null
        grouped.set(teamId, { team, tasks: [] })
      }
      grouped.get(teamId)!.tasks.push(task)
    })

    // 各チームのタスクをソート
    return Array.from(grouped.entries()).map(([teamId, data]) => {
      // タスクをソート: Done以外を上に、その上で優先度順（高い方が上）
      const sortedTasks = [...data.tasks].sort((a, b) => {
        // 1. まずDone（completed/canceled）かどうかで分ける
        const aIsDone = a.linear_state_type === 'completed' || a.linear_state_type === 'canceled'
        const bIsDone = b.linear_state_type === 'completed' || b.linear_state_type === 'canceled'

        if (aIsDone !== bIsDone) {
          return aIsDone ? 1 : -1 // Done以外を上に
        }

        // 2. 同じグループ内では優先度順（1が最高、4が最低、0は未設定）
        // Linearの優先度: 0=なし, 1=緊急, 2=高, 3=中, 4=低
        const priorityA = a.priority ?? 999 // 優先度未設定は最下位
        const priorityB = b.priority ?? 999

        return priorityA - priorityB // 数字が小さい方（高優先度）が上
      })

      return {
        teamId,
        team: data.team,
        tasks: sortedTasks
      }
    })
  }, [tasks, teams])

  const totalTime = useMemo(() => {
    let totalSeconds = 0
    timeEntries.forEach((entry) => {
      if (!entry.endTime) return // 進行中のエントリはスキップ
      const start = new Date(entry.startTime).getTime()
      const end = new Date(entry.endTime).getTime()
      totalSeconds += (end - start) / 1000
    })
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return { hours, minutes }
  }, [timeEntries])

  const { todayTime, yesterdayTime, weekTime, monthTime, lastWeekTime, lastMonthTime } = useMemo(() => {
    // ローカルタイムゾーンで日付文字列を取得する関数
    const getLocalDateString = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const today = getLocalDateString(new Date())
    const yesterday = getLocalDateString(new Date(Date.now() - 86400000))
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()

    const now = new Date()

    // 今週の開始日（月曜日）
    const dayOfWeek = now.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + diff)
    weekStart.setHours(0, 0, 0, 0)

    // 先週の開始日と終了日
    const lastWeekStart = new Date(weekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekEnd = new Date(weekStart)
    lastWeekEnd.setMilliseconds(-1)

    // 先月の開始日と終了日
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1)
    const lastMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999)

    let todaySeconds = 0
    let yesterdaySeconds = 0
    let weekSeconds = 0
    let monthSeconds = 0
    let lastWeekSeconds = 0
    let lastMonthSeconds = 0

    timeEntries.forEach((entry) => {
      if (!entry.endTime) return // 進行中のエントリはスキップ
      const start = new Date(entry.startTime).getTime()
      const end = new Date(entry.endTime).getTime()
      const duration = (end - start) / 1000
      const entryDate = new Date(entry.startTime)

      // 今日
      const entryDateStr = getLocalDateString(entryDate)
      if (entryDateStr === today) {
        todaySeconds += duration
      }
      // 昨日（今日とは別に判定）
      if (entryDateStr === yesterday) {
        yesterdaySeconds += duration
      }

      // 今週
      if (entryDate >= weekStart) {
        weekSeconds += duration
      }

      // 今月
      if (entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear) {
        monthSeconds += duration
      }

      // 先週
      if (entryDate >= lastWeekStart && entryDate <= lastWeekEnd) {
        lastWeekSeconds += duration
      }

      // 先月
      if (entryDate >= lastMonthStart && entryDate <= lastMonthEnd) {
        lastMonthSeconds += duration
      }
    })

    return {
      todayTime: {
        hours: Math.floor(todaySeconds / 3600),
        minutes: Math.floor((todaySeconds % 3600) / 60),
      },
      yesterdayTime: {
        hours: Math.floor(yesterdaySeconds / 3600),
        minutes: Math.floor((yesterdaySeconds % 3600) / 60),
      },
      weekTime: {
        hours: Math.floor(weekSeconds / 3600),
        minutes: Math.floor((weekSeconds % 3600) / 60),
      },
      monthTime: {
        hours: Math.floor(monthSeconds / 3600),
        minutes: Math.floor((monthSeconds % 3600) / 60),
      },
      lastWeekTime: {
        hours: Math.floor(lastWeekSeconds / 3600),
        minutes: Math.floor((lastWeekSeconds % 3600) / 60),
      },
      lastMonthTime: {
        hours: Math.floor(lastMonthSeconds / 3600),
        minutes: Math.floor((lastMonthSeconds % 3600) / 60),
      },
    }
  }, [timeEntries])

  const handleUpdateTask = async () => {
    if (!editingTask || !editingTask.name.trim()) return

    // Linear連携タスクは編集不可
    if (editingTask.linear_issue_id) {
      alert(t("taskMgmt.linearManaged"))
      setEditingTask(null)
      return
    }

    if (onUpdateTask) {
      try {
        await onUpdateTask(editingTask.id, {
          name: editingTask.name,
          color: editingTask.color,
        })
        setEditingTask(null)
      } catch (err) {
        console.error("Failed to update task:", err)
      }
    } else {
      onTasksChange(tasks.map((task) => (task.id === editingTask.id ? editingTask : task)))
      setEditingTask(null)
    }
  }

  const handleDeleteTask = async (id: string) => {
    // Linear連携タスクは削除不可（UIで既にボタンが表示されないが念のため）
    const task = tasks.find(t => t.id === id)
    if (task?.linear_issue_id) {
      alert(t("taskMgmt.linearManagedDelete"))
      return
    }

    if (onDeleteTask) {
      try {
        await onDeleteTask(id)
      } catch (err) {
        console.error("Failed to delete task:", err)
      }
    } else {
      onTasksChange(tasks.filter((task) => task.id !== id))
    }
  }

  const handleSyncLinearIssues = async () => {
    setSyncing(true)
    setSyncMessage(null)

    try {
      const res = await fetch('/api/admin/tasks/sync-linear', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.details || data.error || t("taskMgmt.syncFailed"))
      }

      const summary = data.summary
      setSyncMessage({
        type: 'success',
        text: `${t("taskMgmt.syncComplete")}: Team ${summary.teams}, Project ${summary.projects}, Membership ${summary.memberships}, Issue ${summary.synced} added, ${summary.skipped} skipped${summary.errors > 0 ? `, ${summary.errors} errors` : ''}`
      })
    } catch (err) {
      console.error('Sync error:', err)
      setSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t("taskMgmt.syncFailed")
      })
    } finally {
      setSyncing(false)
    }
  }

  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(teamId)) {
        newSet.delete(teamId)
      } else {
        newSet.add(teamId)
      }
      return newSet
    })
  }

  const handleCreateGlobalTask = async () => {
    if (!newGlobalTaskName.trim()) {
      setSyncMessage({
        type: 'error',
        text: t("taskMgmt.enterTaskName")
      })
      return
    }

    if (!newGlobalTaskLabel.trim()) {
      setSyncMessage({
        type: 'error',
        text: t("taskMgmt.enterLabel")
      })
      return
    }

    setCreatingGlobalTask(true)
    setSyncMessage(null)

    try {
      const res = await fetch('/api/admin/tasks/create-global', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskName: newGlobalTaskName.trim(),
          label: newGlobalTaskLabel.trim()
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.details || data.error || t("taskMgmt.createFailed"))
      }

      setSyncMessage({
        type: 'success',
        text: data.message
      })

      // ダイアログを閉じて入力をクリア
      setShowGlobalTaskDialog(false)
      setNewGlobalTaskName('')
      setNewGlobalTaskLabel('')

      // タスクリストを再読み込み（ページリロードで更新）
      window.location.reload()
    } catch (err) {
      console.error('Create global task error:', err)
      setSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t("taskMgmt.createFailed")
      })
    } finally {
      setCreatingGlobalTask(false)
    }
  }

  const handleCreateTeamTask = async () => {
    if (!newTeamTaskName.trim()) {
      setSyncMessage({
        type: 'error',
        text: t("taskMgmt.enterTaskName")
      })
      return
    }

    if (!newTeamTaskLabel.trim()) {
      setSyncMessage({
        type: 'error',
        text: t("taskMgmt.enterLabel")
      })
      return
    }

    if (!selectedTeamId) {
      setSyncMessage({
        type: 'error',
        text: t("taskMgmt.selectTeam")
      })
      return
    }

    setCreatingTeamTask(true)
    setSyncMessage(null)

    try {
      const res = await fetch('/api/tasks/create-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskName: newTeamTaskName.trim(),
          label: newTeamTaskLabel.trim(),
          teamId: selectedTeamId
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.details || data.error || t("taskMgmt.createFailed"))
      }

      setSyncMessage({
        type: 'success',
        text: data.message
      })

      // ダイアログを閉じて入力をクリア
      setShowTeamTaskDialog(false)
      setNewTeamTaskName('')
      setNewTeamTaskLabel('')
      setSelectedTeamId('')

      // タスクリストを再読み込み（ページリロードで更新）
      window.location.reload()
    } catch (err) {
      console.error('Create team task error:', err)
      setSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t("taskMgmt.createFailed")
      })
    } finally {
      setCreatingTeamTask(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-[calc(100vh-200px)] relative">
      {/* Linear同期中の表示 */}
      {syncing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-8 space-y-4 text-center min-w-[400px]">
            <div className="text-lg font-semibold">{t("taskMgmt.syncing")}</div>
            <div className="text-sm text-muted-foreground">
              {t("taskMgmt.syncingDesc")}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      )}

      <div className="w-full lg:w-64 space-y-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">{t("taskMgmt.totalTime")}:</div>
          <div className="text-2xl font-bold">
            {totalTime.hours}{t("timeEntry.hours")}{totalTime.minutes}{t("timeEntry.minutes")}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {syncMessage && (
          <Alert variant={syncMessage.type === 'success' ? 'default' : 'destructive'}>
            {syncMessage.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{syncMessage.text}</AlertDescription>
          </Alert>
        )}

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium mb-1">{t("taskMgmt.taskList")}</div>
              <div className="text-xs text-muted-foreground">
                {t("taskMgmt.taskListDesc")}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowTeamTaskDialog(true)}
                variant="outline"
                size="sm"
              >
                {t("taskMgmt.createTeamTask")}
              </Button>
              {isAdmin && (
                <Button
                  onClick={() => setShowGlobalTaskDialog(true)}
                  variant="outline"
                  size="sm"
                >
                  {t("taskMgmt.createGlobalTask")}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 overflow-x-hidden">
          {groupedTasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("taskMgmt.noTasks")}
              </CardContent>
            </Card>
          ) : (
            groupedTasks.map((group) => {
              const isTeamExpanded = expandedTeams.has(group.teamId)
              const teamName = group.team?.name || t("taskMgmt.noTeam")
              const teamKey = group.team?.key || ''

              return (
                <Card key={group.teamId}>
                  <Collapsible open={isTeamExpanded} onOpenChange={() => toggleTeam(group.teamId)}>
                    <CardHeader className="cursor-pointer" onClick={() => toggleTeam(group.teamId)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              {isTeamExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <Users className="w-5 h-5 text-primary" />
                          <div className="flex-1">
                            <CardTitle className="text-lg">{teamName}</CardTitle>
                            {teamKey && (
                              <div className="text-xs text-muted-foreground font-mono mt-1">
                                {teamKey}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {group.tasks.length} {t("taskMgmt.tasks")}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CollapsibleContent>
                      <CardContent className="space-y-2">
                        {group.tasks.map((task) => {
                          // 優先度ラベルと色を取得
                          const getPriorityInfo = (priority?: number) => {
                            switch (priority) {
                              case 1: return { label: t('priority.urgent'), color: 'bg-red-500 text-white' }
                              case 2: return { label: t('priority.high'), color: 'bg-orange-500 text-white' }
                              case 3: return { label: t('priority.medium'), color: 'bg-yellow-500 text-white' }
                              case 4: return { label: t('priority.low'), color: 'bg-blue-500 text-white' }
                              default: return { label: t('priority.none'), color: 'bg-gray-400 text-white' }
                            }
                          }

                          // ステータスラベルと色を取得
                          const getStatusInfo = (stateType?: string) => {
                            const label = stateType || 'NULL'

                            // linear_state_typeに応じて色を変更
                            if (stateType === 'completed') {
                              return { label, color: 'bg-green-600 text-white' }
                            } else if (stateType === 'canceled') {
                              return { label, color: 'bg-gray-600 text-white' }
                            } else {
                              return { label, color: 'bg-blue-600 text-white' }
                            }
                          }

                          const priorityInfo = getPriorityInfo(task.priority)
                          const statusInfo = getStatusInfo(task.linear_state_type)

                          return (
                            <div
                              key={task.id}
                              className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 hover:bg-accent rounded group"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: task.color }}
                                />
                                <span className="flex-1 min-w-0">
                                  <div className="line-clamp-2">{task.name}</div>
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={`text-xs px-2 py-0.5 ${priorityInfo.color} whitespace-nowrap`}>
                                  {priorityInfo.label}
                                </Badge>
                                <Badge className={`text-xs px-2 py-0.5 ${statusInfo.color} whitespace-nowrap`}>
                                  {statusInfo.label}
                                </Badge>
                                {task.linear_issue_id && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                                    {task.linear_url ? (
                                      <a
                                        href={task.linear_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-primary underline"
                                      >
                                        {t("taskMgmt.openInLinear")}
                                      </a>
                                    ) : (
                                      <span>{t("taskMgmt.managedByLinear")}</span>
                                    )}
                                  </div>
                                )}
                                {isAdmin && !task.linear_issue_id && (
                                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setEditingTask(task)}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleDeleteTask(task.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )
            })
          )}
        </div>
      </div>

      <div className="w-full lg:w-80 space-y-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-lg font-semibold mb-4">{t("taskMgmt.workStats")}</div>

          <div className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t("taskMgmt.thisMonth")}:</div>
              <div className="text-xl font-bold">
                {monthTime.hours}{t("timeEntry.hours")}{monthTime.minutes}{t("timeEntry.minutes")}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">{t("taskMgmt.lastMonth")}:</div>
              <div className="text-lg font-semibold text-muted-foreground">
                {lastMonthTime.hours}{t("timeEntry.hours")}{lastMonthTime.minutes}{t("timeEntry.minutes")}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">{t("taskMgmt.thisWeek")}:</div>
              <div className="text-xl font-bold">
                {weekTime.hours}{t("timeEntry.hours")}{weekTime.minutes}{t("timeEntry.minutes")}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">{t("taskMgmt.lastWeek")}:</div>
              <div className="text-lg font-semibold text-muted-foreground">
                {lastWeekTime.hours}{t("timeEntry.hours")}{lastWeekTime.minutes}{t("timeEntry.minutes")}
              </div>
            </div>

            <div className="flex justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">{t("taskMgmt.today")}:</div>
                <div className="text-lg font-semibold">
                  {todayTime.hours}{t("timeEntry.hours")}{todayTime.minutes}{t("timeEntry.minutes")}
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">{t("taskMgmt.yesterday")}:</div>
                <div className="text-lg font-semibold">
                  {yesterdayTime.hours}{t("timeEntry.hours")}{yesterdayTime.minutes}{t("timeEntry.minutes")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <TaskTimeChart tasks={tasks} timeEntries={timeEntries} />
      </div>

      {editingTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-96 space-y-4">
            <h3 className="text-lg font-semibold">{t("taskMgmt.editTask")}</h3>

            <Input
              value={editingTask.name}
              onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
            />

            <div className="flex gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    editingTask.color === color ? "ring-2 ring-primary ring-offset-2" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setEditingTask({ ...editingTask, color })}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleUpdateTask} className="flex-1">
                {t("common.save")}
              </Button>
              <Button onClick={() => setEditingTask(null)} variant="outline" className="flex-1">
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showGlobalTaskDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-96 space-y-4">
            <h3 className="text-lg font-semibold">{t("taskMgmt.createGlobalTaskTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("taskMgmt.createGlobalTaskDesc")}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("taskMgmt.taskName")}</label>
                <Input
                  placeholder={t("taskMgmt.taskNamePlaceholder")}
                  value={newGlobalTaskName}
                  onChange={(e) => setNewGlobalTaskName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !creatingGlobalTask) {
                      handleCreateGlobalTask()
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("taskMgmt.labelName")}</label>
                <Input
                  placeholder={t("taskMgmt.labelPlaceholder")}
                  value={newGlobalTaskLabel}
                  onChange={(e) => setNewGlobalTaskLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !creatingGlobalTask) {
                      handleCreateGlobalTask()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("taskMgmt.labelDesc")}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCreateGlobalTask}
                className="flex-1"
                disabled={creatingGlobalTask || !newGlobalTaskName.trim() || !newGlobalTaskLabel.trim()}
              >
                {creatingGlobalTask ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t("taskMgmt.creating")}
                  </>
                ) : (
                  t("taskMgmt.create")
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowGlobalTaskDialog(false)
                  setNewGlobalTaskName('')
                  setNewGlobalTaskLabel('')
                }}
                variant="outline"
                className="flex-1"
                disabled={creatingGlobalTask}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTeamTaskDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-96 space-y-4">
            <h3 className="text-lg font-semibold">{t("taskMgmt.createTeamTaskTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("taskMgmt.createTeamTaskDesc")}
            </p>

            {userTeams.length === 0 ? (
              <div className="space-y-4">
                <div className="p-4 border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 rounded-md">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {t("taskMgmt.noTeamsAvailable")}
                  </p>
                </div>
                <Button
                  onClick={() => setShowTeamTaskDialog(false)}
                  variant="outline"
                  className="w-full"
                >
                  {t("common.close")}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("taskMgmt.selectTeamLabel")}</label>
                    <select
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                    >
                      <option value="">{t("taskMgmt.selectTeamPlaceholder")}</option>
                      {userTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.key})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("taskMgmt.taskName")}</label>
                    <Input
                      placeholder={t("taskMgmt.taskNamePlaceholder")}
                      value={newTeamTaskName}
                      onChange={(e) => setNewTeamTaskName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !creatingTeamTask) {
                          handleCreateTeamTask()
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("taskMgmt.labelName")}</label>
                    <Input
                      placeholder={t("taskMgmt.labelPlaceholder")}
                      value={newTeamTaskLabel}
                      onChange={(e) => setNewTeamTaskLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !creatingTeamTask) {
                          handleCreateTeamTask()
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("taskMgmt.teamLabelDesc")}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateTeamTask}
                    className="flex-1"
                    disabled={creatingTeamTask || !newTeamTaskName.trim() || !newTeamTaskLabel.trim() || !selectedTeamId}
                  >
                    {creatingTeamTask ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        {t("taskMgmt.creating")}
                      </>
                    ) : (
                      t("taskMgmt.create")
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowTeamTaskDialog(false)
                      setNewTeamTaskName('')
                      setNewTeamTaskLabel('')
                      setSelectedTeamId('')
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={creatingTeamTask}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
