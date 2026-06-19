import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as surveymonkey from '../../integrations/surveymonkey';

describe('surveymonkey', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets surveys on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            id: 'survey-1',
            title: 'Customer Satisfaction',
            response_count: 12,
            date_created: '2026-06-20T00:00:00Z',
          },
        ],
      })
    );

    await expect(surveymonkey.getSurveys('token')).resolves.toEqual([
      {
        id: 'survey-1',
        title: 'Customer Satisfaction',
        response_count: 12,
        date_created: '2026-06-20T00:00:00Z',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(surveymonkey.getSurveys(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when survey id missing', async () => {
    await expect(surveymonkey.getSurveyDetails('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
