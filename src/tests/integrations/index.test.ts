import {
  checkIntegrationStatus,
  getIntegration,
  listAvailableIntegrations,
} from '../../integrations';

describe('integration registry', () => {
  const originalEnv = {
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  };

  beforeEach(() => {
    delete process.env.NOTION_API_KEY;
    delete process.env.NOTION_DATABASE_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REFRESH_TOKEN;
    delete process.env.GITHUB_TOKEN;
  });

  afterAll(() => {
    process.env.NOTION_API_KEY = originalEnv.NOTION_API_KEY;
    process.env.NOTION_DATABASE_ID = originalEnv.NOTION_DATABASE_ID;
    process.env.GOOGLE_CLIENT_ID = originalEnv.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = originalEnv.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_REFRESH_TOKEN = originalEnv.GOOGLE_REFRESH_TOKEN;
    process.env.GITHUB_TOKEN = originalEnv.GITHUB_TOKEN;
  });

  it('lists supported integrations', () => {
    expect(listAvailableIntegrations().map((integration) => integration.name)).toEqual([
      'github',
      'google',
      'notion',
    ]);
  });

  it('returns integration metadata by name', () => {
    expect(getIntegration('google')).toEqual(
      expect.objectContaining({
        name: 'google',
        displayName: 'Google Workspace',
      })
    );
  });

  it('reports missing env vars for an unconfigured integration', () => {
    expect(checkIntegrationStatus('github')).toEqual({
      name: 'github',
      isConfigured: false,
      missingEnvVars: ['GITHUB_TOKEN'],
    });
  });

  it('reports configured when all required env vars are present', () => {
    process.env.NOTION_API_KEY = 'token';
    process.env.NOTION_DATABASE_ID = 'database';

    expect(checkIntegrationStatus('notion')).toEqual({
      name: 'notion',
      isConfigured: true,
      missingEnvVars: [],
    });
  });
});
