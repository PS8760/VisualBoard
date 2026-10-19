import type { BoardElement, Suggestion, SuggestionSeverity } from '../types';
import { bindableAt } from './geometry';
import { isConnectorKind, readConnector } from './connectors/model';

/**
 * Local architecture reviewer. Reads the board as a graph — shapes are
 * components (classified by their labels), connectors are edges — and reports
 * concrete, board-specific findings with an action that can be applied.
 */

export type Role =
  | 'client'
  | 'gateway'
  | 'service'
  | 'auth'
  | 'database'
  | 'cache'
  | 'queue'
  | 'worker'
  | 'monitoring'
  | 'replica';

/** Whole-word (or phrase) vocabularies per role. */
const VOCAB: Record<Role, string[]> = {
  client: ['client', 'clients', 'user', 'users', 'browser', 'frontend', 'front end', 'web', 'web app', 'webapp', 'mobile', 'mobile app', 'app', 'ios', 'android', 'spa', 'ui', 'desktop', 'customer'],
  gateway: ['gateway', 'api gateway', 'proxy', 'reverse proxy', 'nginx', 'envoy', 'kong', 'ingress', 'bff', 'load balancer', 'lb', 'alb', 'elb', 'haproxy'],
  service: ['api', 'apis', 'backend', 'back end', 'service', 'services', 'microservice', 'server', 'lambda', 'function', 'functions', 'endpoint', 'rest', 'graphql', 'grpc'],
  auth: ['auth', 'authentication', 'authorization', 'oauth', 'oidc', 'jwt', 'sso', 'login', 'identity', 'idp', 'keycloak', 'cognito', 'auth0', 'okta', 'iam', 'session', 'sessions'],
  database: ['database', 'databases', 'db', 'postgres', 'postgresql', 'mysql', 'mariadb', 'mongo', 'mongodb', 'sql', 'sqlite', 'dynamodb', 'cassandra', 'supabase', 'firestore', 'datastore', 'rds', 'aurora', 'cockroachdb'],
  cache: ['cache', 'caching', 'redis', 'memcached', 'valkey', 'cdn', 'varnish'],
  queue: ['queue', 'queues', 'kafka', 'rabbitmq', 'rabbit', 'sqs', 'sns', 'pubsub', 'pub sub', 'nats', 'event bus', 'broker', 'message bus', 'stream', 'streams', 'kinesis', 'bullmq'],
  worker: ['worker', 'workers', 'job', 'jobs', 'cron', 'scheduler', 'email', 'emails', 'mailer', 'notification', 'notifications', 'push', 'async', 'batch', 'import', 'export', 'webhook', 'webhooks', 'pipeline'],
  monitoring: ['monitoring', 'monitor', 'observability', 'grafana', 'prometheus', 'metrics', 'logging', 'logs', 'tracing', 'traces', 'sentry', 'datadog', 'new relic', 'alerting', 'alerts', 'opentelemetry', 'otel', 'elk', 'kibana'],
  replica: ['replica', 'replicas', 'replication', 'standby', 'failover', 'backup', 'backups', 'read replica', 'cluster'],
};

