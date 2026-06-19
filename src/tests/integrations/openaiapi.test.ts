jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as openaiapi from '../../integrations/openaiapi';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('openaiapi', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('lists models on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ data: [{ id: 'gpt-5.4', owned_by: 'openai' }, { id: 'text-embedding-3-small', owned_by: 'openai' }] } as never);
    await expect(openaiapi.listModels('token')).resolves.toEqual([{ id: 'gpt-5.4', owned_by: 'openai' }]);
  });

  it('throws when model is empty', async () => {
    await expect(openaiapi.chat('token', ' ', 'hello')).rejects.toThrow(IntegrationError);
  });

  it('returns chat completion on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ choices: [{ message: { content: 'hello' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } } as never);
    await expect(openaiapi.chat('token', 'gpt-5.4', 'hello')).resolves.toEqual({ content: 'hello', usage: { prompt_tokens: 10, completion_tokens: 5 } });
  });
});
