import { IntegrationError } from './errors';

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function extractApiMessage(payload: unknown): string | null {
  if (!isJsonRecord(payload)) {
    return null;
  }

  const message = payload.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  const error = payload.error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return null;
}

export async function fetchJson<T>(url: string, init: RequestInit, errorMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new IntegrationError(errorMessage, { cause: error });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const apiMessage = extractApiMessage(payload);
    throw new IntegrationError(apiMessage ? `${errorMessage} (${apiMessage})` : errorMessage);
  }

  return payload as T;
}
