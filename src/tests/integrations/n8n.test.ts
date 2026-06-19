jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as n8n from '../../integrations/n8n';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('n8n', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchJsonMock.mockReset();
    fetchMock.mockReset();
  });

  it('triggers workflow on success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, headers: { get: () => 'application/json' }, json: jest.fn().mockResolvedValue({ ok: true }) } as unknown as Response);
    await expect(n8n.triggerWorkflow('https://example.com/webhook', { a: 1 })).resolves.toEqual({ ok: true });
  });

  it('throws when webhook url is empty', async () => {
    await expect(n8n.triggerWorkflow(' ', {})).rejects.toThrow(IntegrationError);
  });

  it('gets workflows on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ data: [{ id: 'w1', name: 'Workflow', active: true, createdAt: '2026-06-20' }] } as never);
    await expect(n8n.getWorkflows('https://n8n.example.com', 'key')).resolves.toEqual([
      { id: 'w1', name: 'Workflow', active: true, createdAt: '2026-06-20' },
    ]);
  });
});
