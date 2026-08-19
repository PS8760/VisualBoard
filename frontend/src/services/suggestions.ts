import type { BoardElement, Suggestion } from '../types';

const labelOf = (el: BoardElement): string => el.content.toLowerCase();
const anyMatch = (els: BoardElement[], re: RegExp) => els.some((el) => re.test(labelOf(el)));

export function evaluateSuggestions(elements: BoardElement[]): Suggestion[] {
  if (!elements.length) return [];

  const nodes = elements.filter((el) =>
    ['rect', 'circle', 'sticky', 'text', 'document'].includes(el.kind),
  );
  const labels = nodes.map((el) => labelOf(el)).join(' ');

  const hasBackend = /api|gateway|backend|service/.test(labels);
  const hasFrontend = /frontend|client|web|app/.test(labels);
  const hasDatabase = /database|db|postgres|mysql|mongo/.test(labels);
  const hasAuth = /auth|oauth|jwt|sso|login/.test(labels);
  const hasCache = /cache|redis|memcached/.test(labels);
  const hasQueue = /queue|kafka|rabbit|worker/.test(labels);
  const hasMonitoring = /monitor|observability|grafana|metrics|logging/.test(labels);

  const suggestions: Suggestion[] = [];
  const from = nodes[0]?.content ?? 'System';
  const to = nodes[1]?.content ?? 'Data';

  if (hasFrontend && hasBackend && !hasAuth) {
    suggestions.push({
      id: 'sg_auth', kind: 'auth', title: 'Add authentication layer',
      detail: 'Protect the API behind token-based auth before exposing it.',
      icon: 'key', target: { from: 'Frontend', to: 'API' },
    });
  }

  if (hasBackend && !hasCache && hasDatabase) {
    suggestions.push({
      id: 'sg_cache', kind: 'cache', title: 'Add caching',
      detail: 'Frequently read data could sit behind a cache to cut latency.',
      icon: 'zap', target: { from: 'API', to: 'Database' },
    });
  }

  if (hasBackend && !hasQueue && anyMatch(elements, /worker|email|notif|async|import|export/)) {
    suggestions.push({
      id: 'sg_queue', kind: 'queue', title: 'Consider a message queue',
      detail: 'Async work between services stays reliable with a queue.',
      icon: 'route', target: { from: 'API', to: 'Queue' },
    });
  }

  if ((hasBackend || hasDatabase) && !hasMonitoring) {
    suggestions.push({
      id: 'sg_monitoring', kind: 'monitoring', title: 'Add monitoring',
      detail: 'Logs, metrics and tracing make production behaviour visible.',
      icon: 'activity', target: { from, to },
    });
  }

  if (hasDatabase && !hasBackend) {
    suggestions.push({
      id: 'sg_gateway', kind: 'gateway', title: 'Route through a gateway',
      detail: 'A single entry point keeps clients simple and traffic centralised.',
      icon: 'shield', target: { from: 'Client', to: 'Database' },
    });
  }

  return suggestions;
}
