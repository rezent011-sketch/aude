import { IntegrationError } from './errors';
import { fetchJson } from './http';

type OpenAIModelsResponse = {
  data?: Array<{
    id?: string;
    owned_by?: string;
  }>;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

function getHeaders(token: string): Record<string, string> {
  const normalized = token.trim();

  if (!normalized) {
    throw new IntegrationError('OpenAI APIキーが設定されていません。');
  }

  return {
    Authorization: `Bearer ${normalized}`,
    'Content-Type': 'application/json',
  };
}

export async function listModels(
  token: string
): Promise<Array<{ id: string; owned_by: string }>> {
  const response = await fetchJson<OpenAIModelsResponse>(
    'https://api.openai.com/v1/models',
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'OpenAIのモデル一覧取得に失敗しました。'
  );

  return (response.data ?? [])
    .filter((model) => {
      const id = typeof model.id === 'string' ? model.id : '';
      return id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3');
    })
    .map((model) => ({
      id: typeof model.id === 'string' ? model.id : '',
      owned_by: typeof model.owned_by === 'string' ? model.owned_by : '',
    }));
}

export async function chat(
  token: string,
  model: string,
  prompt: string,
  maxTokens?: number
): Promise<{
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}> {
  const normalizedModel = model.trim();
  const normalizedPrompt = prompt.trim();

  if (!normalizedModel) {
    throw new IntegrationError('OpenAIのmodelを指定してください。');
  }

  if (!normalizedPrompt) {
    throw new IntegrationError('OpenAIに送信するpromptを指定してください。');
  }

  const response = await fetchJson<OpenAIChatResponse>(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        model: normalizedModel,
        messages: [{ role: 'user', content: normalizedPrompt }],
        max_tokens: typeof maxTokens === 'number' ? maxTokens : 512,
      }),
    },
    'OpenAIチャットの実行に失敗しました。'
  );

  return {
    content: typeof response.choices?.[0]?.message?.content === 'string'
      ? response.choices[0].message.content
      : '',
    usage: {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
    },
  };
}
