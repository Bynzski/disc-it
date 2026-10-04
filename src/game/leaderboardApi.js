export async function fetchBoard(course, format, { signal } = {}) {
  const res = await fetch(`${import.meta.env?.BASE_URL ?? '/'}api/leaderboard?course=${course}&format=${format}&limit=10`, { signal });
  if (!res.ok) throw Object.assign(new Error(`leaderboard ${res.status}`), { status: res.status });
  return (await res.json()).rows;
}

export async function submitRun({ name, course, format, holes }) {
  const res = await fetch(`${import.meta.env?.BASE_URL ?? '/'}api/rounds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, course, format, holes }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `submit ${res.status}`), { status: res.status });
  }
  return res.json();
}
