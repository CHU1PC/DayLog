import { google } from 'googleapis'

// 同一timeEntryIdの重複書き込みを防ぐためのロック機構
const pendingWrites = new Set<string>()

// 存在確認済みシート名のキャッシュ（毎回のメタデータ取得を回避）
const existingSheetNames = new Set<string>()

// サービスアカウントの認証情報を使用してGoogle Sheets APIクライアントを作成
export function getGoogleSheetsClient() {
  try {
    // 環境変数から認証情報を取得
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!credentials) {
      console.warn('GOOGLE_SERVICE_ACCOUNT_KEY is not set - Google Sheets integration disabled')
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set')
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentials),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    return google.sheets({ version: 'v4', auth })
  } catch (error) {
    console.error('Error creating Google Sheets client:', error)
    throw error
  }
}

// スプレッドシートIDを取得
export function getSpreadsheetId(): string {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SPREADSHEET_ID is not set')
  }
  return spreadsheetId
}

// 月のシート名を生成（例: "2025年1月"）
export function getMonthlySheetName(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return `${year}年${month}月`
}

// シートが存在するかチェックし、存在しない場合は作成
export async function ensureMonthlySheetExists(
  sheets: any,
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  // キャッシュに存在する場合はAPI呼び出しをスキップ
  if (existingSheetNames.has(sheetName)) {
    return
  }

  try {
    // スプレッドシートのメタデータを取得
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    })

    // 指定されたシート名が既に存在するかチェック
    const sheetExists = spreadsheet.data.sheets?.some(
      (sheet: any) => sheet.properties?.title === sheetName
    )

    if (sheetExists) {
      // 既存シートをキャッシュに追加
      existingSheetNames.add(sheetName)
      return
    }

    // シートが存在しない場合は作成
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    })

    // ヘッダー行を追加
    const headerValues = [
      [
        'エントリーID',
        '日付',
        'Team名',
        'Project名',
        'Issue名',
        'コメント',
        '稼働時間(時間)',
        'Assignee名',
        '開始時刻',
        '終了時刻',
      ],
    ]

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:J1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: headerValues,
      },
    })

    // 新規作成したシートをキャッシュに追加
    existingSheetNames.add(sheetName)
    console.log(`Created new sheet: ${sheetName}`)
  } catch (error) {
    console.error('Error ensuring sheet exists:', error)
    throw error
  }
}

// 時間エントリーをスプレッドシートに書き込む
export interface TimeEntryData {
  timeEntryId: string // 時間エントリーのID（編集・削除用）
  date: string // 日付
  teamName: string | null // Team名
  projectName: string | null // Project名
  issueName: string | null // Issue名
  comment: string // コメント
  workingHours: number // 稼働時間(時間単位)
  assigneeName: string | null // Assignee名
  startTime: string // 開始時刻
  endTime: string // 終了時刻
}

export interface WriteTimeEntryResult {
  success: boolean
  action: 'created' | 'already_exists'
}

