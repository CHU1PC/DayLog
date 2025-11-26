"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/contexts/AuthContext"
import { useLanguage, type Language } from "@/lib/contexts/LanguageContext"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user, userName, updateUserName } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [notificationInterval, setNotificationInterval] = useState("3600000") // デフォルト: 1時間
  const [notificationMode, setNotificationMode] = useState<"preset" | "custom">("preset")
  const [customMinutes, setCustomMinutes] = useState("60")
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language)

  useEffect(() => {
    if (open) {
      setName(userName || "")
      setError(null)
      setSuccess(false)
      setSelectedLanguage(language)

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
  }, [open, userName, language])

  const handleSave = async () => {
    setError(null)
    setSuccess(false)

    if (!name.trim()) {
      setError(t("settings.enterName"))
      return
    }

    // カスタムモードの場合、入力値を検証
    if (notificationMode === "custom") {
      const minutes = Number(customMinutes)
      if (isNaN(minutes) || minutes < 0) {
        setError(t("settings.invalidMinutes"))
        return
      }
      if (minutes > 0 && minutes < 0.17) { // 10秒未満
        setError(t("settings.minInterval"))
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

      // 言語設定を保存
      if (selectedLanguage !== language) {
        setLanguage(selectedLanguage)
      }

      setSuccess(true)

      // 2秒後にダイアログを閉じる
      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.updateFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t("settings.email")}</label>
            <Input
              type="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">{t("settings.emailNotEditable")}</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">{t("settings.name")}</label>
            <Input
              type="text"
              placeholder={t("settings.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">{t("settings.timerNotification")}</label>

            {/* モード選択 */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={notificationMode === "preset" ? "default" : "outline"}
                onClick={() => setNotificationMode("preset")}
                disabled={loading}
                className="flex-1"
              >
                {t("settings.preset")}
              </Button>
              <Button
                type="button"
                variant={notificationMode === "custom" ? "default" : "outline"}
                onClick={() => setNotificationMode("custom")}
                disabled={loading}
                className="flex-1"
              >
                {t("settings.custom")}
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
                  <SelectItem value="300000">{t("settings.every5min")}</SelectItem>
                  <SelectItem value="600000">{t("settings.every10min")}</SelectItem>
                  <SelectItem value="900000">{t("settings.every15min")}</SelectItem>
                  <SelectItem value="1800000">{t("settings.every30min")}</SelectItem>
                  <SelectItem value="3600000">{t("settings.every1hour")}</SelectItem>
                  <SelectItem value="7200000">{t("settings.every2hours")}</SelectItem>
                  <SelectItem value="0">{t("settings.noNotification")}</SelectItem>
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
                <span className="text-sm text-muted-foreground">{t("settings.minutesInterval")}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {notificationMode === "preset"
                ? t("settings.presetDescription")
                : t("settings.customDescription")}
            </p>
          </div>

          {/* 言語設定 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t("settings.language")}</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={selectedLanguage === "ja" ? "default" : "outline"}
                onClick={() => setSelectedLanguage("ja")}
                disabled={loading}
                className="flex-1"
              >
                {t("settings.japanese")}
              </Button>
              <Button
                type="button"
                variant={selectedLanguage === "en" ? "default" : "outline"}
                onClick={() => setSelectedLanguage("en")}
                disabled={loading}
                className="flex-1"
              >
                {t("settings.english")}
              </Button>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 text-green-500 text-sm p-3 rounded-md">
              {t("settings.nameUpdated")}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("settings.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={loading || success}>
            {loading ? t("settings.saving") : success ? t("settings.saved") : t("settings.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
