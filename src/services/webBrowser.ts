import { chromium } from 'playwright-core';
import { routeToLLM } from '../llm/router';

const PAGE_LOAD_TIMEOUT_MS = 20_000;
const MAX_EXTRACTED_TEXT_LENGTH = 8_000;

export interface BrowseResult {
  title: string;
  text: string;
  screenshot?: Buffer;
  error?: string;
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('URL is required.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }

  return parsed.toString();
}

function mapBrowseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/timeout/i.test(message)) {
    return 'The page took too long to load.';
  }

  if (/ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_INTERNET_DISCONNECTED/i.test(message)) {
    return 'The page could not be reached.';
  }

  if (/net::ERR_|Navigation failed|NS_ERROR/i.test(message)) {
    return 'The page could not be loaded.';
  }

  if (/Only HTTP and HTTPS URLs are supported|Invalid URL|URL is required/i.test(message)) {
    return message;
  }

  return 'Browsing failed. The page may be blocked or unavailable.';
}

export async function browseUrl(url: string, task: string): Promise<BrowseResult> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  const safeTask = task.trim() || 'Summarize the main content of this page';

  try {
    const normalizedUrl = normalizeUrl(url);

    browser = await chromium.launch({
      executablePath: chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });

    await page.goto(normalizedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    const title = (await page.title()).trim() || 'Untitled page';
    const bodyText = await page.locator('body').innerText({ timeout: PAGE_LOAD_TIMEOUT_MS });
    const extractedText = bodyText.replace(/\s+\n/g, '\n').trim().slice(0, MAX_EXTRACTED_TEXT_LENGTH);
    const screenshot = Buffer.from(await page.screenshot({ fullPage: false, type: 'png' }));

    if (!extractedText) {
      return {
        title,
        text: 'No visible text could be extracted from this page.',
        screenshot,
        error: 'The page loaded, but it did not expose readable text.',
      };
    }

    const summaryPrompt = [
      `You are browsing a webpage titled "${title}".`,
      `User task: ${safeTask}`,
      'Use only the page text below to answer the task. If the page does not contain the answer, say so clearly.',
      'Keep the response concise and directly useful for Discord.',
      '',
      'Page text:',
      extractedText,
    ].join('\n');

    const llmSummary = await routeToLLM(summaryPrompt);

    return {
      title,
      text: llmSummary,
      screenshot,
    };
  } catch (error) {
    const friendlyError = mapBrowseError(error);

    return {
      title: 'Browse failed',
      text: friendlyError,
      error: friendlyError,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