export async function writeTimeEntryToSheet(
  data: TimeEntryData
): Promise<WriteTimeEntryResult> {
  // 同一IDの同時書き込みを防ぐためのロックチェック
  if (pendingWrites.has(data.timeEntryId)) {
    console.log(`[writeTimeEntryToSheet] Write already in progress for: ${data.timeEntryId}`)
    return { success: true, action: 'already_exists' }
  }

  // ロックを取得
  pendingWrites.add(data.timeEntryId)

  try {
    const sheets = getGoogleSheetsClient()
    const spreadsheetId = getSpreadsheetId()

    // 日付からシート名を生成
    const entryDate = new Date(data.date)
    const sheetName = getMonthlySheetName(entryDate)

    // シートが存在することを確認（なければ作成）
    await ensureMonthlySheetExists(sheets, spreadsheetId, sheetName)

    // 重複チェック: 同じtimeEntryIdが既に存在するか確認
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
    })

    const existingRows = existingResponse.data.values
    if (existingRows && existingRows.length > 1) {
      const existingEntryIndex = existingRows.findIndex(
        (row, index) => index > 0 && row[0] === data.timeEntryId
      )
      if (existingEntryIndex !== -1) {
        console.log(`[writeTimeEntryToSheet] Entry already exists, skipping: ${data.timeEntryId}`)
        return { success: true, action: 'already_exists' }
      }
    }

    // 書き込むデータを配列形式に変換
    const rowData = [
      [
        data.timeEntryId,
        data.date,
        data.teamName || '',
        data.projectName || '',
        data.issueName || '',
        data.comment,
        data.workingHours.toFixed(2), // 小数点2桁まで表示
        data.assigneeName || '',
        data.startTime,
        data.endTime,
      ],
    ]

    // シートに追加
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:J`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rowData,
      },
    })

    console.log(`[writeTimeEntryToSheet] Time entry written to sheet: ${sheetName}`)
    return { success: true, action: 'created' }
  } catch (error) {
    console.error('[writeTimeEntryToSheet] Error writing time entry to sheet:', error)
    throw error
  } finally {
    // 必ずロックを解放
    pendingWrites.delete(data.timeEntryId)
  }
}

export interface UpdateTimeEntryResult {
  success: boolean
  action: 'updated' | 'not_found'
}

// 時間エントリーをスプレッドシートで更新
export async function updateTimeEntryInSheet(
  data: TimeEntryData
): Promise<UpdateTimeEntryResult> {
  try {
    const sheets = getGoogleSheetsClient()
    const spreadsheetId = getSpreadsheetId()

    // 日付からシート名を生成
    const entryDate = new Date(data.date)
    const sheetName = getMonthlySheetName(entryDate)

    // シートが存在することを確認
    await ensureMonthlySheetExists(sheets, spreadsheetId, sheetName)

    // シート内の全データを取得してエントリーIDで検索
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:J`,
    })

    const rows = response.data.values
    if (!rows || rows.length <= 1) {
      console.log(`[updateTimeEntryInSheet] No data rows in sheet: ${sheetName}`)
      return { success: true, action: 'not_found' }
    }

    // エントリーIDが一致する行を見つける（ヘッダー行をスキップ）
    const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === data.timeEntryId)

    if (rowIndex === -1) {
      // 見つからない場合は明確にnot_foundを返す（appendはしない）
      console.log(`[updateTimeEntryInSheet] Entry ID not found in sheet: ${data.timeEntryId}`)
      return { success: true, action: 'not_found' }
    }

    const rowData = [
      [
        data.timeEntryId,
        data.date,
        data.teamName || '',
        data.projectName || '',
        data.issueName || '',
        data.comment,
        data.workingHours.toFixed(2),
        data.assigneeName || '',
        data.startTime,
        data.endTime,
      ],
    ]

    // 該当行を更新（行番号は1-indexed）
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowIndex + 1}:J${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rowData,
      },
    })

    console.log(`[updateTimeEntryInSheet] Time entry updated in sheet: ${sheetName}, row: ${rowIndex + 1}`)
    return { success: true, action: 'updated' }
  } catch (error) {
    console.error('[updateTimeEntryInSheet] Error updating time entry in sheet:', error)
    throw error
  }
}

