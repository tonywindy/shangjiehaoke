const BASE_PATH = import.meta.env.BASE_URL || '/';

export const withBasePath = (path = '') => {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || /^(?:mailto:|tel:|#)/i.test(path)) {
    return path;
  }

  const normalizedPath = String(path).replace(/^\/+/, '');
  return normalizedPath ? `${BASE_PATH}${normalizedPath}` : BASE_PATH;
};

export const routerBasename = BASE_PATH === '/' ? undefined : BASE_PATH.replace(/\/$/, '');
