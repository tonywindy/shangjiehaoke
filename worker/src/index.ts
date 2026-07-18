import { analyzeMathEvidence, GlmApiError } from './ai/glm';
import {
  clearSessionCookie,
  issueSessionToken,
  readSessionCookie,
  sessionCookie,
  verifyPassword,
  verifySessionToken,
} from './auth';

const SERVICE_NAME = '上节好课 · AI小学数学精准教学助手 API';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DAILY_CLIENT_LIMIT = 50;
const DAILY_GLOBAL_LIMIT = 500;
const DAILY_LOGIN_ATTEMPT_LIMIT = 30;
const PRIMARY_TEACHER_ID = 'teacher-primary';

type AppEnv = Env & {
  GLM_API_KEY?: string;
  RATE_LIMIT_SALT?: string;
  SESSION_SECRET?: string;
  TEACHER_USERNAME?: string;
  TEACHER_PASSWORD_HASH?: string;
  TEACHER_DISPLAY_NAME?: string;
};

type Teacher = {
  id: string;
  username: string;
  displayName: string;
};

type DiagnosisStudent = {
  id: string;
  classId: string;
  studentCode: string;
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
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request: Request, data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders(request),
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      ...extraHeaders,
    },
  });
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return Boolean(origin && isAllowedOrigin(origin));
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

async function checkLoginRateLimit(request: Request, env: AppEnv): Promise<boolean> {
  if (!env.RATE_LIMIT_SALT) return false;
  const usageDate = new Date().toISOString().slice(0, 10);
  const hash = await clientHash(request, env.RATE_LIMIT_SALT);
  const count = await incrementUsage(env.DB, usageDate, `auth:${hash}`);
  return count <= DAILY_LOGIN_ATTEMPT_LIMIT;
}

async function ensurePrimaryTeacher(env: AppEnv): Promise<Teacher> {
  const username = env.TEACHER_USERNAME || 'teacher';
  const displayName = env.TEACHER_DISPLAY_NAME || '教师';
  const email = username.includes('@') ? username : `${username}@local.shangjiehaoke.com`;
  await env.DB.prepare(`
    INSERT INTO teachers (id, email, display_name, status, updated_at)
    VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      updated_at = CURRENT_TIMESTAMP
  `).bind(PRIMARY_TEACHER_ID, email, displayName).run();
  return { id: PRIMARY_TEACHER_ID, username, displayName };
}

async function authenticate(request: Request, env: AppEnv): Promise<Teacher | null> {
  if (!env.SESSION_SECRET) return null;
  const token = readSessionCookie(request);
  if (!token) return null;
  const session = await verifySessionToken(env.SESSION_SECRET, token);
  if (!session) return null;
  const record = await env.DB.prepare(
    "SELECT id, display_name FROM teachers WHERE id = ? AND status = 'active'",
  ).bind(session.sub).first<{ id: string; display_name: string }>();
  if (!record) return null;
  return { id: record.id, username: session.username, displayName: record.display_name };
}

async function ensureDefaultClass(env: AppEnv, teacher: Teacher): Promise<string> {
  const classId = `${teacher.id}:default-class`;
  await env.DB.prepare(`
    INSERT INTO classes (id, teacher_id, name, grade, school_year, updated_at)
    VALUES (?, ?, '默认班级', 'grade-3', '2026-2027', CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
  `).bind(classId, teacher.id).run();
  return classId;
}

