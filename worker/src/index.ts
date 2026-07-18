import { analyzeMathEvidence, GlmApiError } from './ai/glm';

const SERVICE_NAME = '上节好课 · AI小学数学精准教学助手 API';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DAILY_CLIENT_LIMIT = 50;
const DAILY_GLOBAL_LIMIT = 500;

type AppEnv = Env & {
  GLM_API_KEY?: string;
  RATE_LIMIT_SALT?: string;
};

const KNOWLEDGE_POINTS: Record<string, string> = {
  'perimeter-concept': '周长的认识',
  rectangle: '长方形周长',
  square: '正方形周长',
  combined: '组合图形边界',
  application: '周长实际问题',
};

const ALLOWED_ORIGINS = new Set([
  'https://shangjiehaoke.com',
  'https://www.shangjiehaoke.com',
]);

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;

  try {
    const url = new URL(origin);
    return (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      (url.protocol === 'http:' || url.protocol === 'https:')
    );
  } catch {
    return false;
  }
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin');

  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : 'https://shangjiehaoke.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request: Request, data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders(request),
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}

function isSupportedImage(bytes: Uint8Array, mimeType: string): boolean {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';

  return (mimeType === 'image/jpeg' && isJpeg)
    || (mimeType === 'image/png' && isPng)
    || (mimeType === 'image/webp' && isWebp);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function clientHash(request: Request, salt: string): Promise<string> {
  const address = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(address));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function incrementUsage(db: D1Database, usageDate: string, key: string): Promise<number> {
  const result = await db.prepare(`
    INSERT INTO api_usage_daily (usage_date, client_hash, request_count, updated_at)
    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (usage_date, client_hash)
    DO UPDATE SET request_count = request_count + 1, updated_at = CURRENT_TIMESTAMP
    RETURNING request_count
  `).bind(usageDate, key).first<{ request_count: number }>();
  return result?.request_count ?? 1;
}

async function checkRateLimit(request: Request, env: AppEnv): Promise<{ allowed: boolean; retryAfter: number }> {
  if (!env.RATE_LIMIT_SALT) return { allowed: false, retryAfter: 60 };

  const usageDate = new Date().toISOString().slice(0, 10);
  const hash = await clientHash(request, env.RATE_LIMIT_SALT);
  const [clientCount, globalCount] = await Promise.all([
    incrementUsage(env.DB, usageDate, hash),
    incrementUsage(env.DB, usageDate, '__global__'),
  ]);

  return {
    allowed: clientCount <= DAILY_CLIENT_LIMIT && globalCount <= DAILY_GLOBAL_LIMIT,
    retryAfter: 86_400,
  };
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/api/health')) {
      return json(request, {
        ok: true,
        service: SERVICE_NAME,
        version: '0.1.0',
        environment: 'local-or-cloudflare',
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/config') {
      return json(request, {
        curriculum: {
          grades: [
            {
              id: 'grade-3',
              name: '三年级',
              enabled: true,
              units: [
                {
                  id: 'geometry-perimeter',
                  name: '图形与几何 · 周长',
                  enabled: true,
                  knowledgePoints: [
                    { id: 'perimeter-concept', name: '周长的认识' },
                    { id: 'rectangle', name: '长方形周长' },
                    { id: 'square', name: '正方形周长' },
                    { id: 'combined', name: '组合图形边界' },
                    { id: 'application', name: '周长实际问题' },
                  ],
                },
              ],
            },
          ],
        },
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/ai/health') {
      return json(request, {
        ok: Boolean(env.GLM_API_KEY),
        provider: 'zhipu',
        model: 'glm-4.6v-flash',
        configured: Boolean(env.GLM_API_KEY),
      }, env.GLM_API_KEY ? 200 : 503);
    }

    if (request.method === 'POST' && url.pathname === '/api/diagnoses/analyze') {
      const origin = request.headers.get('Origin');
      if (!origin || !isAllowedOrigin(origin)) {
        return json(request, {
          ok: false,
          error: { code: 'ORIGIN_NOT_ALLOWED', message: '请求来源不受信任' },
        }, 403);
      }

      if (!env.GLM_API_KEY) {
        return json(request, {
          ok: false,
          error: { code: 'AI_NOT_CONFIGURED', message: 'AI服务尚未完成配置' },
        }, 503);
      }

      try {
        const form = await request.formData();
        const image = form.get('image');
        const knowledgePoint = form.get('knowledgePoint');

        if (!(image instanceof File)) {
          return json(request, {
            ok: false,
            error: { code: 'IMAGE_REQUIRED', message: '请选择一张学生作品图片' },
          }, 400);
        }
        if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
          return json(request, {
            ok: false,
            error: { code: 'IMAGE_SIZE_INVALID', message: '图片大小必须在5MB以内' },
          }, 413);
        }
        if (typeof knowledgePoint !== 'string' || !KNOWLEDGE_POINTS[knowledgePoint]) {
          return json(request, {
            ok: false,
            error: { code: 'KNOWLEDGE_POINT_INVALID', message: '请选择有效的周长知识点' },
          }, 400);
        }

        const imageBuffer = await image.arrayBuffer();
        if (!isSupportedImage(new Uint8Array(imageBuffer), image.type)) {
          return json(request, {
            ok: false,
            error: { code: 'IMAGE_TYPE_INVALID', message: '仅支持真实的JPG、PNG或WEBP图片' },
          }, 415);
        }

        const rateLimit = await checkRateLimit(request, env);
        if (!rateLimit.allowed) {
          return new Response(JSON.stringify({
            ok: false,
            error: { code: 'DAILY_LIMIT_REACHED', message: '今天的AI诊断次数已达到上限，请明天再试' },
          }), {
            status: 429,
            headers: {
              ...corsHeaders(request),
              'Content-Type': 'application/json; charset=UTF-8',
              'Cache-Control': 'no-store',
              'Retry-After': String(rateLimit.retryAfter),
            },
          });
        }

        const result = await analyzeMathEvidence({
          apiKey: env.GLM_API_KEY,
          imageBase64: arrayBufferToBase64(imageBuffer),
          knowledgePoint: KNOWLEDGE_POINTS[knowledgePoint],
        });

        return json(request, {
          ok: true,
          diagnosis: result.diagnosis,
          meta: {
            provider: 'zhipu',
            model: result.model,
            knowledgePoint,
            teacherConfirmationRequired: true,
            imageStored: false,
            usage: result.usage,
          },
        });
      } catch (error) {
        if (error instanceof GlmApiError) {
          return json(request, {
            ok: false,
            error: {
              code: error.providerCode || 'AI_PROVIDER_ERROR',
              message: error.message,
            },
          }, error.status);
        }

        return json(request, {
          ok: false,
          error: { code: 'ANALYSIS_FAILED', message: '作品分析失败，请稍后重试' },
        }, 500);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/db/health') {
      try {
        const result = await env.DB.prepare(
          "SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%'",
        ).first<{ table_count: number }>();

        return json(request, {
          ok: true,
          database: 'connected',
          tableCount: result?.table_count ?? 0,
        });
      } catch {
        return json(request, {
          ok: false,
          database: 'unavailable',
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: '数据库尚未初始化或暂时不可用',
          },
        }, 503);
      }
    }

    return json(request, {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: '请求的接口不存在',
      },
    }, 404);
  },
};
