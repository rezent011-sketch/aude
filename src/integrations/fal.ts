// src/integrations/fal.ts — fal.ai画像・動画生成
import { fal as falClient } from '@fal-ai/client';

function configure() {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error('FAL_KEY が設定されていません。');
  falClient.config({ credentials: key });
}

// ── 画像生成 (FLUX.1-schnell) ──────────────────────────────
export interface FalImageResult {
  url: string;
  width: number;
  height: number;
}

export async function generateImage(
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' = '1:1'
): Promise<FalImageResult> {
  configure();

  const imageSize =
    aspectRatio === '16:9' ? 'landscape_16_9'
    : aspectRatio === '9:16' ? 'portrait_16_9'
    : aspectRatio === '4:3' ? 'landscape_4_3'
    : 'square_hd';

  const result = await falClient.run('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: imageSize,
      num_images: 1,
      enable_safety_checker: true,
    },
  }) as unknown as { data: { images: { url: string; width: number; height: number }[] } };

  const img = result.data?.images?.[0];
  if (!img?.url) throw new Error('画像の生成に失敗しました。');
  return { url: img.url, width: img.width, height: img.height };
}

// ── 動画生成 (Kling v2.1 text→video) ─────────────────────
export interface FalVideoResult {
  url: string;
  duration: number;
}

export async function generateVideo(
  prompt: string,
  duration: 5 | 10 = 5,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9'
): Promise<FalVideoResult> {
  configure();

  // LTX Video: num_frames で長さを指定（24fps × 5秒 = 121フレーム、10秒 = 241フレーム）
  const numFrames = duration === 10 ? 241 : 121;
  const [width, height] =
    aspectRatio === '9:16' ? [512, 896]
    : aspectRatio === '1:1' ? [704, 704]
    : [704, 480]; // 16:9

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await falClient.subscribe('fal-ai/ltx-video', {
    input: { prompt, num_frames: numFrames, width, height, fps: 24 } as any,
    logs: false,
    onQueueUpdate: () => { /* silent */ },
  }) as unknown as { data: { video?: { url: string } } };

  const video = result.data?.video;
  if (!video?.url) throw new Error('動画の生成に失敗しました。');
  return { url: video.url, duration };
}

// ── 画像→動画 (Kling v2.1 image→video) ──────────────────
export async function imageToVideo(
  imageUrl: string,
  prompt: string,
  duration: 5 | 10 = 5
): Promise<FalVideoResult> {
  configure();

  // LTX Video image-to-video
  const numFrames = duration === 10 ? 241 : 121;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await falClient.subscribe('fal-ai/ltx-video/image-to-video', {
    input: { image_url: imageUrl, prompt, num_frames: numFrames, fps: 24 } as any,
    logs: false,
    onQueueUpdate: () => { /* silent */ },
  }) as unknown as { data: { video?: { url: string } } };

  const video = result.data?.video;
  if (!video?.url) throw new Error('動画の生成に失敗しました。');
  return { url: video.url, duration };
}
