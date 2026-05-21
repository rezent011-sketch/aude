import { IntegrationError } from './errors';
import { fetchJson } from './http';

const MICROSOFT_GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

type TeamsResponse = {
  value?: Array<{
    id?: string;
    displayName?: string;
    description?: string;
  }>;
};

type ChannelsResponse = {
  value?: Array<{
    id?: string;
    displayName?: string;
    membershipType?: string;
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Microsoft Teamsのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function getHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${normalizeToken(token)}`,
    'Content-Type': 'application/json',
  };
}

export async function getTeams(
  token: string
): Promise<Array<{ id: string; displayName: string; description: string }>> {
  const response = await fetchJson<TeamsResponse>(
    `${MICROSOFT_GRAPH_BASE_URL}/me/joinedTeams`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Microsoft Teamsのチーム一覧取得に失敗しました。'
  );

  return (response.value ?? []).map((team) => ({
    id: typeof team.id === 'string' ? team.id : '',
    displayName:
      typeof team.displayName === 'string' && team.displayName.trim()
        ? team.displayName
        : '(No name)',
    description: typeof team.description === 'string' ? team.description : '',
  }));
}

export async function getChannels(
  token: string,
  teamId: string
): Promise<Array<{ id: string; displayName: string; membershipType: string }>> {
  const normalizedTeamId = teamId.trim();

  if (!normalizedTeamId) {
    throw new IntegrationError('Microsoft Teamsのteam_idを指定してください。');
  }

  const response = await fetchJson<ChannelsResponse>(
    `${MICROSOFT_GRAPH_BASE_URL}/teams/${encodeURIComponent(normalizedTeamId)}/channels`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Microsoft Teamsのチャンネル一覧取得に失敗しました。'
  );

  return (response.value ?? []).map((channel) => ({
    id: typeof channel.id === 'string' ? channel.id : '',
    displayName:
      typeof channel.displayName === 'string' && channel.displayName.trim()
        ? channel.displayName
        : '(No name)',
    membershipType:
      typeof channel.membershipType === 'string' ? channel.membershipType : 'unknown',
  }));
}

export async function sendMessage(
  token: string,
  teamId: string,
  channelId: string,
  content: string
): Promise<void> {
  const normalizedTeamId = teamId.trim();
  const normalizedChannelId = channelId.trim();
  const normalizedContent = content.trim();

  if (!normalizedTeamId) {
    throw new IntegrationError('Microsoft Teamsのteam_idを指定してください。');
  }

  if (!normalizedChannelId) {
    throw new IntegrationError('Microsoft Teamsのchannel_idを指定してください。');
  }

  if (!normalizedContent) {
    throw new IntegrationError('Microsoft Teamsに送信するmessageを指定してください。');
  }

  await fetchJson(
    `${MICROSOFT_GRAPH_BASE_URL}/teams/${encodeURIComponent(normalizedTeamId)}/channels/${encodeURIComponent(normalizedChannelId)}/messages`,
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        body: {
          contentType: 'text',
          content: normalizedContent,
        },
      }),
    },
    'Microsoft Teamsへのメッセージ送信に失敗しました。'
  );
}
