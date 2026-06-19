export function installFetchMock(): jest.Mock {
  const fetchMock = jest.fn();
  Object.defineProperty(global, 'fetch', {
    value: fetchMock as typeof fetch,
    writable: true,
    configurable: true,
  });
  return fetchMock;
}

export function createJsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(payload),
    text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
  } as unknown as Response;
}

export function createTextResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: jest.fn().mockRejectedValue(new Error('not json')),
    text: jest.fn().mockResolvedValue(body),
    headers: {
      get: () => 'text/plain',
    },
  } as unknown as Response;
}
