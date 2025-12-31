'use client'

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Clock } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import type { Task, TimeEntry } from '@/lib/types'

interface TaskTimeChartProps {
  tasks: Task[]
  timeEntries: TimeEntry[]
}

type TimePeriod = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'

interface TaskTimeData {
  taskId: string
  taskName: string
  color: string
  totalSeconds: number
  formattedTime: string
}

export function TaskTimeChart({ tasks, timeEntries }: TaskTimeChartProps) {
  const { t } = useLanguage()
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('today')

  // 期間のフィルタリングに必要な日付を計算
  const dateFilters = useMemo(() => {
    const getLocalDateString = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const now = new Date()
    const today = getLocalDateString(now)
    const yesterday = getLocalDateString(new Date(Date.now() - 86400000))
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

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

    return { today, yesterday, weekStart, lastWeekStart, lastWeekEnd, lastMonthStart, lastMonthEnd, currentMonth, currentYear, getLocalDateString }
  }, [])

  // タスク別の作業時間を集計
  const taskTimeData = useMemo(() => {
    const { today, yesterday, weekStart, lastWeekStart, lastWeekEnd, lastMonthStart, lastMonthEnd, currentMonth, currentYear, getLocalDateString } = dateFilters

    // 期間に該当するエントリをフィルタリング
    const filteredEntries = timeEntries.filter((entry) => {
      if (!entry.endTime) return false // 進行中のエントリはスキップ
      const entryDate = new Date(entry.startTime)
      const entryDateStr = getLocalDateString(entryDate)

      switch (selectedPeriod) {
        case 'today':
          return entryDateStr === today
        case 'yesterday':
          return entryDateStr === yesterday
        case 'thisWeek':
          return entryDate >= weekStart
        case 'lastWeek':
          return entryDate >= lastWeekStart && entryDate <= lastWeekEnd
        case 'thisMonth':
          return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear
        case 'lastMonth':
          return entryDate >= lastMonthStart && entryDate <= lastMonthEnd
        default:
          return false
      }
    })

    // タスク別に集計
    const taskMap = new Map<string, number>()
    filteredEntries.forEach((entry) => {
      const start = new Date(entry.startTime).getTime()
      const end = new Date(entry.endTime!).getTime()
      const duration = (end - start) / 1000
      const current = taskMap.get(entry.taskId) || 0
      taskMap.set(entry.taskId, current + duration)
    })

    // TaskTimeData配列に変換
    const result: TaskTimeData[] = []
    taskMap.forEach((totalSeconds, taskId) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return

      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const formattedTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

      result.push({
        taskId,
        taskName: task.name,
        color: task.color,
        totalSeconds,
        formattedTime,
      })
    })

    // 時間順でソート（降順）
    result.sort((a, b) => b.totalSeconds - a.totalSeconds)

    // 上位8件を返す、残りは「その他」にまとめる
    if (result.length > 8) {
      const top8 = result.slice(0, 8)
      const others = result.slice(8)
      const othersTotal = others.reduce((sum, item) => sum + item.totalSeconds, 0)
      const hours = Math.floor(othersTotal / 3600)
      const minutes = Math.floor((othersTotal % 3600) / 60)
      top8.push({
        taskId: 'others',
        taskName: t('chart.others') || 'Others',
        color: '#9ca3af',
        totalSeconds: othersTotal,
        formattedTime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      })
      return top8
    }

    return result
  }, [timeEntries, tasks, selectedPeriod, dateFilters, t])

  // グラフ用データに変換
  const chartData = taskTimeData.map((item) => ({
    name: item.taskName.length > 12 ? `${item.taskName.slice(0, 12)}...` : item.taskName,
    fullName: item.taskName,
    value: item.totalSeconds / 60, // 分単位
    fill: item.color,
    formattedTime: item.formattedTime,
  }))

  // カスタムツールチップ
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (!active || !payload?.length) return null
    const data = payload[0].payload
    return (
      <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.fill }} />
          <span className="font-medium text-sm">{data.fullName}</span>
        </div>
        <div className="text-sm text-muted-foreground mt-1">{data.formattedTime}</div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-lg font-semibold mb-4">{t('chart.taskDistribution')}</div>

      <Tabs
        defaultValue="today"
        onValueChange={(v) => setSelectedPeriod(v as TimePeriod)}
        className="mb-4"
      >
        <TabsList className="grid w-full grid-cols-3 h-8 mb-1">
          <TabsTrigger value="today" className="text-xs px-1">
            {t('taskMgmt.today')}
          </TabsTrigger>
          <TabsTrigger value="yesterday" className="text-xs px-1">
            {t('taskMgmt.yesterday')}
          </TabsTrigger>
          <TabsTrigger value="thisWeek" className="text-xs px-1">
            {t('taskMgmt.thisWeek')}
          </TabsTrigger>
        </TabsList>
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="lastWeek" className="text-xs px-1">
            {t('taskMgmt.lastWeek')}
          </TabsTrigger>
          <TabsTrigger value="thisMonth" className="text-xs px-1">
            {t('taskMgmt.thisMonth')}
          </TabsTrigger>
          <TabsTrigger value="lastMonth" className="text-xs px-1">
            {t('taskMgmt.lastMonth')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {chartData.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 60, left: 0, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: (_: unknown, entry: { formattedTime?: string }) => entry?.formattedTime || '' }}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t('chart.noData')}</p>
        </div>
      )}
    </div>
  )
}
