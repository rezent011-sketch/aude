import { IntegrationError, requireEnvVar } from './errors';
import { fetchJson } from './http';

type GoogleTokenResponse = {
  access_token: string;
};

type SheetsValuesResponse = {
  range?: string;
  values?: string[][];
};

type SheetsCreateResponse = {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties?: {
    title?: string;
  };
  sheets?: Array<{
    properties?: {
      title?: string;
    };
  }>;
};

export type SheetReadResult = {
  range: string;
  values: string[][];
};

export type SheetWriteResult = {
  spreadsheetId: string;
  range: string;
  updatedRows: number;
  updatedColumns: number;
  updatedCells: number;
};

export type SheetCreateResult = {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheetTitle: string;
};

function parseRows(input: string): string[][] {
  const normalized = input.replace(/\r\n/g, '\n').trim();

  if (!normalized) {
    throw new IntegrationError('書き込むデータを入力してください。複数列はタブ区切り、複数行は改行区切りです。');
  }

  return normalized.split('\n').map((row) => row.split('\t').map((cell) => cell.trim()));
}

async function getAccessToken(): Promise<string> {
  const clientId = requireEnvVar('GOOGLE_CLIENT_ID', 'Google Sheets');
  const clientSecret = requireEnvVar('GOOGLE_CLIENT_SECRET', 'Google Sheets');
  const refreshToken = requireEnvVar('GOOGLE_REFRESH_TOKEN', 'Google Sheets');

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetchJson<GoogleTokenResponse>(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
    'Google Sheetsのアクセストークン取得に失敗しました。OAuth設定とリフレッシュトークンを確認してください。'
  );

  return response.access_token;
}

async function getHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export async function readSheet(spreadsheetId: string, range: string): Promise<SheetReadResult> {
  const trimmedSpreadsheetId = spreadsheetId.trim();
  const trimmedRange = range.trim();

  if (!trimmedSpreadsheetId) {
    throw new IntegrationError('spreadsheet id を入力してください。');
  }

  if (!trimmedRange) {
    throw new IntegrationError('読み取る range を入力してください。例: `Sheet1!A1:C10`');
  }

  const response = await fetchJson<SheetsValuesResponse>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(trimmedSpreadsheetId)}/values/${encodeURIComponent(trimmedRange)}`,
    {
      method: 'GET',
      headers: await getHeaders(),
    },
    'Google Sheetsの読み取りに失敗しました。スプレッドシート権限と range を確認してください。'
  );

  return {
    range: response.range ?? trimmedRange,
    values: response.values ?? [],
  };
}

export async function writeSheet(
  spreadsheetId: string,
  range: string,
  valuesInput: string
): Promise<SheetWriteResult> {
  const trimmedSpreadsheetId = spreadsheetId.trim();
  const trimmedRange = range.trim();
  const values = parseRows(valuesInput);
  const params = new URLSearchParams({
    valueInputOption: 'USER_ENTERED',
  });

  if (!trimmedSpreadsheetId) {
    throw new IntegrationError('spreadsheet id を入力してください。');
  }

  if (!trimmedRange) {
    throw new IntegrationError('書き込む range を入力してください。例: `Sheet1!A1`');
  }

  const response = await fetchJson<{
    spreadsheetId: string;
    updatedRange: string;
    updatedRows?: number;
    updatedColumns?: number;
    updatedCells?: number;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(trimmedSpreadsheetId)}/values/${encodeURIComponent(trimmedRange)}?${params.toString()}`,
    {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values,
      }),
    },
    'Google Sheetsへの書き込みに失敗しました。スプレッドシート権限と入力内容を確認してください。'
  );

  return {
    spreadsheetId: response.spreadsheetId,
    range: response.updatedRange,
    updatedRows: response.updatedRows ?? 0,
    updatedColumns: response.updatedColumns ?? 0,
    updatedCells: response.updatedCells ?? 0,
  };
}

export async function createSheet(title: string, sheetTitle?: string): Promise<SheetCreateResult> {
  const trimmedTitle = title.trim();
  const trimmedSheetTitle = sheetTitle?.trim() || 'Sheet1';

  if (!trimmedTitle) {
    throw new IntegrationError('スプレッドシート名を入力してください。');
  }

  const response = await fetchJson<SheetsCreateResponse>(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        properties: {
          title: trimmedTitle,
        },
        sheets: [
          {
            properties: {
              title: trimmedSheetTitle,
            },
          },
        ],
      }),
    },
    'Google Sheetsの作成に失敗しました。Sheets API の有効化と権限を確認してください。'
  );

  return {
    spreadsheetId: response.spreadsheetId,
    spreadsheetUrl: response.spreadsheetUrl,
    title: response.properties?.title ?? trimmedTitle,
    sheetTitle: response.sheets?.[0]?.properties?.title ?? trimmedSheetTitle,
  };
}
