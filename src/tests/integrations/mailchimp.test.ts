jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as mailchimp from '../../integrations/mailchimp';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('mailchimp', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('gets lists on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ lists: [{ id: 'l1', name: 'Audience', stats: { member_count: 10 } }] } as never);

    await expect(mailchimp.getLists('key-us1')).resolves.toEqual([
      { id: 'l1', name: 'Audience', stats: { member_count: 10 } },
    ]);
  });

  it('throws when api key is empty', async () => {
    await expect(mailchimp.getLists(' ')).rejects.toThrow(IntegrationError);
  });

  it('gets audience stats on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ stats: { member_count: 10, unsubscribe_count: 1, open_rate: 42.5 } } as never);
    await expect(mailchimp.getAudienceStats('key-us1', 'list1')).resolves.toEqual({ member_count: 10, unsubscribe_count: 1, open_rate: 42.5 });
  });
});
