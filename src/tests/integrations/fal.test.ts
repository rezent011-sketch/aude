jest.mock('@fal-ai/client', () => ({
  fal: {
    config: jest.fn(),
    run: jest.fn(),
  },
}));

import { fal } from '@fal-ai/client';
import * as falIntegration from '../../integrations/fal';

const falMock = fal as unknown as { config: jest.Mock; run: jest.Mock };

describe('fal', () => {
  const originalKey = process.env.FAL_KEY;

  beforeEach(() => {
    falMock.config.mockReset();
    falMock.run.mockReset();
    process.env.FAL_KEY = 'fal-key';
  });

  afterAll(() => {
    process.env.FAL_KEY = originalKey;
  });

  it('generates an image on success', async () => {
    falMock.run.mockResolvedValueOnce({
      data: { images: [{ url: 'https://example.com/image.png', width: 1024, height: 1024 }] },
    });

    await expect(falIntegration.generateImage('sunset')).resolves.toEqual({
      url: 'https://example.com/image.png',
      width: 1024,
      height: 1024,
    });
  });

  it('throws when FAL_KEY is missing', async () => {
    delete process.env.FAL_KEY;
    await expect(falIntegration.generateImage('sunset')).rejects.toThrow('FAL_KEY');
  });

  it('throws when provider returns no image', async () => {
    falMock.run.mockResolvedValueOnce({ data: { images: [] } });
    await expect(falIntegration.generateImage('sunset')).rejects.toThrow();
  });
});
