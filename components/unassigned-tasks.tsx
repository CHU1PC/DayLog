"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { Task } from "@/lib/types"
import { AlertCircle, Users, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/contexts/LanguageContext"

interface UnassignedTasksProps {
  tasks: Task[]
  onAssignTask?: (taskId: string, userId: string) => Promise<void>
}

export function UnassignedTasks({ tasks, onAssignTask }: UnassignedTasksProps) {
  const { t } = useLanguage()
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null)

  // assignee_emailが空のタスクのみをフィルタリング
  const unassignedTasks = useMemo(() => {
    console.log('[UnassignedTasks] Total tasks:', tasks.length)
    console.log('[UnassignedTasks] Tasks sample:', tasks.slice(0, 3).map(t => ({
      name: t.name,
      assignee_email: t.assignee_email,
      hasAssigneeEmail: !!t.assignee_email
    })))

    const filtered = tasks.filter(task => !task.assignee_email)
    console.log('[UnassignedTasks] Unassigned tasks count:', filtered.length)

    return filtered
  }, [tasks])

  // タスクをTeamごとにグループ化
  const groupedTasks = useMemo(() => {
    const grouped = new Map<string, Task[]>()

    unassignedTasks.forEach(task => {
      const teamKey = task.linear_identifier?.split('-')[0] || t("unassigned.other")
      const teamName = task.linear_team_id ? `Team: ${teamKey}` : t("unassigned.other")

      if (!grouped.has(teamName)) {
        grouped.set(teamName, [])
      }
      grouped.get(teamName)!.push(task)
    })

    return Array.from(grouped.entries()).map(([teamName, tasks]) => ({
      teamName,
      tasks: tasks.sort((a, b) => {
        // 優先度でソート
        const priorityA = a.priority ?? 999
        const priorityB = b.priority ?? 999
        return priorityA - priorityB
      })
    }))
  }, [unassignedTasks, t])

  const getPriorityBadge = (priority: number | null | undefined) => {
    if (!priority) return <Badge variant="outline">{t("unassigned.notSet")}</Badge>

    const priorityMap: Record<number, { labelKey: string; variant: "destructive" | "default" | "secondary" | "outline" }> = {
      1: { labelKey: "priority.urgent", variant: "destructive" },
      2: { labelKey: "priority.high", variant: "default" },
      3: { labelKey: "priority.medium", variant: "secondary" },
      4: { labelKey: "priority.low", variant: "outline" },
    }

    const config = priorityMap[priority] || { labelKey: "unassigned.unknown", variant: "outline" }
    return <Badge variant={config.variant}>{t(config.labelKey)}</Badge>
  }

  const getStateBadge = (stateType: string | null | undefined) => {
    if (!stateType) return null

    const stateMap: Record<string, { labelKey: string; variant: "default" | "secondary" | "outline" }> = {
      backlog: { labelKey: "unassigned.backlog", variant: "outline" },
      unstarted: { labelKey: "unassigned.unstarted", variant: "secondary" },
      started: { labelKey: "unassigned.inProgress", variant: "default" },
      completed: { labelKey: "unassigned.completed", variant: "outline" },
      canceled: { labelKey: "unassigned.canceled", variant: "outline" },
    }

    const config = stateMap[stateType] || { labelKey: stateType, variant: "outline" }
    return <Badge variant={config.variant}>{t(config.labelKey)}</Badge>
  }

  if (unassignedTasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("unassigned.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t("unassigned.noUnassigned")}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("unassigned.titleCount", { count: unassignedTasks.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t("unassigned.description")}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Accordion type="multiple" className="space-y-4">
        {groupedTasks.map(({ teamName, tasks }) => (
          <AccordionItem
            key={teamName}
            value={teamName}
            className="border rounded-lg overflow-hidden"
          >
            <Card className="border-0">
              <AccordionTrigger className="hover:no-underline px-0 py-0">
                <CardHeader className="flex-1">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{teamName}</CardTitle>
                    </div>
                    <Badge variant="outline">
                      {tasks.length} {t("unassigned.count") || "件"}
                    </Badge>
                  </div>
                </CardHeader>
              </AccordionTrigger>

              <AccordionContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium">{task.name}</h3>
                            {task.linear_identifier && (
                              <Badge variant="outline" className="font-mono text-xs">
                                {task.linear_identifier}
                              </Badge>
                            )}
                          </div>

                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 flex-wrap">
                            {getPriorityBadge(task.priority)}
                            {getStateBadge(task.linear_state_type)}
                            {task.linear_url && (
                              <a
                                href={task.linear_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                {t("taskMgmt.openInLinear")} →
                              </a>
                            )}
                          </div>
                        </div>

                        {onAssignTask && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={assigningTaskId === task.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              // TODO: ユーザー選択ダイアログを開く
                              console.log('Assign task:', task.id)
                            }}
                          >
                            {t("unassigned.assign")}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
