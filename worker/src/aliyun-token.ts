/**
 * 阿里云智能语音交互（NLS）临时 Token 签发接口（Cloudflare Worker 版）
 * 通过 Cloudflare Secrets 保管 AccessKey，绝不暴露到前端或仓库。
 */

export interface AliyunTokenEnv {
  ALIYUN_AK_ID?: string;
  ALIYUN_AK_SECRET?: string;
  ALIYUN_APPKEY?: string;
  LANGDU_ACCESS_CODE?: string;
}

interface CachedToken {
  token: string;
  expireTime: number;
}

let cached: CachedToken | null = null;

function pct(value: string): string {
  return encodeURIComponent(value)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')
    .replace(/[!'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function createAliyunToken(akId: string, akSecret: string): Promise<CachedToken> {
  const params: Record<string, string> = {
    AccessKeyId: akId,
    Action: 'CreateToken',
    Format: 'JSON',
    RegionId: 'cn-shanghai',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2019-02-28',
  };

  const query = Object.keys(params)
    .sort()
    .map((k) => `${pct(k)}=${pct(params[k])}`)
    .join('&');

  const toSign = `GET&${pct('/')}&${pct(query)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${akSecret}&`),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const signature = bytesToBase64(new Uint8Array(sigBuf));
  const endpoint = `https://nls-meta.cn-shanghai.aliyuncs.com/?Signature=${pct(signature)}&${query}`;

  const res = await fetch(endpoint, { method: 'GET' });
  const data = (await res.json()) as {
    Token?: { Id?: string; ExpireTime?: number };
    Message?: string;
  };
  if (!data.Token?.Id || !data.Token.ExpireTime) {
    throw new Error(data.Message || `CreateToken failed (${res.status})`);
  }
  return { token: data.Token.Id, expireTime: data.Token.ExpireTime };
}

export async function handleAliyunTokenRequest(
  request: Request,
  env: AliyunTokenEnv,
  cors: HeadersInit,
): Promise<Response> {
  const respond = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: {
        ...cors,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  if (env.LANGDU_ACCESS_CODE) {
    const provided = (request.headers.get('X-Access-Code') || '').trim();
    if (!provided || !safeEqual(provided, env.LANGDU_ACCESS_CODE)) {
      return respond({ error: '访问口令不对', needCode: true }, 401);
    }
  }

  if (!env.ALIYUN_AK_ID || !env.ALIYUN_AK_SECRET || !env.ALIYUN_APPKEY) {
    return respond({ error: '服务器尚未配置阿里云语音密钥' }, 503);
  }

  const now = Date.now() / 1000;
  if (cached && cached.expireTime - 600 > now) {
    return respond({ token: cached.token, expireTime: cached.expireTime, appkey: env.ALIYUN_APPKEY });
  }

  try {
    cached = await createAliyunToken(env.ALIYUN_AK_ID, env.ALIYUN_AK_SECRET);
    return respond({ token: cached.token, expireTime: cached.expireTime, appkey: env.ALIYUN_APPKEY });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return respond({ error: `获取语音 Token 失败：${msg}` }, 502);
  }
}

export async function handleAliyunTtsRequest(
  request: Request,
  env: AliyunTokenEnv,
  cors: HeadersInit,
): Promise<Response> {
  const respondJson = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: {
        ...cors,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  if (env.LANGDU_ACCESS_CODE) {
    const provided = (request.headers.get('X-Access-Code') || '').trim();
    if (!provided || !safeEqual(provided, env.LANGDU_ACCESS_CODE)) {
      return respondJson({ error: '访问口令不对', needCode: true }, 401);
    }
  }

  if (!env.ALIYUN_AK_ID || !env.ALIYUN_AK_SECRET || !env.ALIYUN_APPKEY) {
    return respondJson({ error: '服务器尚未配置阿里云语音密钥' }, 503);
  }

  const text = (new URL(request.url).searchParams.get('text') || '').trim().slice(0, 60);
  if (!text) return respondJson({ error: '缺少朗读文本' }, 400);

  try {
    const now = Date.now() / 1000;
    if (!cached || cached.expireTime - 600 <= now) {
      cached = await createAliyunToken(env.ALIYUN_AK_ID, env.ALIYUN_AK_SECRET);
    }
    const ttsRes = await fetch('https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appkey: env.ALIYUN_APPKEY,
        token: cached.token,
        text,
        format: 'mp3',
        sample_rate: 16000,
        voice: 'zhixiaoxia',
        speech_rate: -120,
      }),
    });
    const ct = ttsRes.headers.get('content-type') || '';
    if (!ttsRes.ok || !ct.includes('audio')) {
      const msg = await ttsRes.text();
      return respondJson({ error: `语音合成失败：${msg}` }, 502);
    }
    return new Response(ttsRes.body, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return respondJson({ error: `语音合成失败：${msg}` }, 502);
  }
}