const words = (label: string) =>
  ` ${label
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

export function classify(label: string): Role[] {
  const text = words(label);
  if (!text.trim()) return [];
  return (Object.keys(VOCAB) as Role[]).filter((role) => VOCAB[role].some((w) => text.includes(` ${w} `)));
}

const COMPONENT_KINDS = new Set<BoardElement['kind']>(['rect', 'circle']);
const MENTION_KINDS = new Set<BoardElement['kind']>(['rect', 'circle', 'sticky', 'text', 'document']);

export interface Node {
  el: BoardElement;
  label: string;
  roles: Role[];
}
export interface Edge {
  id: string;
  from: string;
  to: string;
}

export interface BoardAnalysis {
  nodes: Node[];
  edges: Edge[];
  /** Connectors with at least one end not touching a shape. */
  looseEdges: string[];
  suggestions: Suggestion[];
  /** 0–100, or null when there's too little architecture to judge. */
  score: number | null;
}

const SEVERITY_ORDER: Record<SuggestionSeverity, number> = { high: 0, medium: 1, low: 2 };
const SEVERITY_COST: Record<SuggestionSeverity, number> = { high: 18, medium: 9, low: 4 };

const quote = (s: string) => `“${s.length > 28 ? `${s.slice(0, 27)}…` : s}”`;
const list = (names: string[]) => {
  const q = names.map(quote);
  return q.length <= 2 ? q.join(' and ') : `${q.slice(0, -1).join(', ')} and ${q[q.length - 1]}`;
};
const idOf = (kind: string, ids: string[]) => `${kind}:${[...ids].sort().join(',')}`;

export function analyzeBoard(elements: BoardElement[]): BoardAnalysis {
  const nodes: Node[] = elements
    .filter((el) => COMPONENT_KINDS.has(el.kind))
    .map((el) => ({ el, label: (el.content ?? '').trim(), roles: classify(el.content ?? '') }));
  const byId = new Map(nodes.map((n) => [n.el.id, n]));

  // Anything written anywhere (notes, docs, text) can satisfy "is X planned?".
  const mentioned = new Set<Role>();
  for (const el of elements) if (MENTION_KINDS.has(el.kind)) for (const r of classify(el.content ?? '')) mentioned.add(r);

  // Edges: bound ends first, otherwise whatever shape the end point touches.
  const shapes = elements.filter((el) => COMPONENT_KINDS.has(el.kind));
  const edges: Edge[] = [];
  const looseEdges: string[] = [];
  for (const el of elements) {
    if (!isConnectorKind(el.kind)) continue;
    const m = readConnector(el);
    const resolve = (end: typeof m.start) =>
      end.elementId && byId.has(end.elementId) ? end.elementId : bindableAt(shapes, end.point, 12)?.id;
    const from = resolve(m.start);
    const to = resolve(m.end);
    if (from && to && from !== to) edges.push({ id: el.id, from, to });
    else looseEdges.push(el.id);
  }

  const has = (n: Node, r: Role) => n.roles.includes(r);
  const any = (r: Role) => mentioned.has(r);
  const isServer = (n: Node) => (has(n, 'service') || has(n, 'gateway')) && !has(n, 'database');
  const clients = nodes.filter((n) => has(n, 'client') && !isServer(n) && !has(n, 'database'));
  const servers = nodes.filter(isServer);
  const databases = nodes.filter((n) => has(n, 'database') && !has(n, 'cache'));
  const out: Suggestion[] = [];

  // 1. Clients talking straight to a database.
  const directDb = edges.filter((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    return (clients.includes(a) && databases.includes(b)) || (clients.includes(b) && databases.includes(a));
  });
  if (directDb.length) {
    const ids = [...new Set(directDb.flatMap((e) => [e.from, e.to]))];
    const cs = ids.map((id) => byId.get(id)!).filter((n) => clients.includes(n));
    const ds = ids.map((id) => byId.get(id)!).filter((n) => databases.includes(n));
    out.push({
      id: idOf('direct-db', directDb.map((e) => e.id)),
      kind: 'direct-db', category: 'security', severity: 'high',
      title: `${quote(cs[0]!.label || 'Client')} talks directly to ${quote(ds[0]!.label || 'the database')}`,
      detail: 'Put an API between clients and data so credentials, validation and access rules live on the server.',
      why: `${list(cs.map((n) => n.label || 'Client'))} ${cs.length > 1 ? 'connect' : 'connects'} straight to ${list(ds.map((n) => n.label || 'database'))}. Anyone with the app could read or change any row.`,
      elementIds: ids,
      action: { type: 'route-through', edgeIds: directDb.map((e) => e.id), label: 'API', sub: 'validates & authorizes' },
      actionLabel: 'Insert API layer',
    });
  }

  // 2. A client reaches a server but nothing handles auth.
  const clientToServer = edges.filter((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    return (clients.includes(a) && servers.includes(b)) || (clients.includes(b) && servers.includes(a));
  });
  if (clients.length && servers.length && !any('auth')) {
    const entry = clientToServer.length ? byId.get(servers.find((s) => clientToServer.some((e) => e.from === s.el.id || e.to === s.el.id))!.el.id)! : servers[0]!;
    out.push({
      id: idOf('auth', [entry.el.id]),
      kind: 'auth', category: 'security', severity: clientToServer.length ? 'high' : 'medium',
      title: `Protect ${quote(entry.label || 'the API')} with authentication`,
      detail: 'Verify who is calling before requests reach your services — tokens (JWT/OAuth) or sessions.',
      why: `${list(clients.map((n) => n.label || 'Client'))} ${clientToServer.length ? 'call' : 'sit next to'} ${quote(entry.label || 'API')}, and nothing on the board handles sign-in or tokens.`,
      elementIds: [...clients.map((n) => n.el.id), entry.el.id],
      action: { type: 'add-node', label: 'Auth', sub: 'JWT · OAuth', linkTo: entry.el.id, near: [entry.el.id] },
      actionLabel: 'Add auth service',
    });
  }

  // 3. Several services exposed to clients without a single entry point.
  const exposed = [...new Set(clientToServer.map((e) => (servers.some((s) => s.el.id === e.to) ? e.to : e.from)))]
    .map((id) => byId.get(id)!)
    .filter((n) => !has(n, 'gateway'));
  if (exposed.length >= 2 && !any('gateway')) {
    const routed = clientToServer.filter((e) => exposed.some((n) => n.el.id === e.from || n.el.id === e.to));
    out.push({
      id: idOf('gateway', routed.map((e) => e.id)),
      kind: 'gateway', category: 'structure', severity: 'medium',
      title: `Route ${exposed.length} services through one gateway`,
      detail: 'A gateway gives clients a single entry point for auth, rate limiting and versioning.',
      why: `Clients connect separately to ${list(exposed.map((n) => n.label || 'service'))}.`,
      elementIds: [...new Set(routed.flatMap((e) => [e.from, e.to]))],
      action: { type: 'route-through', edgeIds: routed.map((e) => e.id), label: 'API Gateway', sub: 'single entry point' },
      actionLabel: 'Insert gateway',
    });
  }

  // 4. Service → database reads with no cache in sight.
  if (!any('cache')) {
    const reads = edges.filter((e) => {
      const a = byId.get(e.from)!;
      const b = byId.get(e.to)!;
      return (servers.includes(a) && databases.includes(b)) || (servers.includes(b) && databases.includes(a));
    });
    if (reads.length) {
      const e = reads[0]!;
      const svc = servers.includes(byId.get(e.from)!) ? byId.get(e.from)! : byId.get(e.to)!;
      const db = svc.el.id === e.from ? byId.get(e.to)! : byId.get(e.from)!;
      out.push({
        id: idOf('cache', [e.id]),
        kind: 'cache', category: 'performance', severity: 'medium',
        title: `Cache reads between ${quote(svc.label || 'API')} and ${quote(db.label || 'database')}`,
        detail: 'Hot reads served from memory cut latency and take load off the database.',
        why: `Every request from ${quote(svc.label || 'API')} goes to ${quote(db.label || 'the database')}${reads.length > 1 ? `, and ${reads.length - 1} more service link${reads.length > 2 ? 's do' : ' does'} the same` : ''}.`,
        elementIds: [svc.el.id, db.el.id],
        action: { type: 'route-through', edgeIds: [e.id], label: 'Cache', sub: 'Redis' },
        actionLabel: 'Insert cache',
      });
    }
  }

  // 5. Async work without a queue.
  const workers = nodes.filter((n) => has(n, 'worker') && !has(n, 'queue'));
  if (workers.length && !any('queue')) {
    const w = workers[0]!;
    const inbound = edges.find((e) => e.to === w.el.id && servers.some((s) => s.el.id === e.from));
    const source = inbound ? byId.get(inbound.from)! : servers[0];
    out.push({
      id: idOf('queue', [w.el.id]),
      kind: 'queue', category: 'reliability', severity: 'medium',
      title: `Hand off ${quote(w.label)} through a queue`,
      detail: 'A queue absorbs spikes and retries failed jobs instead of losing them.',
      why: source
        ? `${quote(source.label || 'API')} ${inbound ? 'calls' : 'would call'} ${quote(w.label)} directly — if it is slow or down, requests fail.`
        : `${quote(w.label)} does background work but nothing buffers it.`,
      elementIds: source ? [source.el.id, w.el.id] : [w.el.id],
      action: inbound
        ? { type: 'route-through', edgeIds: [inbound.id], label: 'Queue', sub: 'retries · backpressure' }
        : { type: 'add-node', label: 'Queue', sub: 'retries · backpressure', linkTo: w.el.id, near: [w.el.id] },
      actionLabel: 'Insert queue',
    });
  }

  // 6. One database shared by many services, no replica or backup.
  if (!any('replica')) {
    for (const db of databases) {
      const users = new Set(edges.filter((e) => e.to === db.el.id || e.from === db.el.id).map((e) => (e.to === db.el.id ? e.from : e.to)));
      if (users.size < 3) continue;
      out.push({
        id: idOf('spof', [db.el.id]),
        kind: 'spof', category: 'reliability', severity: 'medium',
        title: `${quote(db.label || 'Database')} is a single point of failure`,
        detail: 'Add a replica (or at least backups) so one failure doesn’t take everything down.',
        why: `${users.size} components depend on ${quote(db.label || 'it')} and the board shows no replica, standby or backup.`,
        elementIds: [db.el.id, ...users],
        action: { type: 'add-node', label: 'Read replica', sub: 'failover · backups', linkTo: db.el.id, near: [db.el.id] },
        actionLabel: 'Add replica',
      });
      break;
    }
  }

  // 7. A real system with no observability.
  const backendish = nodes.filter((n) => isServer(n) || has(n, 'database') || has(n, 'worker'));
  if (backendish.length >= 3 && !any('monitoring')) {
    out.push({
      id: idOf('monitoring', backendish.map((n) => n.el.id)),
      kind: 'monitoring', category: 'observability', severity: 'low',
      title: 'Add monitoring',
      detail: 'Logs, metrics and traces tell you what broke before users do.',
      why: `${backendish.length} backend components and nothing watching them.`,
      elementIds: backendish.map((n) => n.el.id),
      action: { type: 'add-node', label: 'Monitoring', sub: 'logs · metrics · traces', near: backendish.map((n) => n.el.id) },
      actionLabel: 'Add monitoring',
    });
  }

  // 8. Hygiene.
  if (edges.length && nodes.length >= 3) {
    const connected = new Set(edges.flatMap((e) => [e.from, e.to]));
    const orphans = nodes.filter((n) => !connected.has(n.el.id) && n.label);
    if (orphans.length) {
      out.push({
        id: idOf('orphan', orphans.map((n) => n.el.id)),
        kind: 'orphan', category: 'structure', severity: 'low',
        title: orphans.length === 1 ? `${quote(orphans[0]!.label)} isn’t connected` : `${orphans.length} shapes aren’t connected`,
        detail: 'Connect them to show how they fit — or remove them if they’re leftovers.',
        why: `${list(orphans.map((n) => n.label))} ${orphans.length === 1 ? 'has' : 'have'} no arrows in or out.`,
        elementIds: orphans.map((n) => n.el.id),
        action: { type: 'select', ids: orphans.map((n) => n.el.id) },
        actionLabel: 'Show',
      });
    }
  }
  const unlabeled = nodes.filter((n) => !n.label);
  if (unlabeled.length) {
    out.push({
      id: idOf('unlabeled', unlabeled.map((n) => n.el.id)),
      kind: 'unlabeled', category: 'structure', severity: 'low',
      title: unlabeled.length === 1 ? 'Name the unlabeled shape' : `Name ${unlabeled.length} unlabeled shapes`,
      detail: 'Labels make the diagram readable — and let these suggestions understand it.',
      why: `${unlabeled.length} shape${unlabeled.length === 1 ? ' has' : 's have'} no text.`,
      elementIds: unlabeled.map((n) => n.el.id),
      action: { type: 'select', ids: unlabeled.map((n) => n.el.id) },
      actionLabel: 'Show',
    });
  }
  if (looseEdges.length) {
    out.push({
      id: idOf('loose-arrow', looseEdges),
      kind: 'loose-arrow', category: 'structure', severity: 'low',
      title: looseEdges.length === 1 ? 'Attach a loose arrow' : `Attach ${looseEdges.length} loose arrows`,
      detail: 'Drag each end onto a shape so the arrow follows it when things move.',
      why: `${looseEdges.length} connector${looseEdges.length === 1 ? ' has an end' : 's have ends'} pointing at empty canvas.`,
      elementIds: looseEdges,
      action: { type: 'select', ids: looseEdges },
      actionLabel: 'Show',
    });
  }
  const byLabel = new Map<string, Node[]>();
  for (const n of nodes) if (n.label) byLabel.set(n.label.toLowerCase(), [...(byLabel.get(n.label.toLowerCase()) ?? []), n]);
  const dupes = [...byLabel.values()].filter((g) => g.length > 1);
  if (dupes.length) {
    const ids = dupes.flat().map((n) => n.el.id);
    out.push({
      id: idOf('duplicate', ids),
      kind: 'duplicate', category: 'structure', severity: 'low',
      title: dupes.length === 1 ? `${quote(dupes[0]![0]!.label)} appears ${dupes[0]!.length} times` : `${dupes.length} labels are duplicated`,
      detail: 'Merge duplicates or name them apart (e.g. “Orders API”, “Users API”).',
      why: `Repeated: ${list(dupes.map((g) => g[0]!.label))}.`,
      elementIds: ids,
      action: { type: 'select', ids },
      actionLabel: 'Show',
    });
  }

  out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const score = nodes.length < 2 ? null : Math.max(0, 100 - out.reduce((sum, s) => sum + SEVERITY_COST[s.severity], 0));
  return { nodes, edges, looseEdges, suggestions: out, score };
}

export function evaluateSuggestions(elements: BoardElement[]): Suggestion[] {
  return analyzeBoard(elements).suggestions;
}
