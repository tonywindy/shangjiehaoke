const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const API_HOSTNAME = typeof location === 'undefined' ? 'localhost' : location.hostname;
const API_ORIGIN = LOCAL_HOSTS.has(API_HOSTNAME) ? '' : 'https://api.shangjiehaoke.com';

export function workspaceApiUrl(path) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}/api/workspace${suffix}`;
}

export async function workspaceApi(path, options = {}) {
  const response = await fetch(workspaceApiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({
    ok: false,
    message: '服务返回了无法识别的内容。',
  }));
  if (!response.ok) {
    const error = new Error(data.message || '操作失败，请稍后重试。');
    error.code = data.code;
    throw error;
  }
  return data;
}
