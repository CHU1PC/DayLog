'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2, AlertCircle, CheckCircle, Clock,
  ArrowLeft, Trash2, XCircle
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface User {
  user_id: string
  email: string
  name?: string
  role: string
  approved?: boolean
  created_at: string
}

export default function AdminPage() {
  const { user, loading: authLoading, isAdmin } = useAuth()
  const { t, language } = useLanguage()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null)
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login')
      } else if (!isAdmin) {
        router.push('/')
      } else {
        fetchUsers()
      }
    }
  }, [user, authLoading, isAdmin, router])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        throw new Error(t("admin.fetchUsersFailed"))
      }
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unknown"))
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: string, role: 'user' | 'admin' = 'user') => {
    setApprovingUserId(userId)
    setError(null)

    try {
      console.log('Approving user:', userId, 'as', role)
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      })

      const data = await res.json()
      console.log('Approval response:', { status: res.status, data })

      if (!res.ok) {
        throw new Error(data.details || data.error || t("admin.approveFailed"))
      }

      await fetchUsers()
    } catch (err) {
      console.error('Approval error:', err)
      setError(err instanceof Error ? err.message : t("admin.approveFailed"))
    } finally {
      setApprovingUserId(null)
    }
  }

  const handleRevoke = async (userId: string) => {
    setRevokingUserId(userId)
    setError(null)

    try {
      console.log('Revoking user approval:', userId)
      const res = await fetch(`/api/admin/users/${userId}/revoke`, {
        method: 'POST',
      })

      const data = await res.json()
      console.log('Revoke response:', { status: res.status, data })

      if (!res.ok) {
        throw new Error(data.details || data.error || t("admin.revokeFailed"))
      }

      await fetchUsers()
    } catch (err) {
      console.error('Revoke error:', err)
      setError(err instanceof Error ? err.message : t("admin.revokeFailed"))
    } finally {
      setRevokingUserId(null)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm(t("admin.confirmDelete"))) {
      return
    }

    setDeletingUserId(userId)
    setError(null)

    try {
      console.log('Deleting user:', userId)
      const res = await fetch(`/api/admin/users/${userId}/delete`, {
        method: 'DELETE',
      })

      const data = await res.json()
      console.log('Delete response:', { status: res.status, data })

      if (!res.ok) {
        throw new Error(data.details || data.error || t("admin.deleteFailed"))
      }

      await fetchUsers()
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : t("admin.deleteFailed"))
    } finally {
      setDeletingUserId(null)
    }
  }

  const handleReject = async (userId: string) => {
    if (!confirm(t("admin.confirmReject"))) {
      return
    }

    setRejectingUserId(userId)
    setError(null)

    try {
      console.log('Rejecting user:', userId)
      const res = await fetch(`/api/admin/users/${userId}/delete`, {
        method: 'DELETE',
      })

      const data = await res.json()
      console.log('Reject response:', { status: res.status, data })

      if (!res.ok) {
        throw new Error(data.details || data.error || t("admin.rejectFailed"))
      }

      await fetchUsers()
    } catch (err) {
      console.error('Reject error:', err)
      setError(err instanceof Error ? err.message : t("admin.rejectFailed"))
    } finally {
      setRejectingUserId(null)
    }
  }

  const getUserId = (user: User) => user.user_id || (user as any).id
  const getUserName = (user: User) => user.name || user.email

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">{t("loading.data")}</div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  const pendingUsers = users.filter((u) => !u.approved)
  const approvedUsers = users.filter((u) => u.approved)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t("admin.title")}</h1>
            <p className="text-muted-foreground">{t("admin.subtitle")}</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("admin.backToHome")}
          </Button>
        </div>

        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* タブ */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              {t("admin.pendingUsers")} ({pendingUsers.length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              {t("admin.approvedUsers")} ({approvedUsers.length})
            </TabsTrigger>
          </TabsList>

          {/* 承認待ちユーザー */}
          <TabsContent value="pending" className="space-y-4">
            {pendingUsers.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t("admin.noPendingUsers")}
                </CardContent>
              </Card>
            ) : (
              pendingUsers.map((user) => (
                <Card key={getUserId(user)}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {getUserName(user)}
                        </CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        <Clock className="w-3 h-3 mr-1" />
                        {t("admin.statusPending")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          onClick={() => handleApprove(getUserId(user), 'user')}
                          disabled={approvingUserId === getUserId(user) || rejectingUserId === getUserId(user)}
                          variant="default"
                        >
                          {approvingUserId === getUserId(user) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t("admin.approving")}
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              {t("admin.approveAsUser")}
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleApprove(getUserId(user), 'admin')}
                          disabled={approvingUserId === getUserId(user) || rejectingUserId === getUserId(user)}
                          variant="outline"
                        >
                          {approvingUserId === getUserId(user) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t("admin.approving")}
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              {t("admin.approveAsAdmin")}
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleReject(getUserId(user))}
                          disabled={rejectingUserId === getUserId(user) || approvingUserId === getUserId(user)}
                          variant="destructive"
                        >
                          {rejectingUserId === getUserId(user) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t("admin.rejecting")}
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-2" />
                              {t("admin.reject")}
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("admin.registeredAt")}: {new Date(user.created_at).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* 承認済みユーザー */}
          <TabsContent value="approved" className="space-y-4">
            {approvedUsers.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t("admin.noApprovedUsers")}
                </CardContent>
              </Card>
            ) : (
              approvedUsers.map((user) => (
                <Card key={getUserId(user)}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {getUserName(user)}
                        </CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={user.role === 'admin' ? 'default' : 'secondary'}
                        >
                          {user.role === 'admin' ? t("admin.roleAdmin") : t("admin.roleUser")}
                        </Badge>
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {t("admin.statusApproved")}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        {t("admin.registeredAt")}: {new Date(user.created_at).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US')}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevoke(getUserId(user))}
                          disabled={revokingUserId === getUserId(user) || deletingUserId === getUserId(user)}
                        >
                          {revokingUserId === getUserId(user) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t("admin.revoking")}
                            </>
                          ) : (
                            <>
                              {t("admin.revokeApproval")}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(getUserId(user))}
                          disabled={deletingUserId === getUserId(user) || revokingUserId === getUserId(user)}
                        >
                          {deletingUserId === getUserId(user) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t("admin.deleting")}
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t("admin.deleteUser")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
