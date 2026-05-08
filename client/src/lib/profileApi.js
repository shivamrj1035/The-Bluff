const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || '').replace(/\/$/, '');

function buildUrl(path) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

async function requestProfile({ token, profile }) {
  const response = await fetch(buildUrl('/api/profile'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(profile || {}),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || 'Unable to sync profile');
  }

  return response.json();
}

export async function syncProfile(token, profile) {
  return requestProfile({ token, profile });
}
