const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const GLM_MODEL = 'glm-4.6v-flash';
const GLM_TIMEOUT_MS = 45_000;
const GLM_MAX_ATTEMPTS = 3;

export type DiagnosisResult = {
  questionText: string;
  recognizedAnswer: string;
  expectedAnswer: string;
  isCorrect: boolean | null;
  errorType: string;
  possibleCause: string;
  learningNeed: string;
  confidence: number;
  imageQuality: 'clear' | 'usable' | 'poor';
  evidence: string[];
  warnings: string[];
};

type GlmResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export class GlmApiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = 'GlmApiError';
  }
}

function buildPrompt(knowledgePoint: string): string {
  return `你是一名严谨的小学数学教师助手。请分析图片中学生关于“周长”的题目和作答，为教师提供初步诊断。

当前知识点：${knowledgePoint}

要求：
1. 只根据图片中确实可见的内容判断，不要猜测学生身份，也不要识别或输出姓名。
2. 先识别题目、学生作答，再独立计算正确答案。
3. 如果图片模糊、题目不完整或无法判断，把 imageQuality 设为 poor，降低 confidence，并在 warnings 说明。
4. 错因只是供教师确认的建议，不能把能力判断写成固定标签。
5. errorType 使用简短教学语言，例如“周长概念理解不完整”“漏算边长”“公式使用错误”“计算错误”“单位错误”“作答正确”或“证据不足”。
6. confidence 必须是 0 到 1 之间的小数。
7. 仅输出一个 JSON 对象，不要使用 Markdown 代码块，不要添加 JSON 之外的解释。

JSON 字段必须完整：
{
  "questionText": "识别到的题目，无法识别时写未能完整识别",
  "recognizedAnswer": "识别到的学生作答，未作答时写未发现作答",
  "expectedAnswer": "正确答案及简短算式，无法判断时写证据不足",
  "isCorrect": true、false 或 null,
  "errorType": "错误类型",
  "possibleCause": "基于本张作品的可能原因，不超过80字",
  "learningNeed": "下一步学习需求，不超过80字",
  "confidence": 0.0,
  "imageQuality": "clear、usable 或 poor",
  "evidence": ["图片中支持诊断的可见证据"],
  "warnings": ["需要教师注意的信息，没有则为空数组"]
}`;
}

function extractJson(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) throw new GlmApiError('AI返回了无法解析的诊断结果');
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function normalizeDiagnosis(value: unknown): DiagnosisResult {
  if (!value || typeof value !== 'object') throw new GlmApiError('AI诊断结果格式不正确');
  const result = value as Record<string, unknown>;
  const confidence = typeof result.confidence === 'number' && Number.isFinite(result.confidence)
    ? Math.min(1, Math.max(0, result.confidence))
    : 0;
  const imageQuality = result.imageQuality === 'clear' || result.imageQuality === 'usable' || result.imageQuality === 'poor'
    ? result.imageQuality
    : 'poor';
  const isCorrect = typeof result.isCorrect === 'boolean' ? result.isCorrect : null;

  return {
    questionText: asString(result.questionText, '未能完整识别'),
    recognizedAnswer: asString(result.recognizedAnswer, '未发现作答'),
    expectedAnswer: asString(result.expectedAnswer, '证据不足'),
    isCorrect,
    errorType: asString(result.errorType, '证据不足'),
    possibleCause: asString(result.possibleCause, '需要教师结合课堂表现进一步判断'),
    learningNeed: asString(result.learningNeed, '请教师确认图片内容后再确定学习需求'),
    confidence,
    imageQuality,
    evidence: asStringArray(result.evidence),
    warnings: asStringArray(result.warnings),
  };
}

export async function analyzeMathEvidence(options: {
  apiKey: string;
  imageBase64: string;
  knowledgePoint: string;
}): Promise<{ diagnosis: DiagnosisResult; usage?: GlmResponse['usage']; model: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GLM_TIMEOUT_MS);

  try {
    const requestBody = JSON.stringify({
      model: GLM_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: options.imageBase64 } },
            { type: 'text', text: buildPrompt(options.knowledgePoint) },
          ],
        },
      ],
      thinking: { type: 'disabled' },
      temperature: 0.1,
      max_tokens: 1600,
    });

    let response: Response | undefined;
    let payload: GlmResponse = {};
    for (let attempt = 1; attempt <= GLM_MAX_ATTEMPTS; attempt += 1) {
      response = await fetch(GLM_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: requestBody,
        signal: controller.signal,
      });
      payload = await response.json<GlmResponse>().catch(() => ({}));

      const isTemporarilyBusy = response.status === 429
        || response.status >= 500
        || payload.error?.code === '1305';
      if (response.ok || !isTemporarilyBusy || attempt === GLM_MAX_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }

    if (!response?.ok) {
      const isBusy = response?.status === 429 || response?.status === 503 || payload.error?.code === '1305';
      throw new GlmApiError(
        isBusy ? '免费AI当前使用人数较多，请稍后再试' : (payload.error?.message || 'GLM服务暂时不可用'),
        isBusy ? 503 : 502,
        payload.error?.code,
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new GlmApiError('GLM没有返回诊断内容');

    return {
      diagnosis: normalizeDiagnosis(extractJson(content)),
      usage: payload.usage,
      model: GLM_MODEL,
    };
  } catch (error) {
    if (error instanceof GlmApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GlmApiError('AI分析超时，请稍后重试', 504);
    }
    throw new GlmApiError('暂时无法连接GLM服务，请稍后重试');
  } finally {
    clearTimeout(timeout);
  }
}
