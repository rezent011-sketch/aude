import { IntegrationError, requireEnvVar } from './errors';

const FIREFLIES_API_URL = 'https://api.fireflies.ai/graphql';

type FirefliesTranscriptSummaryApi = {
  id: string;
  title: string;
  dateString?: string | null;
  organizer_email?: string | null;
  transcript_url?: string | null;
  meeting_link?: string | null;
  summary?: {
    short_summary?: string | null;
    short_overview?: string | null;
    action_items?: string[] | null;
    keywords?: string[] | null;
  } | null;
};

type FirefliesTranscriptApi = FirefliesTranscriptSummaryApi & {
  date?: number | null;
  participants?: string[] | null;
  duration?: number | null;
};

type FirefliesGraphQlResponse<T> = {
  data?: T;
  errors?: Array<{
    message?: string;
  }>;
};

export type FirefliesTranscriptSummary = {
  id: string;
  title: string;
  date: string | null;
  organizerEmail: string | null;
  transcriptUrl: string | null;
  meetingLink: string | null;
  shortSummary: string | null;
  shortOverview: string | null;
  actionItems: string[];
  keywords: string[];
};

export type FirefliesTranscriptDetail = FirefliesTranscriptSummary & {
  participants: string[];
  durationInSeconds: number | null;
};

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireEnvVar('FIREFLIES_API_KEY', 'Fireflies')}`,
    'Content-Type': 'application/json',
  };
}

async function firefliesGraphql<TData>(
  query: string,
  variables: Record<string, unknown>,
  errorMessage: string
): Promise<TData> {
  let response: Response;

  try {
    response = await fetch(FIREFLIES_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    throw new IntegrationError(errorMessage, { cause: error });
  }

  let payload: FirefliesGraphQlResponse<TData>;

  try {
    payload = (await response.json()) as FirefliesGraphQlResponse<TData>;
  } catch (error) {
    throw new IntegrationError(errorMessage, { cause: error });
  }

  if (!response.ok) {
    const apiMessage = payload.errors?.map((item) => item.message).filter(Boolean).join(' / ');
    throw new IntegrationError(apiMessage ? `${errorMessage} (${apiMessage})` : errorMessage);
  }

  if (payload.errors?.length) {
    const apiMessage = payload.errors.map((item) => item.message).filter(Boolean).join(' / ');
    throw new IntegrationError(apiMessage || errorMessage);
  }

  if (!payload.data) {
    throw new IntegrationError(errorMessage);
  }

  return payload.data;
}

function mapTranscript(summary: FirefliesTranscriptSummaryApi): FirefliesTranscriptSummary {
  return {
    id: summary.id,
    title: summary.title,
    date: summary.dateString ?? null,
    organizerEmail: summary.organizer_email ?? null,
    transcriptUrl: summary.transcript_url ?? null,
    meetingLink: summary.meeting_link ?? null,
    shortSummary: summary.summary?.short_summary ?? null,
    shortOverview: summary.summary?.short_overview ?? null,
    actionItems: summary.summary?.action_items ?? [],
    keywords: summary.summary?.keywords ?? [],
  };
}

export async function listFirefliesTranscripts(limit = 5): Promise<FirefliesTranscriptSummary[]> {
  const data = await firefliesGraphql<{ transcripts: FirefliesTranscriptSummaryApi[] }>(
    `
      query Transcripts($limit: Int, $mine: Boolean) {
        transcripts(limit: $limit, mine: $mine) {
          id
          title
          dateString
          organizer_email
          transcript_url
          meeting_link
          summary {
            short_summary
            short_overview
            action_items
            keywords
          }
        }
      }
    `,
    { limit, mine: true },
    'Fireflies transcript一覧の取得に失敗しました。APIキーやアクセス権限を確認してください。'
  );

  return data.transcripts.map(mapTranscript);
}

export async function searchFirefliesTranscripts(
  keyword: string,
  limit = 5
): Promise<FirefliesTranscriptSummary[]> {
  const data = await firefliesGraphql<{ transcripts: FirefliesTranscriptSummaryApi[] }>(
    `
      query SearchTranscripts($keyword: String!, $scope: TranscriptsQueryScope, $limit: Int) {
        transcripts(keyword: $keyword, scope: $scope, limit: $limit, mine: true) {
          id
          title
          dateString
          organizer_email
          transcript_url
          meeting_link
          summary {
            short_summary
            short_overview
            action_items
            keywords
          }
        }
      }
    `,
    {
      keyword,
      scope: 'all',
      limit,
    },
    'Fireflies transcript検索に失敗しました。キーワード、APIキー、権限を確認してください。'
  );

  return data.transcripts.map(mapTranscript);
}

export async function getFirefliesTranscriptSummary(
  transcriptId: string
): Promise<FirefliesTranscriptDetail> {
  const data = await firefliesGraphql<{ transcript: FirefliesTranscriptApi | null }>(
    `
      query Transcript($transcriptId: String!) {
        transcript(id: $transcriptId) {
          id
          title
          date
          dateString
          organizer_email
          transcript_url
          meeting_link
          participants
          duration
          summary {
            short_summary
            short_overview
            action_items
            keywords
          }
        }
      }
    `,
    { transcriptId },
    'Fireflies transcript summary の取得に失敗しました。transcript id とアクセス権限を確認してください。'
  );

  if (!data.transcript) {
    throw new IntegrationError('指定した Fireflies transcript は見つかりませんでした。');
  }

  const base = mapTranscript(data.transcript);

  return {
    ...base,
    participants: data.transcript.participants ?? [],
    durationInSeconds: data.transcript.duration ?? null,
  };
}
