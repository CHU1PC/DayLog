"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/contexts/AuthContext"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user, userName, updateUserName } = useAuth()
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [notificationInterval, setNotificationInterval] = useState("3600000") // デフォルト: 1時間
  const [notificationMode, setNotificationMode] = useState<"preset" | "custom">("preset")
  const [customMinutes, setCustomMinutes] = useState("60")

  useEffect(() => {
    if (open) {
      setName(userName || "")
      setError(null)
      setSuccess(false)

      // localStorageから通知間隔を読み込み
      const savedInterval = localStorage.getItem('timerNotificationInterval')
      if (savedInterval) {
        const intervalMs = Number(savedInterval)
        setNotificationInterval(savedInterval)

        // プリセット値にない場合はカスタムモードに切り替え
        const presetValues = ["0", "300000", "600000", "900000", "1800000", "3600000", "7200000"]
        if (!presetValues.includes(savedInterval)) {
          setNotificationMode("custom")
          const minutes = Math.floor(intervalMs / 60000)
          setCustomMinutes(String(minutes))
        }
      }
    }
  }, [open, userName])

  const handleSave = async () => {
    setError(null)
    setSuccess(false)

    if (!name.trim()) {
      setError("名前を入力してください")
      return
    }

    // カスタムモードの場合、入力値を検証
    if (notificationMode === "custom") {
      const minutes = Number(customMinutes)
      if (isNaN(minutes) || minutes < 0) {
        setError("有効な分数を入力してください（0分以上）")
        return
      }
      if (minutes > 0 && minutes < 0.17) { // 10秒未満
        setError("通知間隔は10秒以上に設定してください")
        return
      }
    }

    setLoading(true)

    try {
      await updateUserName(name.trim())

      // 通知間隔をlocalStorageに保存
      let intervalToSave = notificationInterval
      if (notificationMode === "custom") {
        const minutes = Number(customMinutes)
        intervalToSave = String(Math.floor(minutes * 60000)) // 分をミリ秒に変換
      }
      localStorage.setItem('timerNotificationInterval', intervalToSave)

      // カスタムイベントを発行して他のコンポーネントに変更を通知
      window.dispatchEvent(new Event('notificationIntervalChanged'))

      setSuccess(true)

      // 2秒後にダイアログを閉じる
      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定の更新に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">メールアドレス</label>
            <Input
              type="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">メールアドレスは変更できません</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">名前</label>
            <Input
              type="text"
              placeholder="山田太郎"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">タイマー通知の間隔</label>

            {/* モード選択 */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={notificationMode === "preset" ? "default" : "outline"}
                onClick={() => setNotificationMode("preset")}
                disabled={loading}
                className="flex-1"
              >
                プリセット
              </Button>
              <Button
                type="button"
                variant={notificationMode === "custom" ? "default" : "outline"}
                onClick={() => setNotificationMode("custom")}
                disabled={loading}
                className="flex-1"
              >
                カスタム
              </Button>
            </div>

            {/* プリセットモード */}
            {notificationMode === "preset" && (
              <Select
                value={notificationInterval}
                onValueChange={setNotificationInterval}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="300000">5分ごと</SelectItem>
                  <SelectItem value="600000">10分ごと</SelectItem>
                  <SelectItem value="900000">15分ごと</SelectItem>
                  <SelectItem value="1800000">30分ごと</SelectItem>
                  <SelectItem value="3600000">1時間ごと（推奨）</SelectItem>
                  <SelectItem value="7200000">2時間ごと</SelectItem>
                  <SelectItem value="0">通知しない</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* カスタムモード */}
            {notificationMode === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="60"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  disabled={loading}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">分ごと</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {notificationMode === "preset"
                ? "タイマー実行中に定期的に通知を表示する間隔を設定できます"
                : "10秒以上の任意の間隔を設定できます（小数点も可能）"}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 text-green-500 text-sm p-3 rounded-md">
              名前を更新しました
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={loading || success}>
            {loading ? "保存中..." : success ? "保存完了" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
