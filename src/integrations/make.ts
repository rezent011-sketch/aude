import { IntegrationError } from './errors';
import { fetchJson } from './http';

const MAKE_API_BASE_URL = 'https://eu1.make.com/api/v2';

type MakeScenariosResponse = {
  scenarios?: Array<{
    id?: number;
    name?: string;
    isActive?: boolean;
    lastEdit?: string;
  }>;
};

function normalizeWebhookUrl(webhookUrl: string): string {
  const trimmed = webhookUrl.trim();

  if (!trimmed) {
    throw new IntegrationError('Makeのwebhook_urlを指定してください。');
  }

  return trimmed;
}

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new IntegrationError('Make APIキーが設定されていません。');
  }

  return trimmed;
}

function normalizeTeamId(teamId: string): string {
  const trimmed = teamId.trim();

  if (!trimmed) {
    throw new IntegrationError('Makeのteam_idを指定してください。');
  }

  return trimmed;
}

export async function triggerScenario(
  webhookUrl: string,
  data: Record<string, unknown>
): Promise<{ accepted: boolean }> {
  let response: Response;

  try {
    response = await fetch(normalizeWebhookUrl(webhookUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        _source: 'aude_discord',
        _timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    throw new IntegrationError('Makeシナリオのトリガーに失敗しました。', { cause: error });
  }

  if (!response.ok) {
    throw new IntegrationError('Makeシナリオのトリガーに失敗しました。');
  }

  return { accepted: true };
}

export async function getScenarios(
  apiKey: string,
  teamId: string
): Promise<Array<{ id: number; name: string; isActive: boolean; lastEdit: string }>> {
  const response = await fetchJson<MakeScenariosResponse>(
    `${MAKE_API_BASE_URL}/scenarios?teamId=${encodeURIComponent(normalizeTeamId(teamId))}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Token ${normalizeApiKey(apiKey)}`,
        Accept: 'application/json',
      },
    },
    'Makeのシナリオ一覧取得に失敗しました。'
  );

  return (response.scenarios ?? []).map((scenario) => ({
    id: typeof scenario.id === 'number' ? scenario.id : 0,
    name: typeof scenario.name === 'string' && scenario.name.trim() ? scenario.name : '(No name)',
    isActive: scenario.isActive === true,
    lastEdit: typeof scenario.lastEdit === 'string' ? scenario.lastEdit : '',
  }));
}
