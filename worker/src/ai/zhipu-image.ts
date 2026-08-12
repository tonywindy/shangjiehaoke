const ZHIPU_IMAGE_API_URL = 'https://open.bigmodel.cn/api/paas/v4/images/generations';
export const ZHIPU_IMAGE_MODEL = 'glm-image';
const ZHIPU_IMAGE_TIMEOUT_MS = 90_000;
const MAX_PROMPT_LENGTH = 700;

type ZhipuImageResponse = {
  data?: Array<{ url?: string }>;
  error?: { code?: string | number; message?: string };
};

export class ZhipuImageError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = 'ZhipuImageError';
  }
}

function validateImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export async function generateStoryImage(options: {
  apiKey: string;
  prompt: string;
}): Promise<{ imageUrl: string; model: string }> {
  const prompt = options.prompt.trim().replace(/\s+/g, ' ');
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    throw new ZhipuImageError('图片描述应为1至700个字符', 400, 'PROMPT_INVALID');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ZHIPU_IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(ZHIPU_IMAGE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ZHIPU_IMAGE_MODEL,
        prompt: `儿童数学冒险动画插画，画面明亮温暖，主体居中清晰，无文字、字母、数字、标志或水印，不出现恐怖元素，不使用真人儿童照片风格。场景：${prompt}`,
        size: '1568x1056',
      }),
      signal: controller.signal,
    });

    const payload: ZhipuImageResponse = await response
      .json<ZhipuImageResponse>()
      .catch(() => ({}));
    if (!response.ok) {
      const providerCode = payload.error?.code === undefined ? undefined : String(payload.error.code);
      const isBusy = response.status === 429 || response.status >= 500;
      throw new ZhipuImageError(
        isBusy ? 'AI生图服务当前较繁忙，请稍后重试' : (payload.error?.message || 'GLM生图服务暂时不可用'),
        isBusy ? 503 : 502,
        providerCode,
      );
    }

    const imageUrl = validateImageUrl(payload.data?.[0]?.url);
    if (!imageUrl) throw new ZhipuImageError('GLM没有返回可用的图片');
    return { imageUrl, model: ZHIPU_IMAGE_MODEL };
  } catch (error) {
    if (error instanceof ZhipuImageError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ZhipuImageError('AI生图超时，请稍后重试', 504, 'TIMEOUT');
    }
    console.error('Zhipu image request failed', {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new ZhipuImageError('暂时无法连接GLM生图服务，请稍后重试');
  } finally {
    clearTimeout(timeout);
  }
}
