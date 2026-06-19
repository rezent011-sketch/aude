import cron from 'node-cron';

const WEEKDAY_MAP: Record<string, string> = {
  '日': '0',
  '月': '1',
  '火': '2',
  '水': '3',
  '木': '4',
  '金': '5',
  '土': '6',
};

export interface ParsedCronResult {
  cronExpr: string;
  source: 'cron' | 'natural-language';
  normalizedText: string;
}

function normalizeText(input: string): string {
  return input.normalize('NFKC').replace(/\s+/g, '');
}

function validateTime(hour: number, minute: number): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error('時間は 0〜23 時で指定してください。');
  }

  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error('分は 0〜59 で指定してください。');
  }
}

function parseTime(text: string): { hour: number; minute: number } {
  const hhmmMatch = text.match(/(\d{1,2}):(\d{1,2})/);
  if (hhmmMatch) {
    const hour = Number(hhmmMatch[1]);
    const minute = Number(hhmmMatch[2]);
    validateTime(hour, minute);
    return { hour, minute };
  }

  const hourMatch = text.match(/(\d{1,2})時(?:(\d{1,2})分?)?/);
  if (hourMatch) {
    const hour = Number(hourMatch[1]);
    const minute = hourMatch[2] ? Number(hourMatch[2]) : 0;
    validateTime(hour, minute);
    return { hour, minute };
  }

  throw new Error(
    '時刻が読み取れませんでした。例: 「毎日9時」「毎週月曜10時30分」'
  );
}

export function parseJapaneseCron(input: string): ParsedCronResult {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('スケジュールを入力してください。');
  }

  if (cron.validate(trimmed)) {
    return {
      cronExpr: trimmed,
      source: 'cron',
      normalizedText: trimmed,
    };
  }

  const normalizedText = normalizeText(trimmed);
  const { hour, minute } = parseTime(normalizedText);

  if (normalizedText.includes('平日')) {
    return {
      cronExpr: `${minute} ${hour} * * 1-5`,
      source: 'natural-language',
      normalizedText,
    };
  }

  const weeklyMatch = normalizedText.match(/毎週([日月火水木金土])(?:曜(?:日)?)?/);
  if (weeklyMatch) {
    return {
      cronExpr: `${minute} ${hour} * * ${WEEKDAY_MAP[weeklyMatch[1]]}`,
      source: 'natural-language',
      normalizedText,
    };
  }

  const monthlyMatch = normalizedText.match(/毎月(\d{1,2})日/);
  if (monthlyMatch) {
    const dayOfMonth = Number(monthlyMatch[1]);
    if (dayOfMonth < 1 || dayOfMonth > 31) {
      throw new Error('毎月の日付は 1〜31 日で指定してください。');
    }

    return {
      cronExpr: `${minute} ${hour} ${dayOfMonth} * *`,
      source: 'natural-language',
      normalizedText,
    };
  }

  if (normalizedText.includes('毎日')) {
    return {
      cronExpr: `${minute} ${hour} * * *`,
      source: 'natural-language',
      normalizedText,
    };
  }

  throw new Error(
    '対応していないスケジュール形式です。例: 「毎日9時」「毎週月曜10時」「毎月1日8時」「平日18時」'
  );
}
