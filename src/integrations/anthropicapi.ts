import { IntegrationError } from './errors';
import { fetchJson } from './http';

type AnthropicResponse = {
  content?: Array<{
    text?: string;
  }>;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

function getHeaders(apiKey: string): Record<string, string> {
  const normalized = apiKey.trim();

  if (!normalized) {
    throw new IntegrationError('Anthropic APIキーが設定されていません。');
  }

  return {
    'x-api-key': normalized,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  };
}

export async function ask(
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens?: number
): Promise<{ content: string; model: string; input_tokens: number; output_tokens: number }> {
  const normalizedModel = model.trim() || 'claude-opus-4-5';
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new IntegrationError('Anthropicに送信するpromptを指定してください。');
  }

  const response = await fetchJson<AnthropicResponse>(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        model: normalizedModel,
        max_tokens: typeof maxTokens === 'number' ? maxTokens : 1024,
        messages: [{ role: 'user', content: normalizedPrompt }],
      }),
    },
    'Anthropic Claude APIの実行に失敗しました。'
  );

  return {
    content: typeof response.content?.[0]?.text === 'string' ? response.content[0].text : '',
    model: typeof response.model === 'string' ? response.model : normalizedModel,
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
  };
}
