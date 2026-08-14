function formatDate(date) {
  // Respeita o idioma do usuário via Intl; fallback manual DD/MM/YYYY HH:MM.
  try {
    return new Intl.DateTimeFormat(navigator.language || "pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch (e) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
}

// Acessa uma propriedade aninhada com segurança, sem lançar exceção.
// safeGet(obj, "a.b.c", fallback) ou safeGet(obj, ["a", "b", "c"], fallback)
function safeGet(obj, path, defaultValue = null) {
  if (obj == null) return defaultValue;
  const keys = Array.isArray(path) ? path : String(path).split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null) return defaultValue;
    current = current[key];
  }
  return current === undefined ? defaultValue : current;
}

// Executa fn apenas depois de wait ms sem novas chamadas.
function debounce(fn, wait = 300) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}

// Limita fn a no máximo uma execução a cada wait ms.
function throttle(fn, wait = 300) {
  let last = 0;
  let timer = null;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn.apply(this, args);
      }, remaining);
    }
  };
}

// Cache em memória com expiração por TTL (ms).
// get() retorna undefined quando a chave não existe ou expirou.
class TTLCache {
  constructor(ttlMs) {
    this.ttl = ttlMs;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts >= this.ttl) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this.map.set(key, { ts: Date.now(), value });
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}