async function resolveDiagnosisStudent(
  env: AppEnv,
  teacher: Teacher,
  input: { classId?: string; studentId?: string; studentCode?: string },
): Promise<DiagnosisStudent | null> {
  const classId = input.classId || await ensureDefaultClass(env, teacher);
  const ownedClass = await env.DB.prepare(
    'SELECT id FROM classes WHERE id = ? AND teacher_id = ?',
  ).bind(classId, teacher.id).first<{ id: string }>();
  if (!ownedClass) return null;

  if (input.studentId) {
    const student = await env.DB.prepare(`
      SELECT id, anonymous_code
      FROM students
      WHERE id = ? AND class_id = ? AND status = 'active'
    `).bind(input.studentId, classId).first<{ id: string; anonymous_code: string }>();
    return student
      ? { id: student.id, classId, studentCode: student.anonymous_code }
      : null;
  }

  const studentCode = input.studentCode?.trim().slice(0, 32) || '';
  if (!studentCode) return null;
  await env.DB.prepare(`
    INSERT INTO students (id, class_id, anonymous_code, status, updated_at)
    VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)
    ON CONFLICT (class_id, anonymous_code) DO UPDATE SET
      status = 'active',
      updated_at = CURRENT_TIMESTAMP
  `).bind(crypto.randomUUID(), classId, studentCode).run();
  const student = await env.DB.prepare(`
    SELECT id, anonymous_code
    FROM students
    WHERE class_id = ? AND anonymous_code = ? AND status = 'active'
  `).bind(classId, studentCode).first<{ id: string; anonymous_code: string }>();
  return student ? { id: student.id, classId, studentCode: student.anonymous_code } : null;
}

