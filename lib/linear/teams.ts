/**
 * Linear API - Team Operations
 */

import { LinearTeam } from './types'

export interface LinearTeamMember {
  id: string
  email: string
  name: string
  displayName?: string
  active: boolean
}

/**
 * Linear APIから特定チームのメンバー一覧を取得
 */
export async function getLinearTeamMembers(apiKey: string, linearTeamId: string): Promise<LinearTeamMember[]> {
  const query = `
    query TeamMembers($teamId: String!) {
      team(id: $teamId) {
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

  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({ query, variables: { teamId: linearTeamId } }),
    })

    const result: any = await response.json()

    if (!response.ok) {
      console.error('Linear API error response:', result)
      throw new Error(`Linear API error: ${response.status} ${response.statusText}`)
    }

    if (result.errors) {
      throw new Error(`Linear GraphQL error: ${result.errors[0].message}`)
    }

    return result.data?.team?.members?.nodes || []
  } catch (error) {
    console.error('Error fetching Linear team members:', error)
    throw error
  }
}

/**
 * ユーザーが特定のLinearチームのメンバーかどうかを確認
 */
export async function isUserLinearTeamMember(apiKey: string, linearTeamId: string, userEmail: string): Promise<boolean> {
  try {
    const userTeams = await getUserLinearTeams(apiKey, userEmail)
    return userTeams.some(team => team.id === linearTeamId)
  } catch (error) {
    console.error('Error checking team membership:', error)
    return false
  }
}

export interface UserLinearTeam {
  id: string
  name: string
  key: string
}

/**
 * ユーザーのemailから所属しているLinearチーム一覧を取得
 */
export async function getUserLinearTeams(apiKey: string, userEmail: string): Promise<UserLinearTeam[]> {
  const query = `
    query UserTeams($email: String!) {
      users(filter: { email: { eq: $email } }) {
        nodes {
          id
          email
          teamMemberships {
            nodes {
              team {
                id
                name
                key
              }
            }
          }
        }
      }
    }
  `

  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({ query, variables: { email: userEmail } }),
    })

    const result: any = await response.json()

    if (!response.ok) {
      console.error('Linear API error response:', result)
      throw new Error(`Linear API error: ${response.status} ${response.statusText}`)
    }

    if (result.errors) {
      throw new Error(`Linear GraphQL error: ${result.errors[0].message}`)
    }

    const user = result.data?.users?.nodes?.[0]
    if (!user) {
      return []
    }

    return (user.teamMemberships?.nodes || []).map((membership: any) => ({
      id: membership.team.id,
      name: membership.team.name,
      key: membership.team.key,
    }))
  } catch (error) {
    console.error('Error fetching user Linear teams:', error)
    throw error
  }
}

/**
 * すべてのLinear Teamを取得
 */
export async function getAllLinearTeams(apiKey: string): Promise<LinearTeam[]> {
  const query = `
    query {
      teams(first: 100) {
        nodes {
          id
          name
          key
          description
          createdAt
          updatedAt
        }
      }
    }
  `

  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({ query }),
    })

    const result: any = await response.json()

    if (!response.ok) {
      console.error('Linear API error response:', result)
      throw new Error(`Linear API error: ${response.status} ${response.statusText} - ${JSON.stringify(result)}`)
    }

    if (result.errors) {
      throw new Error(`Linear GraphQL error: ${result.errors[0].message}`)
    }

    if (!result.data?.teams) {
      throw new Error('No data returned from Linear API')
    }

    // URLを生成、icon/colorはnullで設定（Linear APIはこれらのフィールドをTeamに持たない）
    return result.data.teams.nodes.map((team: any) => ({
      ...team,
      icon: null,
      color: null,
      url: `https://linear.app/team/${team.key}`,
    }))
  } catch (error) {
    console.error('Error fetching Linear teams:', error)
    throw error
  }
}
