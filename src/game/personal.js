const NAME_KEY = 'disc-it:name';
const BESTS_KEY = 'disc-it:bests';

// Browser storage can be missing, blocked or corrupt; this never throws.
export function createPersonalStore(storage = globalThis.localStorage) {
  const read = key => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
  const write = (key, value) => { try { storage?.setItem(key, value); } catch { /* ignore */ } };
  const readBests = () => {
    try {
      const parsed = JSON.parse(read(BESTS_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  };
  const keyOf = (course, format) => `${course}:${format}`;

  return {
    getName: () => read(NAME_KEY),
    setName: name => write(NAME_KEY, name),
    getBest: (course, format) => readBests()[keyOf(course, format)] ?? null,
    // Stores the best; returns true only when it beat an existing best.
    recordBest(course, format, parDiff) {
      const bests = readBests();
      const prev = bests[keyOf(course, format)];
      if (prev !== undefined && parDiff >= prev) return false;
      bests[keyOf(course, format)] = parDiff;
      write(BESTS_KEY, JSON.stringify(bests));
      return prev !== undefined;
    },
  };
}
