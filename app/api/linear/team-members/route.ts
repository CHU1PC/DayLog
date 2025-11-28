import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Linear APIからチームメンバーシップを取得するテストエンドポイント
 * GET /api/linear/team-members?teamId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // ユーザー認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Linear API Key を取得
    const linearApiKey = process.env.LINEAR_API_KEY
    if (!linearApiKey) {
      return NextResponse.json({ error: 'LINEAR_API_KEY not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    // teamIdが指定されている場合は特定チームのメンバーを取得
    // 指定されていない場合は全チームとそのメンバーを取得
    const query = teamId
      ? `
        query TeamMembers($teamId: String!) {
          team(id: $teamId) {
            id
            name
            key
            members {
              nodes {
                id
                email
                name
                displayName
                active
              }
            }
          }
        }
      `
      : `
        query AllTeamsWithMembers {
          teams(first: 50) {
            nodes {
              id
              name
              key
              members {
                nodes {
                  id
                  email
                  name
                  displayName
                  active
                }
              }
            }
          }
        }
      `

    const variables = teamId ? { teamId } : {}

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: linearApiKey,
      },
      body: JSON.stringify({ query, variables }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Linear API error response:', result)
      return NextResponse.json({
        error: 'Linear API error',
        details: result,
      }, { status: response.status })
    }

    if (result.errors) {
      return NextResponse.json({
        error: 'Linear GraphQL error',
        details: result.errors,
      }, { status: 400 })
    }

    // 結果を整形
    if (teamId) {
      const team = result.data?.team
      return NextResponse.json({
        team: {
          id: team?.id,
          name: team?.name,
          key: team?.key,
        },
        members: team?.members?.nodes || [],
        memberCount: team?.members?.nodes?.length || 0,
      })
    } else {
      const teams = result.data?.teams?.nodes || []
      return NextResponse.json({
        teams: teams.map((team: any) => ({
          id: team.id,
          name: team.name,
          key: team.key,
          members: team.members?.nodes || [],
          memberCount: team.members?.nodes?.length || 0,
        })),
        totalTeams: teams.length,
      })
    }

  } catch (error) {
    console.error('Error fetching team members:', error)
    return NextResponse.json({
      error: 'Failed to fetch team members',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
