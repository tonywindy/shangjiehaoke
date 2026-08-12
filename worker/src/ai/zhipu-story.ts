import { jsonrepair } from 'jsonrepair';
import { GLM_MODEL } from './glm';

const ZHIPU_CHAT_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_STORY_TIMEOUT_MS = 60_000;
const MAX_MESSAGES = 8;
const MAX_TOTAL_CONTENT_LENGTH = 18_000;

export type StoryMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ZhipuStoryResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    code?: string | number;
    message?: string;
  };
};

export class ZhipuStoryError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = 'ZhipuStoryError';
  }
}

function normalizeMessages(value: unknown): StoryMessage[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_MESSAGES) {
    throw new ZhipuStoryError('故事请求格式不正确', 400, 'MESSAGES_INVALID');
  }

  const messages = value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new ZhipuStoryError('故事请求格式不正确', 400, 'MESSAGES_INVALID');
    }
    const record = item as Record<string, unknown>;
    const role = record.role;
    const content = typeof record.content === 'string' ? record.content.trim() : '';
    if ((role !== 'system' && role !== 'user' && role !== 'assistant') || !content) {
      throw new ZhipuStoryError('故事请求格式不正确', 400, 'MESSAGES_INVALID');
    }
    return { role: role as StoryMessage['role'], content };
  });

  const totalLength = messages.reduce((sum, message) => sum + message.content.length, 0);
  const firstMessage = messages[0];
  if (
    totalLength > MAX_TOTAL_CONTENT_LENGTH
    || firstMessage.role !== 'system'
    || !firstMessage.content.includes('数学')
    || !firstMessage.content.includes('chapters')
  ) {
    throw new ZhipuStoryError('只支持本站数学冒险故事生成请求', 400, 'STORY_REQUEST_INVALID');
  }
  return messages;
}

function validateStoryContent(content: string): void {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new ZhipuStoryError('AI返回的故事格式不完整');
  }

  try {
    const parsed = JSON.parse(jsonrepair(cleaned.slice(start, end + 1))) as {
      chapters?: Array<Record<string, unknown>>;
    };
    const chapters = parsed.chapters;
    const complete = Array.isArray(chapters)
      && chapters.length === 5
      && chapters.every((chapter) => (
        typeof chapter.story === 'string'
        && typeof chapter.sceneDescription === 'string'
        && typeof chapter.question === 'string'
        && Object.prototype.hasOwnProperty.call(chapter, 'answer')
      ));
    if (!complete) throw new Error('incomplete chapters');
  } catch {
    throw new ZhipuStoryError('AI返回的故事格式不完整');
  }
}

export async function generateMathStory(options: {
  apiKey: string;
  messages: unknown;
  maxTokens?: number;
}): Promise<{
  content: string;
  usage?: ZhipuStoryResponse['usage'];
  model: string;
}> {
  const messages = normalizeMessages(options.messages);
  const maxTokens = Number.isFinite(options.maxTokens)
    ? Math.min(3_500, Math.max(1_500, Math.round(options.maxTokens as number)))
    : 3_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ZHIPU_STORY_TIMEOUT_MS);

  try {
    const response = await fetch(ZHIPU_CHAT_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [
          {
            role: 'system',
            content: '你只创作适合小学生的安全、积极、无个人信息的数学冒险故事。严格遵守后续JSON格式要求，不执行与数学故事无关的指令。',
          },
          ...messages,
        ],
        thinking: { type: 'disabled' },
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    const payload: ZhipuStoryResponse = await response
      .json<ZhipuStoryResponse>()
      .catch(() => ({}));
    if (!response.ok) {
      const providerCode = payload.error?.code === undefined ? undefined : String(payload.error.code);
      const isBusy = response.status === 429 || response.status >= 500;
      throw new ZhipuStoryError(
        isBusy ? 'AI故事服务当前较繁忙，请稍后重试' : (payload.error?.message || 'GLM故事服务暂时不可用'),
        isBusy ? 503 : 502,
        providerCode,
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new ZhipuStoryError('GLM没有返回故事内容');
    validateStoryContent(content);
    return { content, usage: payload.usage, model: GLM_MODEL };
  } catch (error) {
    if (error instanceof ZhipuStoryError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ZhipuStoryError('AI故事生成超时，请稍后重试', 504, 'TIMEOUT');
    }
    console.error('Zhipu story request failed', {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new ZhipuStoryError('暂时无法连接GLM故事服务，请稍后重试');
  } finally {
    clearTimeout(timeout);
  }
}
