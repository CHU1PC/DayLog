"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import type { Task, TimeEntry } from "@/lib/types"
import { useState, useEffect } from "react"
import { Trash2 } from "lucide-react"
import { useLanguage } from "@/lib/contexts/LanguageContext"

interface TimeEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: TimeEntry | null
  tasks: Task[]
  onUpdate: (updates: Partial<TimeEntry>) => void
  onDelete: () => void
  onAdd: (entry: Omit<TimeEntry, "id">) => void
}

export function TimeEntryDialog({ open, onOpenChange, entry, tasks, onUpdate, onDelete, onAdd }: TimeEntryDialogProps) {
  const { t, language } = useLanguage()
  const [comment, setComment] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [timeError, setTimeError] = useState("")

  useEffect(() => {
    // ダイアログが開かれたときに状態をリセット
    if (open && entry) {
      setComment(entry.comment)
      const start = new Date(entry.startTime)
      // ローカルタイムゾーンの日付を取得
      const startYear = start.getFullYear()
      const startMonth = String(start.getMonth() + 1).padStart(2, '0')
      const startDay = String(start.getDate()).padStart(2, '0')
      setStartDate(`${startYear}-${startMonth}-${startDay}`)
      setStartTime(`${start.getHours().toString().padStart(2, "0")}:${start.getMinutes().toString().padStart(2, "0")}`)

      if (entry.endTime) {
        const end = new Date(entry.endTime)
        // ローカルタイムゾーンの日付を取得
        const endYear = end.getFullYear()
        const endMonth = String(end.getMonth() + 1).padStart(2, '0')
        const endDay = String(end.getDate()).padStart(2, '0')
        setEndDate(`${endYear}-${endMonth}-${endDay}`)
        setEndTime(`${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`)
      }
      setTimeError("")
    }
  }, [open, entry])

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
      // 1分の余裕を持たせる（編集中に現在時刻が過ぎてしまう場合を考慮）
      const nowWithBuffer = new Date(now.getTime() + 60000)

      // 終了日時が現在時刻より未来の場合はエラー（1分の余裕あり）
      if (endDateTime > nowWithBuffer) {
        setTimeError(t("timeEntry.endTimeError"))
      } else if (startDateTime > nowWithBuffer) {
        setTimeError(t("timeEntry.startTimeError"))
      } else if (startDateTime >= endDateTime) {
        setTimeError(t("timeEntry.timeOrderError"))
      } else {
        setTimeError("")
      }
    }
  }, [startDate, endDate, startTime, endTime, t])

  const handleSave = () => {
    if (!entry) return

    // エラーがある場合は保存しない
    if (timeError) {
      return
    }

    // 日付をまたぐ場合は、2つのエントリに分割
    if (startDate !== endDate) {
      // 元のエントリを23:59:59まで更新（削除しない）
      const firstStart = new Date(`${startDate}T${startTime}:00`)
      const firstEnd = new Date(`${startDate}T23:59:59.999`)

      const firstUpdates: Partial<TimeEntry> = {
        comment,
        startTime: firstStart.toISOString(),
        endTime: firstEnd.toISOString(),
        date: startDate,
      }

      onUpdate(firstUpdates)

      // 2つ目: 終了日の0:00から終了時刻まで（新規追加）
      const secondStart = new Date(`${endDate}T00:00:00.000`)
      const secondEnd = new Date(`${endDate}T${endTime}:00`)

      onAdd({
        taskId: entry.taskId,
        startTime: secondStart.toISOString(),
        endTime: secondEnd.toISOString(),
        comment,
        date: endDate,
      })

      onOpenChange(false)
    } else {
      // 同じ日の場合は通常の更新
      const startDateTime = new Date(`${startDate}T${startTime}:00`)
      const endDateTime = new Date(`${endDate}T${endTime}:00`)

      const updates: Partial<TimeEntry> = {
        comment,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        date: startDate,
      }

      onUpdate(updates)
    }
  }

  if (!entry) return null

  const task = tasks.find((t) => t.id === entry.taskId)
  if (!task) return null

  const calculateDuration = () => {
    const start = new Date(entry.startTime)
    const end = entry.endTime ? new Date(entry.endTime) : new Date()
    const diffMs = end.getTime() - start.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    if (language === "en") {
      return `${hours} ${t("timeEntry.hours")} ${minutes} ${t("timeEntry.minutes")}`
    }
    return `${hours}${t("timeEntry.hours")}${minutes}${t("timeEntry.minutes")}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("timeEntry.editTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t("timeEntry.task")}</label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: task.color }} />
              <span className="font-medium">{task.name}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t("timeEntry.startDate")}</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} autoFocus={false} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t("timeEntry.endDate")}</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} autoFocus={false} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t("timeEntry.startTime")}</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} autoFocus={false} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t("timeEntry.endTime")}</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} autoFocus={false} />
            </div>
          </div>

          {timeError && (
            <div className="text-sm text-red-500 font-medium">
              {timeError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">{t("timeEntry.totalTime")}: {calculateDuration()}</label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t("timeEntry.comment")}</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !timeError) {
                  handleSave()
                }
              }}
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">{t("timeEntry.saveShortcut")}</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            {t("timeEntry.delete")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("timeEntry.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!!timeError}>{t("timeEntry.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
