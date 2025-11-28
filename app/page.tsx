"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { TaskTimer } from "@/components/task-timer"
import { WeeklyCalendar } from "@/components/weekly-calendar"
import { TaskManagement } from "@/components/task-management"
import { TeamManagement } from "@/components/team-management"
import { UserTeamViewer } from "@/components/user-team-viewer"
import { UnassignedTasks } from "@/components/unassigned-tasks"
import { SettingsDialog } from "@/components/settings-dialog"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { TimeEntry } from "@/lib/types"
import { useSupabase } from "@/lib/hooks/useSupabase"
import { useAuth } from "@/lib/contexts/AuthContext"
import { useLanguage } from "@/lib/contexts/LanguageContext"
import { LogOut, Settings, Menu } from "lucide-react"

export default function HomePage() {
  const [view, setView] = useState<"calendar" | "tasks" | "teams" | "user-teams" | "unassigned">("calendar")
  const [showSettings, setShowSettings] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, loading: authLoading, isApproved, isAdmin, userName, signOut } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login")
      } else if (isApproved === false) {
        // 承認されていない場合は承認待ちページへ
        // null の場合は読み込み中なのでリダイレクトしない
        router.push("/pending-approval")
      }
    }
  }, [user, authLoading, isApproved, router])

  const {
    tasks,
    timeEntries,
    loading,
    error,
    connectionStatus,
    addTask,
    updateTask,
    deleteTask,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    setTasks,
  } = useSupabase()

  const handleLogout = async () => {
    await signOut()
    router.push("/login")
  }

  const handleAddEntry = async (entry: Omit<TimeEntry, "id">) => {
    try {
      const savedEntry = await addTimeEntry(entry)
      console.log('[handleAddEntry] Entry added, ID:', savedEntry?.id)

      // 完了したエントリ（endTimeがある）の場合、スプレッドシートに同期
      // update APIが内部でnot_foundの場合はwriteを呼び出すため、フォールバック不要
      if (savedEntry?.id && entry.endTime) {
        console.log('[handleAddEntry] Syncing to spreadsheet:', savedEntry.id)
        try {
          // ユーザーのタイムゾーン設定を取得
          const timezone = typeof window !== 'undefined'
            ? localStorage.getItem('taskTimerTimezone') || 'Asia/Tokyo'
            : 'Asia/Tokyo'
          const updateRes = await fetch('/api/spreadsheet/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeEntryId: savedEntry.id, timezone }),
          })

          if (updateRes.ok) {
            const result = await updateRes.json()
            console.log('[handleAddEntry] Spreadsheet synced, action:', result.action)
          } else {
            console.error('[handleAddEntry] Spreadsheet sync failed:', updateRes.status)
          }
        } catch (spreadsheetError) {
          console.error('[handleAddEntry] Error syncing to spreadsheet:', spreadsheetError)
        }
      }
    } catch (err) {
      console.error("Failed to add entry:", err)
    }
  }

  const handleAddEntryWithId = async (entry: TimeEntry) => {
    console.log('[handleAddEntryWithId] Called with entry:', entry)
    try {
      const savedEntry = await addTimeEntry(entry)
      console.log('[handleAddEntryWithId] Successfully added entry, returned ID:', savedEntry?.id)
      return savedEntry
    } catch (err) {
      console.error("Failed to add entry:", err)
      throw err
    }
  }

  const handleUpdateEntry = async (id: string, updates: Partial<TimeEntry>) => {
    console.log('[handleUpdateEntry] Called with id:', id, 'updates:', updates)
    try {
      await updateTimeEntry(id, updates)
      console.log('[handleUpdateEntry] Successfully updated entry')
    } catch (err) {
      console.error("[handleUpdateEntry] Failed to update entry:", err)
      throw err // エラーを再スローして呼び出し元で捕捉できるようにする
    }
  }

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteTimeEntry(id)
    } catch (err) {
      console.error("Failed to delete entry:", err)
    }
  }

  // 認証チェックが完了するまで待機
  // authLoadingがfalseでも、ユーザーがいてisApprovedがnullの場合は承認状態の読み込み中
  if (authLoading || (user && isApproved === null)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">{t("loading.auth")}</div>
          <div className="text-sm text-muted-foreground">{t("loading.wait")}</div>
        </div>
      </div>
    )
  }

  // ユーザーが存在するが承認されていない場合は、リダイレクトする前に一瞬だけ待つ
  if (user && isApproved === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">{t("loading.redirect")}</div>
          <div className="text-sm text-muted-foreground">{t("loading.redirectPending")}</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">{t("loading.data")}</div>
          <div className="text-sm text-muted-foreground">{t("loading.fetchingData")}</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2 text-destructive">{t("error.occurred")}</div>
          <div className="text-sm text-muted-foreground">{error}</div>
          <div className="mt-4 text-xs text-muted-foreground">
            {t("error.checkEnv")}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-card/50 backdrop-blur-sm border-b border-border">
        <TaskTimer tasks={tasks} onAddEntry={handleAddEntryWithId} onUpdateEntry={handleUpdateEntry} timeEntries={timeEntries} isHeaderMode={true} />

        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 border-t border-border">
          <div className="flex items-center justify-between gap-2">
            {/* モバイル用ハンバーガーメニュー (md以下で表示) */}
            <div className="md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-2">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64">
                  <SheetHeader>
                    <SheetTitle>{t("nav.menu")}</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-2 mt-4">
                    <Button
                      variant={view === "calendar" ? "default" : "ghost"}
                      onClick={() => { setView("calendar"); setMobileMenuOpen(false); }}
                      className="justify-start"
                    >
                      {t("nav.calendar")}
                    </Button>
                    <Button
                      variant={view === "tasks" ? "default" : "ghost"}
                      onClick={() => { setView("tasks"); setMobileMenuOpen(false); }}
                      className="justify-start"
                    >
                      {t("nav.taskManagement")}
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          variant={view === "unassigned" ? "default" : "ghost"}
                          onClick={() => { setView("unassigned"); setMobileMenuOpen(false); }}
                          className="justify-start"
                        >
                          {t("nav.unassignedTasks")}
                        </Button>
                        <Button
                          variant={view === "teams" ? "default" : "ghost"}
                          onClick={() => { setView("teams"); setMobileMenuOpen(false); }}
                          className="justify-start"
                        >
                          {t("nav.teamManagement")}
                        </Button>
                        <Button
                          variant={view === "user-teams" ? "default" : "ghost"}
                          onClick={() => { setView("user-teams"); setMobileMenuOpen(false); }}
                          className="justify-start"
                        >
                          {t("nav.userTeamView")}
                        </Button>
                      </>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>

            {/* デスクトップ用ナビゲーション (md以上で表示) */}
            <div className="hidden md:flex items-center gap-1 sm:gap-2">
              <Button variant={view === "calendar" ? "default" : "ghost"} onClick={() => setView("calendar")} size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
                {t("nav.calendar")}
              </Button>
              <Button variant={view === "tasks" ? "default" : "ghost"} onClick={() => setView("tasks")} size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
                {t("nav.taskManagement")}
              </Button>
              {isAdmin && (
                <>
                  <Button variant={view === "unassigned" ? "default" : "ghost"} onClick={() => setView("unassigned")} size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
                    {t("nav.unassignedTasks")}
                  </Button>
                  <Button variant={view === "teams" ? "default" : "ghost"} onClick={() => setView("teams")} size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
                    {t("nav.teamManagement")}
                  </Button>
                  <Button variant={view === "user-teams" ? "default" : "ghost"} onClick={() => setView("user-teams")} size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
                    {t("nav.userTeamView")}
                  </Button>
                </>
              )}
            </div>

            {/* 右側: ユーザー情報・接続状態・アクションボタン */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* ユーザー名表示 */}
              {userName && (
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted border border-border">
                  <span className="text-xs font-medium text-foreground">{userName}</span>
                </div>
              )}

              {/* 管理者バッジ */}
              {isAdmin && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="hidden sm:inline text-xs font-semibold text-blue-500">{t("status.admin")}</span>
                </div>
              )}

              {/* 接続状態インジケーター */}
              <div className="flex items-center gap-1.5 text-xs">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  connectionStatus === 'disconnected' ? 'bg-yellow-500' :
                  'bg-gray-400 animate-pulse'
                }`} />
                <span className="hidden md:inline text-muted-foreground">
                  {connectionStatus === 'connected' ? t("status.connected") :
                   connectionStatus === 'disconnected' ? t("status.disconnected") :
                   t("status.connecting")}
                </span>
              </div>
              {isAdmin && (
                <Button variant="outline" onClick={() => router.push('/admin')} size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
                  <span className="hidden sm:inline">{t("nav.admin")}</span>
                  <span className="sm:hidden">{t("nav.admin")}</span>
                </Button>
              )}
              <Button variant="ghost" onClick={() => setShowSettings(true)} size="sm" className="px-2 sm:px-3" title={t("nav.settings")}>
                <Settings className="w-4 h-4" />
                <span className="hidden md:inline ml-1">{t("nav.settings")}</span>
              </Button>
              <Button variant="ghost" onClick={handleLogout} size="sm" className="px-2 sm:px-3" title={t("nav.logout")}>
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline ml-1">{t("nav.logout")}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {view === "calendar" && (
          <WeeklyCalendar
            tasks={tasks}
            timeEntries={timeEntries}
            onUpdateEntry={handleUpdateEntry}
            onDeleteEntry={handleDeleteEntry}
            onAddEntry={handleAddEntry}
          />
        )}
        {view === "tasks" && (
          <TaskManagement
            tasks={tasks}
            timeEntries={timeEntries}
            onTasksChange={setTasks}
            onAddTask={addTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
          />
        )}
        {view === "unassigned" && isAdmin && (
          <UnassignedTasks tasks={tasks} />
        )}
        {view === "teams" && isAdmin && (
          <TeamManagement />
        )}
        {view === "user-teams" && isAdmin && (
          <UserTeamViewer />
        )}
      </main>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  )
}
