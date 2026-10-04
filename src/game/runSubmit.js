export function createRunSubmitter({ submit, store }) {
  return async function post({ name, course, format, holes, parDiff }) {
    const clean = name.trim();
    store.setName(clean);
    try {
      const { rank } = await submit({ name: clean, course, format, holes });
      return { phase: 'done', rank, newBest: store.recordBest(course, format, parDiff) };
    } catch (err) {
      const message = err.status === 429 ? 'Please wait a moment and try again' : err.message || 'network error';
      return { phase: 'error', message };
    }
  };
}
