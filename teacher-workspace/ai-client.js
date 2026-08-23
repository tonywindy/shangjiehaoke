import { workspaceApi } from './api-client.js';

export function isAdminAiUser() {
  const access = window.TeacherWorkspaceAccess;
  return Boolean(
    access?.isAuthorized
    && access.session?.authenticated
    && access.session.user?.role === 'admin'
    && !access.session.user?.mustChangePassword,
  );
}

export function createStudentMask(students = []) {
  const mappings = students.slice(0, 80).map((student, index) => ({
    token: `学生${String(index + 1).padStart(2, '0')}`,
    id: student.id,
    name: String(student.name || '').trim(),
  })).filter((item) => item.name);
  const byToken = new Map(mappings.map((item) => [item.token, item]));
  const byId = new Map(mappings.map((item) => [item.id, item]));

  function maskText(value = '') {
    let output = String(value || '');
    [...mappings].sort((left, right) => right.name.length - left.name.length).forEach((item) => {
      output = output.split(item.name).join(item.token);
    });
    return output;
  }

  function unmaskText(value = '') {
    let output = String(value || '');
    [...mappings].sort((left, right) => right.token.length - left.token.length).forEach((item) => {
      output = output.split(item.token).join(item.name);
    });
    return output;
  }

  function tokensForIds(ids = []) {
    return ids.map((id) => byId.get(id)?.token).filter(Boolean);
  }

  function studentsForTokens(tokens = []) {
    const seen = new Set();
    return tokens.map((token) => byToken.get(token)).filter((item) => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  return {
    mappings,
    studentTokens: mappings.map((item) => item.token),
    maskText,
    unmaskText,
    tokensForIds,
    studentsForTokens,
  };
}

export async function runAdminAi(feature, payload) {
  if (!isAdminAiUser()) {
    const error = new Error('AI功能目前仅对管理员账号开放。');
    error.code = 'ADMIN_REQUIRED';
    throw error;
  }
  const response = await workspaceApi(`/admin/ai/${feature}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    ...response.result,
    _meta: { provider: response.provider, model: response.model },
  };
}