async function saveDiagnosisDraft(
  env: AppEnv,
  teacher: Teacher,
  input: {
    studentId: string;
    classId: string;
    studentCode: string;
    knowledgePoint: string;
    image: File;
    diagnosis: {
      recognizedAnswer: string;
      expectedAnswer: string;
      errorType: string;
      possibleCause: string;
      learningNeed: string;
      confidence: number;
      warnings?: string[];
    };
    model: string;
  },
): Promise<string> {
  const evidenceId = crypto.randomUUID();
  const diagnosisId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO evidence (
        id, student_id, evidence_type, knowledge_point, original_filename,
        mime_type, file_size, object_key, retention_until
      ) VALUES (?, ?, 'wrong_answer', ?, ?, ?, ?, NULL, NULL)
    `).bind(
      evidenceId,
      input.studentId,
      input.knowledgePoint,
      input.image.name.slice(0, 180),
      input.image.type,
      input.image.size,
    ),
    env.DB.prepare(`
      INSERT INTO diagnoses (
        id, evidence_id, recognized_answer, expected_answer, ai_error_type,
        ai_possible_cause, ai_learning_need, ai_confidence, warnings, status,
        model_provider, model_name, prompt_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'zhipu', ?, 'perimeter-v1')
    `).bind(
      diagnosisId,
      evidenceId,
      input.diagnosis.recognizedAnswer,
      input.diagnosis.expectedAnswer,
      input.diagnosis.errorType,
      input.diagnosis.possibleCause,
      input.diagnosis.learningNeed,
      input.diagnosis.confidence,
      JSON.stringify(input.diagnosis.warnings || []),
      input.model,
    ),
    env.DB.prepare(`
      INSERT INTO audit_logs (id, teacher_id, action, entity_type, entity_id, details)
      VALUES (?, ?, 'create_diagnosis_draft', 'diagnosis', ?, ?)
    `).bind(
      crypto.randomUUID(),
      teacher.id,
      diagnosisId,
      JSON.stringify({
        classId: input.classId,
        studentCode: input.studentCode,
        imageStored: false,
      }),
    ),
  ]);
  return diagnosisId;
}

function unauthorized(request: Request): Response {
  return json(request, {
    ok: false,
    error: { code: 'AUTH_REQUIRED', message: '请先登录教师账号' },
  }, 401);
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      if (!originAllowed(request)) {
        return json(request, {
          ok: false,
          error: { code: 'ORIGIN_NOT_ALLOWED', message: '请求来源不受信任' },
        }, 403);
      }
      if (!env.SESSION_SECRET || !env.TEACHER_USERNAME || !env.TEACHER_PASSWORD_HASH) {
        return json(request, {
          ok: false,
          error: { code: 'AUTH_NOT_CONFIGURED', message: '教师登录尚未完成配置' },
        }, 503);
      }
      if (!(await checkLoginRateLimit(request, env))) {
        return json(request, {
          ok: false,
          error: { code: 'LOGIN_LIMIT_REACHED', message: '今天的登录尝试次数过多，请稍后再试' },
        }, 429, { 'Retry-After': '86400' });
      }

      try {
        const body = await request.json<{ username?: string; password?: string }>();
        const username = body.username?.trim() || '';
        const password = body.password || '';
        const usernameMatches = username === env.TEACHER_USERNAME;
        const passwordMatches = password.length <= 256
          && await verifyPassword(password, env.TEACHER_PASSWORD_HASH);
        if (!usernameMatches || !passwordMatches) {
          return json(request, {
            ok: false,
            error: { code: 'LOGIN_FAILED', message: '账号或密码不正确' },
          }, 401);
        }

        const teacher = await ensurePrimaryTeacher(env);
        const token = await issueSessionToken(env.SESSION_SECRET, {
          sub: teacher.id,
          username: teacher.username,
          displayName: teacher.displayName,
        });
        return json(request, { ok: true, teacher }, 200, {
          'Set-Cookie': sessionCookie(token),
        });
      } catch {
        return json(request, {
          ok: false,
          error: { code: 'LOGIN_REQUEST_INVALID', message: '请输入正确的教师账号和密码' },
        }, 400);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      const teacher = await authenticate(request, env);
      if (!teacher) return unauthorized(request);
      return json(request, { ok: true, teacher });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      if (!originAllowed(request)) {
        return json(request, {
          ok: false,
          error: { code: 'ORIGIN_NOT_ALLOWED', message: '请求来源不受信任' },
        }, 403);
      }
      return json(request, { ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
    }

    if (request.method === 'GET' && url.pathname === '/api/classes') {
      const teacher = await authenticate(request, env);
      if (!teacher) return unauthorized(request);
      await ensureDefaultClass(env, teacher);
      const [classResults, studentResults] = await Promise.all([
        env.DB.prepare(`
          SELECT
            c.id,
            c.name,
            c.grade,
            c.school_year AS schoolYear,
            c.created_at AS createdAt,
            COUNT(DISTINCT d.id) AS diagnosisCount
          FROM classes c
          LEFT JOIN students s ON s.class_id = c.id
          LEFT JOIN evidence e ON e.student_id = s.id
          LEFT JOIN diagnoses d ON d.evidence_id = e.id
          WHERE c.teacher_id = ?
          GROUP BY c.id
          ORDER BY c.created_at ASC
        `).bind(teacher.id).all(),
        env.DB.prepare(`
          SELECT
            s.id,
            s.class_id AS classId,
            s.anonymous_code AS anonymousCode,
            s.created_at AS createdAt,
            COUNT(DISTINCT d.id) AS diagnosisCount
          FROM students s
          JOIN classes c ON c.id = s.class_id
          LEFT JOIN evidence e ON e.student_id = s.id
          LEFT JOIN diagnoses d ON d.evidence_id = e.id
          WHERE c.teacher_id = ? AND s.status = 'active'
          GROUP BY s.id
          ORDER BY s.created_at ASC
        `).bind(teacher.id).all(),
      ]);
      const students = (studentResults.results || []) as Array<Record<string, unknown>>;
      const classes = (classResults.results || []).map((classItem) => ({
        ...classItem,
        students: students.filter((student) => student.classId === classItem.id),
      }));
      return json(request, { ok: true, classes });
    }

    if (request.method === 'POST' && url.pathname === '/api/classes') {
      if (!originAllowed(request)) {
        return json(request, {
          ok: false,
          error: { code: 'ORIGIN_NOT_ALLOWED', message: '请求来源不受信任' },
        }, 403);
      }
      const teacher = await authenticate(request, env);
      if (!teacher) return unauthorized(request);
      try {
        const body = await request.json<{ name?: string; schoolYear?: string }>();
        const name = body.name?.trim() || '';
        const schoolYear = body.schoolYear?.trim() || '2026-2027';
        if (name.length < 1 || name.length > 40 || schoolYear.length > 20) {
          return json(request, {
            ok: false,
            error: { code: 'CLASS_INPUT_INVALID', message: '班级名称应为1至40个字符' },
          }, 400);
        }
        const existing = await env.DB.prepare(
          'SELECT id FROM classes WHERE teacher_id = ? AND name = ?',
        ).bind(teacher.id, name).first<{ id: string }>();
        if (existing) {
          return json(request, {
            ok: false,
            error: { code: 'CLASS_ALREADY_EXISTS', message: '已经有同名班级了' },
          }, 409);
        }
        const classId = crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare(`
            INSERT INTO classes (id, teacher_id, name, grade, school_year)
            VALUES (?, ?, ?, 'grade-3', ?)
          `).bind(classId, teacher.id, name, schoolYear),
          env.DB.prepare(`
            INSERT INTO audit_logs (id, teacher_id, action, entity_type, entity_id, details)
            VALUES (?, ?, 'create_class', 'class', ?, ?)
          `).bind(crypto.randomUUID(), teacher.id, classId, JSON.stringify({ name })),
        ]);
        return json(request, { ok: true, classId }, 201);
      } catch {
        return json(request, {
          ok: false,
          error: { code: 'CLASS_CREATE_FAILED', message: '班级创建失败，请稍后重试' },
        }, 400);
      }
    }

    const classMatch = url.pathname.match(/^\/api\/classes\/([^/]+)$/);
    if (request.method === 'PATCH' && classMatch) {
      if (!originAllowed(request)) {
        return json(request, {
          ok: false,
          error: { code: 'ORIGIN_NOT_ALLOWED', message: '请求来源不受信任' },
        }, 403);
      }
      const teacher = await authenticate(request, env);
      if (!teacher) return unauthorized(request);
      try {
        const classId = decodeURIComponent(classMatch[1]);
        const body = await request.json<{ name?: string }>();
        const name = body.name?.trim() || '';
        if (name.length < 1 || name.length > 40) {
          return json(request, {
            ok: false,
            error: { code: 'CLASS_NAME_INVALID', message: '班级名称应为1至40个字符' },
          }, 400);
        }
        const result = await env.DB.prepare(`
          UPDATE classes SET name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND teacher_id = ?
        `).bind(name, classId, teacher.id).run();
        if (!result.meta.changes) {
          return json(request, {
            ok: false,
            error: { code: 'CLASS_NOT_FOUND', message: '没有找到这个班级' },
          }, 404);
        }
        return json(request, { ok: true, classId, name });
      } catch {
        return json(request, {
          ok: false,
          error: { code: 'CLASS_UPDATE_FAILED', message: '班级修改失败，请稍后重试' },
        }, 400);
      }
    }

    const classStudentsMatch = url.pathname.match(/^\/api\/classes\/([^/]+)\/students$/);
    if (request.method === 'POST' && classStudentsMatch) {
      if (!originAllowed(request)) {
        return json(request, {
          ok: false,
          error: { code: 'ORIGIN_NOT_ALLOWED', message: '请求来源不受信任' },
        }, 403);
      }
      const teacher = await authenticate(request, env);
      if (!teacher) return unauthorized(request);
      try {
        const classId = decodeURIComponent(classStudentsMatch[1]);
        const ownedClass = await env.DB.prepare(
          'SELECT id FROM classes WHERE id = ? AND teacher_id = ?',
        ).bind(classId, teacher.id).first<{ id: string }>();
        if (!ownedClass) {
          return json(request, {
            ok: false,
            error: { code: 'CLASS_NOT_FOUND', message: '没有找到这个班级' },
          }, 404);
        }
        const body = await request.json<{ codes?: unknown[] }>();
        const codes = [...new Set((body.codes || [])
          .filter((code): code is string => typeof code === 'string')
          .map((code) => code.trim())
          .filter(Boolean))];
        if (codes.length < 1 || codes.length > 60 || codes.some((code) => code.length > 32)) {
          return json(request, {
            ok: false,
            error: { code: 'STUDENT_CODES_INVALID', message: '每次可添加1至60个学生编号，每个编号不超过32个字符' },
          }, 400);
        }
        await env.DB.batch(codes.map((code) => env.DB.prepare(`
          INSERT INTO students (id, class_id, anonymous_code, status, updated_at)
          VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)
          ON CONFLICT (class_id, anonymous_code) DO UPDATE SET
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
        `).bind(crypto.randomUUID(), classId, code)));
        await env.DB.prepare(`
          INSERT INTO audit_logs (id, teacher_id, action, entity_type, entity_id, details)
          VALUES (?, ?, 'add_students', 'class', ?, ?)
        `).bind(
          crypto.randomUUID(),
          teacher.id,
          classId,
          JSON.stringify({ count: codes.length }),
        ).run();
        return json(request, { ok: true, classId, added: codes.length });
      } catch {
        return json(request, {
          ok: false,
          error: { code: 'STUDENTS_ADD_FAILED', message: '学生编号添加失败，请稍后重试' },
        }, 400);
      }
    }

    const studentMatch = url.pathname.match(/^\/api\/students\/([^/]+)$/);
    if (request.method === 'PATCH' && studentMatch) {
      if (!originAllowed(request)) {
        return json(request, {
          ok: false,
          error: { code: 'ORIGIN_NOT_ALLOWED', message: '请求来源不受信任' },
        }, 403);
      }
      const teacher = await authenticate(request, env);
      if (!teacher) return unauthorized(request);
      try {
        const studentId = decodeURIComponent(studentMatch[1]);
        const body = await request.json<{ status?: string }>();
        if (body.status !== 'active' && body.status !== 'archived') {
          return json(request, {
            ok: false,
            error: { code: 'STUDENT_STATUS_INVALID', message: '学生状态无效' },
          }, 400);
        }
        const result = await env.DB.prepare(`
          UPDATE students SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND class_id IN (
            SELECT id FROM classes WHERE teacher_id = ?
          )
        `).bind(body.status, studentId, teacher.id).run();
        if (!result.meta.changes) {
          return json(request, {
            ok: false,
            error: { code: 'STUDENT_NOT_FOUND', message: '没有找到这个学生编号' },
          }, 404);
        }
        return json(request, { ok: true, studentId, status: body.status });
      } catch {
        return json(request, {
          ok: false,
          error: { code: 'STUDENT_UPDATE_FAILED', message: '学生状态修改失败，请稍后重试' },
        }, 400);
      }
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
      if (!originAllowed(request)) {
        return json(request, {
          ok: false,
          error: { code: 'ORIGIN_NOT_ALLOWED', message: '请求来源不受信任' },
        }, 403);
      }

      const teacher = await authenticate(request, env);
      if (!teacher) return unauthorized(request);

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
        const studentCode = form.get('studentCode');
        const classId = form.get('classId');
        const studentId = form.get('studentId');

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
        if (
          (typeof studentId !== 'string' || !studentId)
          && (typeof studentCode !== 'string' || studentCode.trim().length < 1 || studentCode.trim().length > 32)
        ) {
          return json(request, {
            ok: false,
            error: { code: 'STUDENT_CODE_INVALID', message: '请选择学生或输入有效的学生编号' },
          }, 400);
        }

        const resolvedStudent = await resolveDiagnosisStudent(env, teacher, {
          classId: typeof classId === 'string' && classId ? classId : undefined,
          studentId: typeof studentId === 'string' && studentId ? studentId : undefined,
          studentCode: typeof studentCode === 'string' ? studentCode : undefined,
        });
        if (!resolvedStudent) {
          return json(request, {
            ok: false,
            error: { code: 'STUDENT_NOT_FOUND', message: '没有找到所选班级或学生，请重新选择' },
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

        const diagnosisId = await saveDiagnosisDraft(env, teacher, {
          studentId: resolvedStudent.id,
          classId: resolvedStudent.classId,
          studentCode: resolvedStudent.studentCode,
          knowledgePoint,
          image,
          diagnosis: result.diagnosis,
          model: result.model,
        });

        return json(request, {
          ok: true,
          diagnosis: result.diagnosis,
          meta: {
            diagnosisId,
            provider: 'zhipu',
            model: result.model,
            knowledgePoint,
            teacherConfirmationRequired: true,
            imageStored: false,
            diagnosisSaved: true,
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

    if (request.method === 'GET' && url.pathname === '/api/diagnoses') {
      const teacher = await authenticate(request, env);
      if (!teacher) return unauthorized(request);
      const requestedLimit = Number(url.searchParams.get('limit') || 20);
      const limit = Math.min(Math.max(Number.isInteger(requestedLimit) ? requestedLimit : 20, 1), 50);
      const results = await env.DB.prepare(`
        SELECT
          d.id,
          d.recognized_answer AS recognizedAnswer,
          d.expected_answer AS expectedAnswer,
          d.ai_error_type AS errorType,
          COALESCE(d.teacher_possible_cause, d.ai_possible_cause) AS possibleCause,
          d.ai_learning_need AS learningNeed,
          d.ai_confidence AS confidence,
          d.status,
          d.teacher_confirmed_at AS teacherConfirmedAt,
          d.created_at AS createdAt,
          e.knowledge_point AS knowledgePoint,
          s.anonymous_code AS studentCode,
          c.id AS classId,
          c.name AS className
        FROM diagnoses d
        JOIN evidence e ON e.id = d.evidence_id
        JOIN students s ON s.id = e.student_id
        JOIN classes c ON c.id = s.class_id
        WHERE c.teacher_id = ?
        ORDER BY d.created_at DESC
        LIMIT ?
      `).bind(teacher.id, limit).all();
      return json(request, { ok: true, diagnoses: results.results || [] });
    }

    const diagnosisMatch = url.pathname.match(/^\/api\/diagnoses\/([^/]+)$/);
    if (request.method === 'PATCH' && diagnosisMatch) {
      if (!originAllowed(request)) {
        return json(request, {
          ok: false,
          error: { code: 'ORIGIN_NOT_ALLOWED', message: '请求来源不受信任' },
        }, 403);
      }
      const teacher = await authenticate(request, env);
      if (!teacher) return unauthorized(request);

      try {
        const diagnosisId = decodeURIComponent(diagnosisMatch[1]);
        const body = await request.json<{ status?: string; possibleCause?: string }>();
        if (body.status !== 'confirmed' && body.status !== 'pending') {
          return json(request, {
            ok: false,
            error: { code: 'STATUS_INVALID', message: '诊断状态无效' },
          }, 400);
        }
        const possibleCause = body.possibleCause?.trim() || null;
        if (possibleCause && possibleCause.length > 1000) {
          return json(request, {
            ok: false,
            error: { code: 'POSSIBLE_CAUSE_TOO_LONG', message: '可能原因不能超过1000字' },
          }, 400);
        }

        const result = await env.DB.prepare(`
          UPDATE diagnoses
          SET
            status = ?,
            teacher_possible_cause = COALESCE(?, teacher_possible_cause, ai_possible_cause),
            teacher_error_type = ai_error_type,
            teacher_learning_need = ai_learning_need,
            teacher_confirmed_at = CASE WHEN ? = 'confirmed' THEN CURRENT_TIMESTAMP ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND evidence_id IN (
            SELECT e.id
            FROM evidence e
            JOIN students s ON s.id = e.student_id
            JOIN classes c ON c.id = s.class_id
            WHERE c.teacher_id = ?
          )
        `).bind(
          body.status,
          possibleCause,
          body.status,
          diagnosisId,
          teacher.id,
        ).run();
        if (!result.meta.changes) {
          return json(request, {
            ok: false,
            error: { code: 'DIAGNOSIS_NOT_FOUND', message: '没有找到这条诊断记录' },
          }, 404);
        }

        await env.DB.prepare(`
          INSERT INTO audit_logs (id, teacher_id, action, entity_type, entity_id, details)
          VALUES (?, ?, ?, 'diagnosis', ?, ?)
        `).bind(
          crypto.randomUUID(),
          teacher.id,
          body.status === 'confirmed' ? 'confirm_diagnosis' : 'reopen_diagnosis',
          diagnosisId,
          JSON.stringify({ possibleCauseEdited: Boolean(possibleCause) }),
        ).run();
        return json(request, { ok: true, diagnosisId, status: body.status });
      } catch {
        return json(request, {
          ok: false,
          error: { code: 'DIAGNOSIS_UPDATE_FAILED', message: '诊断记录更新失败，请稍后重试' },
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