// 時間エントリーをスプレッドシートから削除
export async function deleteTimeEntryFromSheet(
  timeEntryId: string,
  date: string
): Promise<void> {
  try {
    console.log('[deleteTimeEntryFromSheet] Starting deletion:', { timeEntryId, date })

    const sheets = getGoogleSheetsClient()
    const spreadsheetId = getSpreadsheetId()

    // 日付からシート名を生成
    const entryDate = new Date(date)
    const sheetName = getMonthlySheetName(entryDate)
    console.log('[deleteTimeEntryFromSheet] Sheet name:', sheetName)

    // シートデータとメタデータを並列取得
    console.log('[deleteTimeEntryFromSheet] Fetching sheet data and metadata in parallel...')
    const [valuesResponse, spreadsheetResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:J`,
      }),
      sheets.spreadsheets.get({
        spreadsheetId,
      })
    ])

    const rows = valuesResponse.data.values
    console.log('[deleteTimeEntryFromSheet] Rows found:', rows?.length || 0)

    if (!rows || rows.length <= 1) {
      console.warn(`[deleteTimeEntryFromSheet] No data rows in sheet: ${sheetName}`)
      throw new Error(`Time entry not found in sheet: ${sheetName}`)
    }

    // エントリーIDが一致する行を見つける（デバッグ情報を追加）
    console.log('[deleteTimeEntryFromSheet] Searching for entry ID:', timeEntryId)
    console.log('[deleteTimeEntryFromSheet] First 3 row IDs:', rows.slice(0, 3).map(r => r[0]))

    const rowIndex = rows.findIndex((row, index) => {
      if (index === 0) return false // ヘッダー行をスキップ
      const matches = row[0] === timeEntryId
      if (matches) {
        console.log('[deleteTimeEntryFromSheet] Found matching row at index:', index, 'value:', row[0])
      }
      return matches
    })

    console.log('[deleteTimeEntryFromSheet] Row index found:', rowIndex)

    if (rowIndex === -1) {
      console.warn('[deleteTimeEntryFromSheet] Entry ID not found in sheet. This entry may have been created before the ID column was added.')
      console.warn('[deleteTimeEntryFromSheet] Skipping spreadsheet deletion for entry:', timeEntryId)
      // エントリーIDが見つからない場合はスキップ（古いエントリーの可能性）
      return
    }

    // シートIDを取得（既に並列で取得済み）
    const sheet = spreadsheetResponse.data.sheets?.find(
      (s: any) => s.properties?.title === sheetName
    )

    if (!sheet || !sheet.properties?.sheetId) {
      console.error('[deleteTimeEntryFromSheet] Sheet not found:', sheetName)
      throw new Error(`Sheet ${sheetName} not found`)
    }

    console.log('[deleteTimeEntryFromSheet] Sheet ID:', sheet.properties.sheetId)
    console.log('[deleteTimeEntryFromSheet] Deleting row:', rowIndex, '(1-indexed:', rowIndex + 1, ')')

    // 削除直前に再確認（競合防止）
    // 他のユーザーが先に行を削除した場合、インデックスがずれている可能性がある
    const verifyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A${rowIndex + 1}`,
    })
    const currentCellValue = verifyResponse.data.values?.[0]?.[0]

    if (currentCellValue !== timeEntryId) {
      console.warn('[deleteTimeEntryFromSheet] Row index shifted, re-searching for entry:', timeEntryId)
      // 行がずれている場合は再検索
      const refreshResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:A`,
      })
      const refreshedRows = refreshResponse.data.values
      const newRowIndex = refreshedRows?.findIndex((row, index) => index > 0 && row[0] === timeEntryId) ?? -1

      if (newRowIndex === -1) {
        console.log('[deleteTimeEntryFromSheet] Entry already deleted by another process')
        return
      }

      console.log('[deleteTimeEntryFromSheet] Found entry at new index:', newRowIndex)

      // 新しいインデックスで削除
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: newRowIndex,
                endIndex: newRowIndex + 1,
              },
            },
          }],
        },
      })

      console.log(`[deleteTimeEntryFromSheet] ✓ Time entry deleted from sheet (after re-search): ${sheetName}, row: ${newRowIndex + 1}`)
      return
    }

    // 行を削除（batchUpdateを使用）
    const deleteRequest = {
      deleteDimension: {
        range: {
          sheetId: sheet.properties.sheetId,
          dimension: 'ROWS',
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    }

    console.log('[deleteTimeEntryFromSheet] Delete request:', JSON.stringify(deleteRequest, null, 2))

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [deleteRequest],
      },
    })

    console.log(`[deleteTimeEntryFromSheet] ✓ Time entry deleted from sheet: ${sheetName}, row: ${rowIndex + 1}`)
  } catch (error) {
    console.error('[deleteTimeEntryFromSheet] Error deleting time entry from sheet:', error)
    if (error instanceof Error) {
      console.error('[deleteTimeEntryFromSheet] Error message:', error.message)
      console.error('[deleteTimeEntryFromSheet] Error stack:', error.stack)
    }
    throw error
  }
}
