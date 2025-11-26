"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Task, TimeEntry } from "@/lib/types"
import { useState, useEffect, useMemo } from "react"
import { generateId } from "@/lib/utils"
import { useAuth } from "@/lib/contexts/AuthContext"
import { useLanguage } from "@/lib/contexts/LanguageContext"

interface ManualTimeEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: Task[]
  onAdd: (entry: TimeEntry) => void
}

export function ManualTimeEntryDialog({ open, onOpenChange, tasks, onAdd }: ManualTimeEntryDialogProps) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [selectedTaskId, setSelectedTaskId] = useState("")
  const [comment, setComment] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [timeError, setTimeError] = useState("")

  // タスクをフィルタリング: completed/canceledを除外し、assignee_emailが一致するもの + グローバルタスクのみ表示
  const availableTasks = useMemo(() => {
    return tasks.filter((task) => {
      // linear_state_typeがcompleted, canceledの場合は除外
      if (task.linear_state_type === 'completed' || task.linear_state_type === 'canceled') {
        return false
      }

      // 1. グローバルタスク（全員が見える）
      if (task.assignee_email === 'TaskForAll@task.com') {
        return true
      }

      // 2. 自分にアサインされているタスク
      if (user?.email && task.assignee_email === user.email) {
        return true
      }

      return false
    })
  }, [tasks, user?.email])

  // タスクをTeamごとにグループ化してソート
  const sortedGroupedTasks = useMemo(() => {
    const groupedAvailableTasks = availableTasks.reduce((groups, task) => {
      let teamName: string
      if (!task.linear_team_id && task.assignee_email === 'TaskForAll@task.com') {
        // グローバルタスク: linear_identifierをラベルとして使用（なければ「その他」）
        teamName = task.linear_identifier || 'その他'
      } else if (task.linear_team_id) {
        // 通常のLinearタスク: Team名を使用（linear_identifierから推測）
        teamName = `Team: ${task.linear_identifier?.split('-')[0] || 'Unknown'}`
      } else {
        // その他
        teamName = 'その他'
      }

      if (!groups[teamName]) {
        groups[teamName] = []
      }
      groups[teamName].push(task)
      return groups
    }, {} as Record<string, typeof availableTasks>)

    // グループをソート: Teamグループを上に、グローバルタスクグループを下に配置
    return Object.entries(groupedAvailableTasks).sort(([teamA], [teamB]) => {
      const isTeamA = teamA.startsWith('Team:')
      const isTeamB = teamB.startsWith('Team:')

      if (isTeamA && isTeamB) {
        return teamA.localeCompare(teamB)
      }
      if (isTeamA) return -1
      if (isTeamB) return 1
      return teamA.localeCompare(teamB)
    })
  }, [availableTasks])

  // ダイアログが開いたときに今日の日付と現在時刻をデフォルト値として設定
  useEffect(() => {
    if (open) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      setStartDate(dateStr)
      setEndDate(dateStr)
      setStartTime("")
      setEndTime("")
      setComment("")
      setSelectedTaskId("")
      setTimeError("")
    }
  }, [open])

  // 時刻バリデーション
  useEffect(() => {
    if (startDate && endDate && startTime && endTime) {
      const [startHour, startMinute] = startTime.split(":").map(Number)
      const [endHour, endMinute] = endTime.split(":").map(Number)

      const startDateTime = new Date(`${startDate}T00:00:00`)
      startDateTime.setHours(startHour, startMinute, 0, 0)

      const endDateTime = new Date(`${endDate}T00:00:00`)
      endDateTime.setHours(endHour, endMinute, 0, 0)

      const now = new Date()

      // 終了日時が現在時刻より未来の場合はエラー
      if (endDateTime > now) {
        setTimeError(t("timeEntry.endTimeError"))
      } else if (startDateTime > now) {
        setTimeError(t("timeEntry.startTimeError"))
      } else if (startDateTime >= endDateTime) {
        setTimeError(t("timeEntry.timeOrderError"))
      } else {
        setTimeError("")
      }
    }
  }, [startDate, endDate, startTime, endTime])

  const handleSave = () => {
    // バリデーション
    if (!selectedTaskId) {
      setTimeError(t("timeEntry.selectTask"))
      return
    }

    if (!startTime || !endTime) {
      setTimeError(t("timeEntry.enterTime"))
      return
    }

    if (timeError) {
      return
    }

    const [startHour, startMinute] = startTime.split(":").map(Number)
    const [endHour, endMinute] = endTime.split(":").map(Number)

    // 日付をまたぐ場合は、2つのエントリに分割
    if (startDate !== endDate) {
      // 1つ目: 開始日の開始時刻から23:59:59まで
      const firstStart = new Date(`${startDate}T${startTime}:00`)
      const firstEnd = new Date(`${startDate}T23:59:59.999`)

      onAdd({
        id: generateId(),
        taskId: selectedTaskId,
        startTime: firstStart.toISOString(),
        endTime: firstEnd.toISOString(),
        comment,
        date: startDate,
      })

      // 2つ目: 終了日の0:00から終了時刻まで
      const secondStart = new Date(`${endDate}T00:00:00.000`)
      const secondEnd = new Date(`${endDate}T${endTime}:00`)

      onAdd({
        id: generateId(),
        taskId: selectedTaskId,
        startTime: secondStart.toISOString(),
        endTime: secondEnd.toISOString(),
        comment,
        date: endDate,
      })
    } else {
      // 同じ日の場合は1つのエントリを作成
      const startDateTime = new Date(`${startDate}T${startTime}:00`)
      const endDateTime = new Date(`${endDate}T${endTime}:00`)

      onAdd({
        id: generateId(),
        taskId: selectedTaskId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        comment,
        date: startDate,
      })
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("timeEntry.manualAddTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t("timeEntry.task")}</label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger>
                <SelectValue placeholder={t("timer.selectTask")} />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {sortedGroupedTasks.map(([teamName, teamTasks]) => (
                  <div key={teamName}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                      {teamName} ({teamTasks.length})
                    </div>
                    {teamTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: task.color }} />
                          {task.name}
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t("timeEntry.startDate")}</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t("timeEntry.endDate")}</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t("timeEntry.startTime")}</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t("timeEntry.endTime")}</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {timeError && (
            <div className="text-sm text-red-500 font-medium">
              {timeError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">{t("timeEntry.comment")}</label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder={t("timeEntry.commentPlaceholder")} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!!timeError || !selectedTaskId}>
            {t("timeEntry.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
