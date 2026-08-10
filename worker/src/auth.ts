const SESSION_COOKIE = 'sjhk_teacher_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type TeacherSession = {
  sub: string;
  username: string;
  displayName: string;
  exp: number;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, iterationsText, saltText, expectedText] = encodedHash.split('$');
  if (algorithm === 'sha256' && iterationsText && !saltText && !expectedText) {
    try {
      const expected = base64UrlToBytes(iterationsText);
      const actual = new Uint8Array(await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(password),
      ));
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  const iterations = Number(iterationsText);
  if (algorithm !== 'pbkdf2_sha256' || !Number.isInteger(iterations) || iterations < 100_000) {
    return false;
  }

  try {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const expected = base64UrlToBytes(expectedText);
    const derived = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64UrlToBytes(saltText).buffer as ArrayBuffer,
      iterations,
    }, passwordKey, expected.length * 8);
    return timingSafeEqual(new Uint8Array(derived), expected);
  } catch {
    return false;
  }
}

export async function hashPassword(password: string, iterations = 100_000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations,
  }, passwordKey, 256);
  return `pbkdf2_sha256$${iterations}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(derived))}`;
}

export async function issueSessionToken(
  sessionSecret: string,
  teacher: Omit<TeacherSession, 'exp'>,
): Promise<string> {
  const payload: TeacherSession = {
    ...teacher,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payloadText = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importHmacKey(sessionSecret),
    new TextEncoder().encode(payloadText),
  );
  return `${payloadText}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  sessionSecret: string,
  token: string,
): Promise<TeacherSession | null> {
  const [payloadText, signatureText, extra] = token.split('.');
  if (!payloadText || !signatureText || extra) return null;

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await importHmacKey(sessionSecret),
      base64UrlToBytes(signatureText).buffer as ArrayBuffer,
      new TextEncoder().encode(payloadText),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payloadText)),
    ) as TeacherSession;
    if (
      !payload.sub
      || !payload.username
      || !payload.displayName
      || !Number.isFinite(payload.exp)
      || payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie') || '';
  for (const cookie of cookieHeader.split(';')) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === SESSION_COOKIE) return valueParts.join('=') || null;
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
