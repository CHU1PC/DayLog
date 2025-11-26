"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

export type Language = "ja" | "en"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const translations: Record<Language, Record<string, string>> = {
  ja: {
    // Navigation
    "nav.calendar": "カレンダー",
    "nav.taskManagement": "タスク管理",
    "nav.unassignedTasks": "未アサインタスク",
    "nav.teamManagement": "Team管理",
    "nav.userTeamView": "ユーザーTeam表示",
    "nav.menu": "メニュー",
    "nav.admin": "管理画面",
    "nav.settings": "設定",
    "nav.logout": "ログアウト",

    // Connection status
    "status.connected": "Supabase接続済",
    "status.disconnected": "ローカルモード",
    "status.connecting": "接続確認中...",
    "status.admin": "管理者",
    "status.user": "ユーザー",

    // Loading states
    "loading.auth": "認証確認中...",
    "loading.wait": "お待ちください",
    "loading.redirect": "リダイレクト中...",
    "loading.redirectPending": "承認待ちページへ移動します",
    "loading.data": "読み込み中...",
    "loading.fetchingData": "データを取得しています",

    // Errors
    "error.occurred": "エラーが発生しました",
    "error.checkEnv": "環境変数が正しく設定されているか確認してください",
    "error.unknown": "不明なエラーが発生しました",

    // Settings dialog
    "settings.title": "設定",
    "settings.email": "メールアドレス",
    "settings.emailNotEditable": "メールアドレスは変更できません",
    "settings.name": "名前",
    "settings.namePlaceholder": "山田太郎",
    "settings.timerNotification": "タイマー通知の間隔",
    "settings.preset": "プリセット",
    "settings.custom": "カスタム",
    "settings.every5min": "5分ごと",
    "settings.every10min": "10分ごと",
    "settings.every15min": "15分ごと",
    "settings.every30min": "30分ごと",
    "settings.every1hour": "1時間ごと（推奨）",
    "settings.every2hours": "2時間ごと",
    "settings.noNotification": "通知しない",
    "settings.minutesInterval": "分ごと",
    "settings.presetDescription": "タイマー実行中に定期的に通知を表示する間隔を設定できます",
    "settings.customDescription": "10秒以上の任意の間隔を設定できます（小数点も可能）",
    "settings.language": "表示言語",
    "settings.japanese": "日本語",
    "settings.english": "English",
    "settings.nameUpdated": "設定を更新しました",
    "settings.save": "保存",
    "settings.saving": "保存中...",
    "settings.saved": "保存完了",
    "settings.cancel": "キャンセル",
    "settings.enterName": "名前を入力してください",
    "settings.invalidMinutes": "有効な分数を入力してください（0分以上）",
    "settings.minInterval": "通知間隔は10秒以上に設定してください",
    "settings.updateFailed": "設定の更新に失敗しました",

    // Time entry dialog
    "timeEntry.editTitle": "時間記録の編集",
    "timeEntry.task": "タスク",
    "timeEntry.startDate": "開始日",
    "timeEntry.endDate": "終了日",
    "timeEntry.startTime": "開始時刻",
    "timeEntry.endTime": "終了時刻",
    "timeEntry.totalTime": "合計時間",
    "timeEntry.hours": "時間",
    "timeEntry.minutes": "分",
    "timeEntry.comment": "コメント",
    "timeEntry.saveShortcut": "⌘/Ctrl + Enter で保存",
    "timeEntry.delete": "削除",
    "timeEntry.save": "保存",
    "timeEntry.cancel": "キャンセル",
    "timeEntry.endTimeError": "終了日時は現在時刻より未来に設定できません",
    "timeEntry.startTimeError": "開始日時は現在時刻より未来に設定できません",
    "timeEntry.timeOrderError": "終了日時は開始日時より後に設定してください",
    "timeEntry.selectTask": "タスクを選択してください",
    "timeEntry.enterTime": "開始時刻と終了時刻を入力してください",
    "timeEntry.manualAddTitle": "手動で時間エントリを追加",
    "timeEntry.add": "追加",
    "timeEntry.commentPlaceholder": "作業内容を入力してください",

    // Weekly calendar
    "calendar.manualAdd": "手動追加",
    "calendar.inProgress": "進行中",
    "calendar.mon": "月",
    "calendar.tue": "火",
    "calendar.wed": "水",
    "calendar.thu": "木",
    "calendar.fri": "金",
    "calendar.sat": "土",
    "calendar.sun": "日",

    // Task timer
    "timer.selectTask": "タスクを選択",
    "timer.start": "開始",
    "timer.stop": "停止",
    "timer.noTasks": "タスクがありません",
    "timer.commentTitle": "作業コメントを入力",
    "timer.nameRequired": "名前の設定が必要です",
    "timer.nameRequiredDesc": "タイマーを開始するには、設定画面で名前を設定してください。",
    "timer.close": "閉じる",

    // Login page
    "login.title": "DayLog",
    "login.subtitle": "Googleアカウントでログイン",
    "login.googleButton": "Googleでログイン",
    "login.googleLoading": "Google認証中...",
    "login.googleFailed": "Googleログインに失敗しました",
    "login.approvalRequired": "初回ログイン時は管理者の承認が必要です",

    // Signup page
    "signup.subtitle": "Googleアカウントで新規登録",
    "signup.googleButton": "Googleでサインアップ",
    "signup.googleFailed": "Googleサインアップに失敗しました",
    "signup.approvalRequired": "初回登録時は管理者の承認が必要です",
    "signup.termsAgreement": "Googleアカウントでサインアップすると、利用規約とプライバシーポリシーに同意したものとみなされます",

    // Pending approval page
    "pending.title": "承認待ち",
    "pending.description": "アカウントは正常に作成されましたが、管理者による承認が必要です",
    "pending.email": "登録メールアドレス",
    "pending.nextSteps": "次のステップ",
    "pending.step1": "管理者にアカウントを登録したことを知らせてください",
    "pending.step2": "管理者があなたのアカウントを承認しましたら、再度ログインしてください",
    "pending.checkStatus": "承認状態を確認",
    "pending.contactAdmin": "問題がある場合は、管理者にお問い合わせください",

    // Admin page
    "admin.title": "管理者ダッシュボード",
    "admin.subtitle": "ユーザーの管理",
    "admin.backToHome": "ホームに戻る",
    "admin.pendingUsers": "承認待ちユーザー",
    "admin.approvedUsers": "承認済みユーザー",
    "admin.noPendingUsers": "承認待ちのユーザーはいません",
    "admin.noApprovedUsers": "承認済みのユーザーはいません",
    "admin.pending": "承認待ち",
    "admin.approved": "承認済み",
    "admin.approveAsUser": "ユーザーとして承認",
    "admin.approveAsAdmin": "管理者として承認",
    "admin.approving": "承認中...",
    "admin.reject": "認証拒否",
    "admin.rejecting": "拒否中...",
    "admin.revokeApproval": "承認を取り消す",
    "admin.revoking": "取り消し中...",
    "admin.deleteUser": "ユーザーを削除",
    "admin.deleting": "削除中...",
    "admin.registeredAt": "登録日時",
    "admin.confirmDelete": "本当にこのユーザーを削除しますか？この操作は取り消せません。",
    "admin.confirmReject": "このユーザーの認証を拒否しますか？",
    "admin.fetchUsersFailed": "ユーザー一覧の取得に失敗しました",
    "admin.approveFailed": "ユーザーの承認に失敗しました",
    "admin.revokeFailed": "承認の取り消しに失敗しました",
    "admin.deleteFailed": "ユーザーの削除に失敗しました",
    "admin.rejectFailed": "認証拒否に失敗しました",

    // Admin teams page
    "adminTeams.title": "Team管理",
    "adminTeams.subtitle": "TeamごとのLinear Issueとメンバーを管理",
    "adminTeams.teamSelection": "Team選択",
    "adminTeams.selected": "個選択中",
    "adminTeams.open": "開く",
    "adminTeams.close": "閉じる",
    "adminTeams.selectAll": "すべて選択",
    "adminTeams.clearSelection": "選択解除",
    "adminTeams.noTeams": "Teamがありません。Webhook経由でLinearから同期されます。",
    "adminTeams.noSelectedTeams": "選択されたTeamがありません。上記のフィルターからTeamを選択してください。",
    "adminTeams.members": "名",
    "adminTeams.issues": "件のIssue",
    "adminTeams.noMembersWithIssues": "このTeamにアサインされているIssueを持つメンバーがいません",
    "adminTeams.issueId": "Issue ID",
    "adminTeams.issueTitle": "タイトル",
    "adminTeams.priority": "優先度",
    "adminTeams.status": "ステータス",
    "adminTeams.fetchFailed": "Team一覧の取得に失敗しました",

    // Priority labels
    "priority.none": "なし",
    "priority.urgent": "緊急",
    "priority.high": "高",
    "priority.medium": "中",
    "priority.low": "低",
    "priority.notSet": "未設定",

    // Status labels
    "status.backlog": "バックログ",
    "status.unstarted": "未着手",
    "status.started": "進行中",
    "status.completed": "完了",
    "status.canceled": "キャンセル",

    // Task management
    "taskMgmt.totalTime": "全タスクの総合計",
    "taskMgmt.taskList": "タスク一覧",
    "taskMgmt.taskListDesc": "Linear上でIssueを作成すると自動的にタスクが追加されます",
    "taskMgmt.createGlobalTask": "グローバルタスク作成",
    "taskMgmt.noTasks": "タスクがありません",
    "taskMgmt.noTeam": "チームなし",
    "taskMgmt.tasks": "タスク",
    "taskMgmt.openInLinear": "Linearで開く",
    "taskMgmt.managedByLinear": "Linearで管理",
    "taskMgmt.editTask": "タスクを編集",
    "taskMgmt.linearManaged": "このタスクはLinearで管理されているため、Linearから編集してください。",
    "taskMgmt.linearManagedDelete": "このタスクはLinearで管理されているため、Linearから削除してください。",
    "taskMgmt.syncing": "Linear同期中...",
    "taskMgmt.syncingDesc": "新しいIssueをデータベースに追加しています。",
    "taskMgmt.syncComplete": "同期完了",
    "taskMgmt.syncFailed": "Linear同期に失敗しました",
    "taskMgmt.createGlobalTaskTitle": "グローバルタスクを作成",
    "taskMgmt.createGlobalTaskDesc": "全ユーザーが使用できるタスクを作成します",
    "taskMgmt.taskName": "タスク名",
    "taskMgmt.taskNamePlaceholder": "例: 勉強、会議、休憩",
    "taskMgmt.labelName": "ラベル（グループ名）",
    "taskMgmt.labelPlaceholder": "例: その他、共通、日常",
    "taskMgmt.labelDesc": "タスク選択時にこのラベルでグループ化されます（⌘/Ctrl + Enter で作成）",
    "taskMgmt.creating": "作成中...",
    "taskMgmt.create": "作成",
    "taskMgmt.enterTaskName": "タスク名を入力してください",
    "taskMgmt.enterLabel": "ラベル名を入力してください",
    "taskMgmt.createFailed": "グローバルタスクの作成に失敗しました",
    "taskMgmt.workStats": "稼働時間統計",
    "taskMgmt.thisMonth": "今月",
    "taskMgmt.lastMonth": "先月",
    "taskMgmt.thisWeek": "今週",
    "taskMgmt.lastWeek": "先週",
    "taskMgmt.today": "今日",
    "taskMgmt.yesterday": "昨日",
    "taskMgmt.other": "その他",

    // User team viewer
    "userTeam.userSelection": "ユーザー選択",
    "userTeam.select": "選択",
    "userTeam.peopleSelected": "人選択中",
    "userTeam.clear": "クリア",
    "userTeam.selectUsersDesc": "表示するユーザーを選択してください（未選択の場合は全員表示）",
    "userTeam.selectAllUsers": "全選択",
    "userTeam.noSelectedUsers": "選択したユーザーが見つかりません",
    "userTeam.noUsers": "ユーザーが見つかりません",
    "userTeam.working": "作業中",
    "userTeam.noActiveTask": "作業中のタスクなし",
    "userTeam.notInTeam": "Teamに所属していません",
    "userTeam.noIssues": "Issueがありません",
    "userTeam.fetchFailed": "ユーザーTeam情報の取得に失敗しました",

    // User team viewer (userTeamViewer. keys)
    "userTeamViewer.userSelection": "ユーザー選択",
    "userTeamViewer.select": "選択",
    "userTeamViewer.usersSelected": "{{count}}人選択中",
    "userTeamViewer.clear": "クリア",
    "userTeamViewer.selectHint": "表示するユーザーを選択してください（未選択の場合は全員表示）",
    "userTeamViewer.noSelectedUsers": "選択したユーザーが見つかりません",
    "userTeamViewer.noUsers": "ユーザーが見つかりません",
    "userTeamViewer.working": "作業中",
    "userTeamViewer.noCurrentTask": "作業中のタスクなし",
    "userTeamViewer.noTeam": "Teamに所属していません",
    "userTeamViewer.noIssues": "Issueがありません",
    "userTeamViewer.fetchFailed": "ユーザーTeam情報の取得に失敗しました",

    // Unassigned tasks
    "unassigned.title": "未アサインタスク",
    "unassigned.titleCount": "未アサインタスク（{{count}}件）",
    "unassigned.count": "件",
    "unassigned.noUnassigned": "現在、未アサインのタスクはありません。",
    "unassigned.description": "誰にもアサインされていないタスクの一覧です。必要に応じてメンバーにアサインしてください。",
    "unassigned.assign": "アサイン",
    "unassigned.openInLinear": "Linearで開く →",
    "unassigned.notSet": "未設定",
    "unassigned.unknown": "不明",
    "unassigned.backlog": "バックログ",
    "unassigned.unstarted": "未着手",
    "unassigned.inProgress": "進行中",
    "unassigned.completed": "完了",
    "unassigned.canceled": "キャンセル",
    "unassigned.other": "その他",

    // Common
    "common.team": "Team",
    "common.issue": "Issue",
    "common.cancel": "キャンセル",
    "common.save": "保存",
    "common.delete": "削除",
    "common.edit": "編集",
    "common.close": "閉じる",
    "common.open": "開く",
    "common.selectAll": "すべて選択",
    "common.deselectAll": "選択解除",

    // Navigation
    "nav.backToHome": "ホームに戻る",

    // Teams page
    "teams.title": "Team管理",
    "teams.subtitle": "TeamごとのLinear Issueとメンバーを管理",
    "teams.selectTeam": "Team選択",
    "teams.selectedCount": "{{count}}個選択中",
    "teams.noTeams": "Teamがありません。Webhook経由でLinearから同期されます。",
    "teams.noTeamsSelected": "選択されたTeamがありません。上記のフィルターからTeamを選択してください。",
    "teams.memberCount": "{{count}}名",
    "teams.issueCount": "{{count}}件のIssue",
    "teams.noMembersWithIssues": "このTeamにアサインされているIssueを持つメンバーがいません",
    "teams.issueId": "Issue ID",
    "teams.issueTitle": "タイトル",
    "teams.issuePriority": "優先度",
    "teams.issueStatus": "ステータス",
    "teams.fetchFailed": "Team一覧の取得に失敗しました",

    // Admin status
    "admin.statusPending": "承認待ち",
    "admin.statusApproved": "承認済み",
    "admin.roleAdmin": "管理者",
    "admin.roleUser": "ユーザー",

    // Timezones
    "timezone.Asia/Tokyo": "日本時間 (JST)",
    "timezone.America/New_York": "アメリカ東部時間 (EST/EDT)",
    "timezone.America/Los_Angeles": "アメリカ太平洋時間 (PST/PDT)",
    "timezone.Europe/London": "イギリス時間 (GMT/BST)",
    "timezone.Asia/Shanghai": "中国標準時 (CST)",
    "timezone.Asia/Kolkata": "インド標準時 (IST)",
    "timezone.Europe/Paris": "中央ヨーロッパ時間 (CET/CEST)",
    "timezone.Australia/Sydney": "オーストラリア東部時間 (AEST/AEDT)",
    "timezone.Pacific/Auckland": "ニュージーランド時間 (NZST/NZDT)",
  },
  en: {
    // Navigation
    "nav.calendar": "Calendar",
    "nav.taskManagement": "Task Management",
    "nav.unassignedTasks": "Unassigned Tasks",
    "nav.teamManagement": "Team Management",
    "nav.userTeamView": "User Team View",
    "nav.menu": "Menu",
    "nav.admin": "Admin",
    "nav.settings": "Settings",
    "nav.logout": "Logout",

    // Connection status
    "status.connected": "Supabase Connected",
    "status.disconnected": "Local Mode",
    "status.connecting": "Connecting...",
    "status.admin": "Admin",
    "status.user": "User",

    // Loading states
    "loading.auth": "Authenticating...",
    "loading.wait": "Please wait",
    "loading.redirect": "Redirecting...",
    "loading.redirectPending": "Moving to pending approval page",
    "loading.data": "Loading...",
    "loading.fetchingData": "Fetching data",

    // Errors
    "error.occurred": "An error occurred",
    "error.checkEnv": "Please check that environment variables are set correctly",
    "error.unknown": "An unknown error occurred",

    // Settings dialog
    "settings.title": "Settings",
    "settings.email": "Email",
    "settings.emailNotEditable": "Email cannot be changed",
    "settings.name": "Name",
    "settings.namePlaceholder": "John Doe",
    "settings.timerNotification": "Timer Notification Interval",
    "settings.preset": "Preset",
    "settings.custom": "Custom",
    "settings.every5min": "Every 5 minutes",
    "settings.every10min": "Every 10 minutes",
    "settings.every15min": "Every 15 minutes",
    "settings.every30min": "Every 30 minutes",
    "settings.every1hour": "Every 1 hour (recommended)",
    "settings.every2hours": "Every 2 hours",
    "settings.noNotification": "No notification",
    "settings.minutesInterval": "minutes",
    "settings.presetDescription": "Set the interval for periodic notifications during timer",
    "settings.customDescription": "Set any interval of 10 seconds or more (decimals allowed)",
    "settings.language": "Display Language",
    "settings.japanese": "日本語",
    "settings.english": "English",
    "settings.nameUpdated": "Settings updated",
    "settings.save": "Save",
    "settings.saving": "Saving...",
    "settings.saved": "Saved",
    "settings.cancel": "Cancel",
    "settings.enterName": "Please enter your name",
    "settings.invalidMinutes": "Please enter a valid number of minutes (0 or more)",
    "settings.minInterval": "Notification interval must be at least 10 seconds",
    "settings.updateFailed": "Failed to update settings",

    // Time entry dialog
    "timeEntry.editTitle": "Edit Time Entry",
    "timeEntry.task": "Task",
    "timeEntry.startDate": "Start Date",
    "timeEntry.endDate": "End Date",
    "timeEntry.startTime": "Start Time",
    "timeEntry.endTime": "End Time",
    "timeEntry.totalTime": "Total Time",
    "timeEntry.hours": "h ",
    "timeEntry.minutes": "min",
    "timeEntry.comment": "Comment",
    "timeEntry.saveShortcut": "⌘/Ctrl + Enter to save",
    "timeEntry.delete": "Delete",
    "timeEntry.save": "Save",
    "timeEntry.cancel": "Cancel",
    "timeEntry.endTimeError": "End time cannot be in the future",
    "timeEntry.startTimeError": "Start time cannot be in the future",
    "timeEntry.timeOrderError": "End time must be after start time",
    "timeEntry.selectTask": "Please select a task",
    "timeEntry.enterTime": "Please enter start and end time",
    "timeEntry.manualAddTitle": "Add Time Entry Manually",
    "timeEntry.add": "Add",
    "timeEntry.commentPlaceholder": "Enter your work details",

    // Weekly calendar
    "calendar.manualAdd": "Manual Add",
    "calendar.inProgress": "In Progress",
    "calendar.mon": "Mon",
    "calendar.tue": "Tue",
    "calendar.wed": "Wed",
    "calendar.thu": "Thu",
    "calendar.fri": "Fri",
    "calendar.sat": "Sat",
    "calendar.sun": "Sun",

    // Task timer
    "timer.selectTask": "Select Task",
    "timer.start": "Start",
    "timer.stop": "Stop",
    "timer.noTasks": "No tasks available",
    "timer.commentTitle": "Enter Work Comment",
    "timer.nameRequired": "Name Required",
    "timer.nameRequiredDesc": "Please set your name in Settings to start the timer.",
    "timer.close": "Close",

    // Login page
    "login.title": "DayLog",
    "login.subtitle": "Sign in with Google",
    "login.googleButton": "Sign in with Google",
    "login.googleLoading": "Signing in...",
    "login.googleFailed": "Google sign in failed",
    "login.approvalRequired": "Admin approval is required for first-time login",

    // Signup page
    "signup.subtitle": "Sign up with Google",
    "signup.googleButton": "Sign up with Google",
    "signup.googleFailed": "Google sign up failed",
    "signup.approvalRequired": "Admin approval is required for first-time registration",
    "signup.termsAgreement": "By signing up with Google, you agree to our Terms of Service and Privacy Policy",

    // Pending approval page
    "pending.title": "Pending Approval",
    "pending.description": "Your account has been created successfully, but requires admin approval",
    "pending.email": "Registered Email",
    "pending.nextSteps": "Next Steps",
    "pending.step1": "Please notify the administrator that you have registered",
    "pending.step2": "Once approved by admin, please log in again",
    "pending.checkStatus": "Check Approval Status",
    "pending.contactAdmin": "If you have any issues, please contact the administrator",

    // Admin page
    "admin.title": "Admin Dashboard",
    "admin.subtitle": "Manage Users",
    "admin.backToHome": "Back to Home",
    "admin.pendingUsers": "Pending Users",
    "admin.approvedUsers": "Approved Users",
    "admin.noPendingUsers": "No pending users",
    "admin.noApprovedUsers": "No approved users",
    "admin.pending": "Pending",
    "admin.approved": "Approved",
    "admin.approveAsUser": "Approve as User",
    "admin.approveAsAdmin": "Approve as Admin",
    "admin.approving": "Approving...",
    "admin.reject": "Reject",
    "admin.rejecting": "Rejecting...",
    "admin.revokeApproval": "Revoke Approval",
    "admin.revoking": "Revoking...",
    "admin.deleteUser": "Delete User",
    "admin.deleting": "Deleting...",
    "admin.registeredAt": "Registered",
    "admin.confirmDelete": "Are you sure you want to delete this user? This action cannot be undone.",
    "admin.confirmReject": "Are you sure you want to reject this user?",
    "admin.fetchUsersFailed": "Failed to fetch users",
    "admin.approveFailed": "Failed to approve user",
    "admin.revokeFailed": "Failed to revoke approval",
    "admin.deleteFailed": "Failed to delete user",
    "admin.rejectFailed": "Failed to reject user",

    // Admin teams page
    "adminTeams.title": "Team Management",
    "adminTeams.subtitle": "Manage Linear Issues and Members by Team",
    "adminTeams.teamSelection": "Team Selection",
    "adminTeams.selected": "selected",
    "adminTeams.open": "Open",
    "adminTeams.close": "Close",
    "adminTeams.selectAll": "Select All",
    "adminTeams.clearSelection": "Clear Selection",
    "adminTeams.noTeams": "No teams available. Teams are synced from Linear via webhook.",
    "adminTeams.noSelectedTeams": "No teams selected. Please select teams from the filter above.",
    "adminTeams.members": "members",
    "adminTeams.issues": "issues",
    "adminTeams.noMembersWithIssues": "No members with assigned issues in this team",
    "adminTeams.issueId": "Issue ID",
    "adminTeams.issueTitle": "Title",
    "adminTeams.priority": "Priority",
    "adminTeams.status": "Status",
    "adminTeams.fetchFailed": "Failed to fetch teams",

    // Priority labels
    "priority.none": "None",
    "priority.urgent": "Urgent",
    "priority.high": "High",
    "priority.medium": "Medium",
    "priority.low": "Low",
    "priority.notSet": "Not Set",

    // Status labels
    "status.backlog": "Backlog",
    "status.unstarted": "Unstarted",
    "status.started": "In Progress",
    "status.completed": "Completed",
    "status.canceled": "Canceled",

    // Task management
    "taskMgmt.totalTime": "Total Time for All Tasks",
    "taskMgmt.taskList": "Task List",
    "taskMgmt.taskListDesc": "Tasks are automatically added when issues are created in Linear",
    "taskMgmt.createGlobalTask": "Create Global Task",
    "taskMgmt.noTasks": "No tasks",
    "taskMgmt.noTeam": "No Team",
    "taskMgmt.tasks": "tasks",
    "taskMgmt.openInLinear": "Open in Linear",
    "taskMgmt.managedByLinear": "Managed by Linear",
    "taskMgmt.editTask": "Edit Task",
    "taskMgmt.linearManaged": "This task is managed by Linear. Please edit it in Linear.",
    "taskMgmt.linearManagedDelete": "This task is managed by Linear. Please delete it in Linear.",
    "taskMgmt.syncing": "Syncing with Linear...",
    "taskMgmt.syncingDesc": "Adding new issues to database.",
    "taskMgmt.syncComplete": "Sync Complete",
    "taskMgmt.syncFailed": "Linear sync failed",
    "taskMgmt.createGlobalTaskTitle": "Create Global Task",
    "taskMgmt.createGlobalTaskDesc": "Create a task that all users can use",
    "taskMgmt.taskName": "Task Name",
    "taskMgmt.taskNamePlaceholder": "e.g., Study, Meeting, Break",
    "taskMgmt.labelName": "Label (Group Name)",
    "taskMgmt.labelPlaceholder": "e.g., Other, Common, Daily",
    "taskMgmt.labelDesc": "Tasks will be grouped by this label (⌘/Ctrl + Enter to create)",
    "taskMgmt.creating": "Creating...",
    "taskMgmt.create": "Create",
    "taskMgmt.enterTaskName": "Please enter a task name",
    "taskMgmt.enterLabel": "Please enter a label name",
    "taskMgmt.createFailed": "Failed to create global task",
    "taskMgmt.workStats": "Work Time Statistics",
    "taskMgmt.thisMonth": "This Month",
    "taskMgmt.lastMonth": "Last Month",
    "taskMgmt.thisWeek": "This Week",
    "taskMgmt.lastWeek": "Last Week",
    "taskMgmt.today": "Today",
    "taskMgmt.yesterday": "Yesterday",
    "taskMgmt.other": "Other",

    // User team viewer
    "userTeam.userSelection": "User Selection",
    "userTeam.select": "Select",
    "userTeam.peopleSelected": "selected",
    "userTeam.clear": "Clear",
    "userTeam.selectUsersDesc": "Select users to display (shows all if none selected)",
    "userTeam.selectAllUsers": "Select All",
    "userTeam.noSelectedUsers": "No selected users found",
    "userTeam.noUsers": "No users found",
    "userTeam.working": "Working",
    "userTeam.noActiveTask": "No active task",
    "userTeam.notInTeam": "Not a member of any team",
    "userTeam.noIssues": "No issues",
    "userTeam.fetchFailed": "Failed to fetch user team data",

    // User team viewer (userTeamViewer. keys)
    "userTeamViewer.userSelection": "User Selection",
    "userTeamViewer.select": "Select",
    "userTeamViewer.usersSelected": "{{count}} selected",
    "userTeamViewer.clear": "Clear",
    "userTeamViewer.selectHint": "Select users to display (shows all if none selected)",
    "userTeamViewer.noSelectedUsers": "No selected users found",
    "userTeamViewer.noUsers": "No users found",
    "userTeamViewer.working": "Working",
    "userTeamViewer.noCurrentTask": "No active task",
    "userTeamViewer.noTeam": "Not a member of any team",
    "userTeamViewer.noIssues": "No issues",
    "userTeamViewer.fetchFailed": "Failed to fetch user team data",

    // Unassigned tasks
    "unassigned.title": "Unassigned Tasks",
    "unassigned.titleCount": "Unassigned Tasks ({{count}})",
    "unassigned.count": "",
    "unassigned.noUnassigned": "No unassigned tasks at the moment.",
    "unassigned.description": "List of tasks that are not assigned to anyone. Assign them to members as needed.",
    "unassigned.assign": "Assign",
    "unassigned.openInLinear": "Open in Linear →",
    "unassigned.notSet": "Not Set",
    "unassigned.unknown": "Unknown",
    "unassigned.backlog": "Backlog",
    "unassigned.unstarted": "Unstarted",
    "unassigned.inProgress": "In Progress",
    "unassigned.completed": "Completed",
    "unassigned.canceled": "Canceled",
    "unassigned.other": "Other",

    // Common
    "common.team": "Team",
    "common.issue": "Issue",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.close": "Close",
    "common.open": "Open",
    "common.selectAll": "Select All",
    "common.deselectAll": "Deselect All",

    // Navigation
    "nav.backToHome": "Back to Home",

    // Teams page
    "teams.title": "Team Management",
    "teams.subtitle": "Manage Linear Issues and Members by Team",
    "teams.selectTeam": "Team Selection",
    "teams.selectedCount": "{{count}} selected",
    "teams.noTeams": "No teams available. Teams are synced from Linear via webhook.",
    "teams.noTeamsSelected": "No teams selected. Please select teams from the filter above.",
    "teams.memberCount": "{{count}} members",
    "teams.issueCount": "{{count}} issues",
    "teams.noMembersWithIssues": "No members with assigned issues in this team",
    "teams.issueId": "Issue ID",
    "teams.issueTitle": "Title",
    "teams.issuePriority": "Priority",
    "teams.issueStatus": "Status",
    "teams.fetchFailed": "Failed to fetch teams",

    // Admin status
    "admin.statusPending": "Pending",
    "admin.statusApproved": "Approved",
    "admin.roleAdmin": "Admin",
    "admin.roleUser": "User",

    // Timezones
    "timezone.Asia/Tokyo": "Japan Time (JST)",
    "timezone.America/New_York": "US Eastern Time (EST/EDT)",
    "timezone.America/Los_Angeles": "US Pacific Time (PST/PDT)",
    "timezone.Europe/London": "UK Time (GMT/BST)",
    "timezone.Asia/Shanghai": "China Standard Time (CST)",
    "timezone.Asia/Kolkata": "India Standard Time (IST)",
    "timezone.Europe/Paris": "Central European Time (CET/CEST)",
    "timezone.Australia/Sydney": "Australia Eastern Time (AEST/AEDT)",
    "timezone.Pacific/Auckland": "New Zealand Time (NZST/NZDT)",
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ja")

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language | null
    if (savedLanguage && (savedLanguage === "ja" || savedLanguage === "en")) {
      setLanguageState(savedLanguage)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("language", lang)
    window.dispatchEvent(new Event("languageChanged"))
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    let text = translations[language][key] || key
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value))
      })
    }
    return text
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
