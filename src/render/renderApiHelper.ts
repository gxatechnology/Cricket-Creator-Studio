import { getAuthAccessToken } from '../auth/AuthContext';

export function getRenderApiHeaders(customHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(customHeaders || {}) };
  const token = getAuthAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
