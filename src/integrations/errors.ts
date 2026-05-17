export class IntegrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'IntegrationError';
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function requireEnvVar(name: string, serviceName: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new IntegrationError(
      `${serviceName}連携を使うには環境変数 \`${name}\` を設定してください。`
    );
  }

  return value;
}
