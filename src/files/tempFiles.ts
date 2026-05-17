import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const TMP_DIR = path.join('/tmp', 'aude');

async function ensureTmpDir(): Promise<void> {
  await fs.mkdir(TMP_DIR, { recursive: true });
}

export async function createTempFilePath(prefix: string, extension: string): Promise<string> {
  await ensureTmpDir();
  const safeExtension = extension.startsWith('.') ? extension : `.${extension}`;
  return path.join(TMP_DIR, `${prefix}-${randomUUID()}${safeExtension}`);
}

export async function deleteTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error(`Failed to delete temp file: ${filePath}`, error);
    }
  }
}
