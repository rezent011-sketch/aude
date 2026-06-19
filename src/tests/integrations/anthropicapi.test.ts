jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as anthropicapi from '../../integrations/anthropicapi';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('anthropicapi', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('returns a Claude response on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      content: [{ text: 'hello' }],
      model: 'claude-test',
      usage: { input_tokens: 10, output_tokens: 5 },
    } as never);

    await expect(anthropicapi.ask('key', 'claude-test', 'ping')).resolves.toEqual({
      content: 'hello',
      model: 'claude-test',
      input_tokens: 10,
      output_tokens: 5,
    });
  });

  it('throws when api key is missing', async () => {
    await expect(anthropicapi.ask(' ', 'claude-test', 'ping')).rejects.toThrow(IntegrationError);
  });

  it('throws when prompt is empty', async () => {
    await expect(anthropicapi.ask('key', 'claude-test', ' ')).rejects.toThrow(IntegrationError);
  });
});
