jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as make from '../../integrations/make';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('make', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchJsonMock.mockReset();
    fetchMock.mockReset();
  });

  it('triggers scenario on success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);
    await expect(make.triggerScenario('https://example.com/hook', { hello: 'world' })).resolves.toEqual({ accepted: true });
  });

  it('throws when webhook url is empty', async () => {
    await expect(make.triggerScenario(' ', {})).rejects.toThrow(IntegrationError);
  });

  it('gets scenarios on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ scenarios: [{ id: 1, name: 'Sync', isActive: true, lastEdit: '2026-06-20' }] } as never);
    await expect(make.getScenarios('key', 'team1')).resolves.toEqual([{ id: 1, name: 'Sync', isActive: true, lastEdit: '2026-06-20' }]);
  });
});
