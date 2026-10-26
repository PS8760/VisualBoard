import { describe, expect, it } from 'vitest';
import { analyzeBoard, classify, evaluateSuggestions } from '../src/services/suggestions';
import { planSuggestion } from '../src/services/suggestionActions';
import type { BoardElement } from '../src/types';

let n = 0;
const shape = (content: string, x: number, y: number, extra: Partial<BoardElement> = {}): BoardElement => ({
  id: extra.id ?? `s${++n}`, kind: 'rect', x, y, width: 160, height: 60, rotation: 0, fill: '#fafaf8',
  stroke: '#c2c0b5', strokeWidth: 1.5, content, version: 1, ...extra,
});
const arrow = (a: BoardElement, b: BoardElement, extra: Partial<BoardElement> = {}): BoardElement => ({
  id: extra.id ?? `a${++n}`, kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0, fill: 'transparent',
  stroke: '#a8a69c', strokeWidth: 1.5, content: '', version: 1, pointsAbsolute: true,
  points: [a.x + a.width, a.y + 30, b.x, b.y + 30],
  startBinding: { elementId: a.id }, endBinding: { elementId: b.id }, ...extra,
});
const kinds = (els: BoardElement[]) => evaluateSuggestions(els).map((s) => s.kind);

describe('classify', () => {
  it('matches whole words, not substrings', () => {
    expect(classify('Happy path notes')).not.toContain('client');
    expect(classify('Web App')).toContain('client');
    expect(classify('Postgres')).toContain('database');
    expect(classify('dbt models')).not.toContain('database');
    expect(classify('API Gateway')).toEqual(expect.arrayContaining(['gateway', 'service']));
    expect(classify('Auth Service')).toContain('auth');
    expect(classify('Redis')).toContain('cache');
    expect(classify('Kafka')).toContain('queue');
    expect(classify('Email worker')).toContain('worker');
  });
});

describe('graph analysis', () => {
  it('resolves bound and legacy unbound arrows to the shapes they touch', () => {
    const c = shape('Client', 0, 0);
    const api = shape('API', 300, 0);
    const db = shape('Database', 600, 0);
    const unbound = arrow(api, db, { startBinding: null, endBinding: null });
    const g = analyzeBoard([c, api, db, arrow(c, api), unbound]);
    expect(g.edges.map((e) => [e.from, e.to])).toEqual([[c.id, api.id], [api.id, db.id]]);
  });
});

describe('rules', () => {
  it('flags a client wired straight to a database as high severity security', () => {
    const c = shape('Mobile app', 0, 0);
    const db = shape('MySQL', 400, 0);
    const out = evaluateSuggestions([c, db, arrow(c, db)]);
    const s = out.find((x) => x.kind === 'direct-db')!;
    expect(s.severity).toBe('high');
    expect(s.category).toBe('security');
    expect(s.elementIds).toEqual(expect.arrayContaining([c.id, db.id]));
    expect(s.title).toContain('Mobile app');
    expect(s.action?.type).toBe('route-through');
  });

  it('asks for auth only when a client reaches a service and nothing handles auth', () => {
    const c = shape('Frontend', 0, 0);
    const api = shape('API', 300, 0);
    expect(kinds([c, api, arrow(c, api)])).toContain('auth');
    expect(kinds([c, api, arrow(c, api), shape('OAuth', 300, 200)])).not.toContain('auth');
  });

  it('suggests a cache on the real service→database edge, named after the real shapes', () => {
    const api = shape('Orders API', 0, 0);
    const db = shape('Postgres', 400, 0);
    const edge = arrow(api, db);
    const s = evaluateSuggestions([api, db, edge]).find((x) => x.kind === 'cache')!;
    expect(s.title).toMatch(/Orders API/);
    expect(s.action).toMatchObject({ type: 'route-through', edgeIds: [edge.id], label: 'Cache' });
    expect(kinds([api, db, edge, shape('Redis', 200, 200)])).not.toContain('cache');
  });

  it('recommends a queue for async work and a replica for a shared database', () => {
    const api = shape('API', 0, 0);
    const mail = shape('Email worker', 400, 0);
    expect(kinds([api, mail, arrow(api, mail)])).toContain('queue');

    const db = shape('Database', 400, 300);
    const svcs = ['Users', 'Orders', 'Billing'].map((l, i) => shape(`${l} service`, i * 250, 0));
    const els = [db, ...svcs, ...svcs.map((s) => arrow(s, db))];
    expect(kinds(els)).toContain('spof');
    expect(kinds([...els, shape('Read replica', 700, 300)])).not.toContain('spof');
  });

  it('reports hygiene issues: unconnected, unlabeled, loose arrows, duplicates', () => {
    const a = shape('API', 0, 0);
    const b = shape('Worker', 300, 0);
    const lonely = shape('Billing', 0, 300);
    const blank = shape('', 300, 300);
    const loose: BoardElement = { ...arrow(a, b), startBinding: null, endBinding: null, points: [900, 900, 1000, 900] };
    const dupe = shape('API', 600, 300);
    const out = kinds([a, b, lonely, blank, dupe, arrow(a, b), loose]);
    expect(out).toEqual(expect.arrayContaining(['orphan', 'unlabeled', 'loose-arrow', 'duplicate']));
  });

  it('ignores sticky notes as components but lets them satisfy a mention', () => {
    const c = shape('Client', 0, 0);
    const api = shape('API', 300, 0);
    const note: BoardElement = { ...shape('TODO: add JWT auth', 0, 300), kind: 'sticky' };
    const out = kinds([c, api, arrow(c, api), note]);
    expect(out).not.toContain('auth');
    expect(out).not.toContain('orphan');
  });

  it('sorts by severity and gives stable ids', () => {
    const c = shape('Client', 0, 0, { id: 'c' });
    const db = shape('Postgres', 400, 0, { id: 'd' });
    const one = evaluateSuggestions([c, db, arrow(c, db, { id: 'e' })]);
    const two = evaluateSuggestions([c, db, arrow(c, db, { id: 'e' })]);
    expect(one.map((s) => s.id)).toEqual(two.map((s) => s.id));
    const order = { high: 0, medium: 1, low: 2 } as const;
    const sev = one.map((s) => order[s.severity]);
    expect(sev).toEqual([...sev].sort());
  });

  it('scores board health', () => {
    expect(analyzeBoard([]).score).toBeNull();
    const api = shape('API', 0, 0);
    const db = shape('Postgres', 400, 0);
    const healthy = [api, db, arrow(api, db), shape('Redis', 200, 200), shape('Prometheus', 500, 200)];
    const cl = shape('Client', -300, 0);
    const risky = [cl, db, arrow(cl, db)];
    expect(analyzeBoard(healthy).score!).toBeGreaterThan(analyzeBoard(risky).score!);
  });
});

describe('planSuggestion', () => {
  it('route-through replaces the edge with two edges through a new node', () => {
    const api = shape('API', 0, 0);
    const db = shape('Postgres', 500, 0);
    const edge = arrow(api, db);
    const s = evaluateSuggestions([api, db, edge]).find((x) => x.kind === 'cache')!;
    const plan = planSuggestion(s, [api, db, edge])!;
    expect(plan.remove).toEqual([edge.id]);
    const node = plan.add.find((e) => e.kind === 'rect')!;
    expect(node.content).toBe('Cache');
    const links = plan.add.filter((e) => e.kind === 'arrow');
    expect(links.map((l) => [l.startBinding?.elementId, l.endBinding?.elementId])).toEqual([
      [api.id, node.id],
      [node.id, db.id],
    ]);
    expect(links[0]!.stroke).toBe(edge.stroke);
    expect(plan.focus).toContain(node.id);
  });

  it('places new nodes clear of existing shapes', () => {
    const api = shape('API', 0, 0);
    const db = shape('Postgres', 200, 0); // too close for a node in between
    const edge = arrow(api, db);
    const s = evaluateSuggestions([api, db, edge]).find((x) => x.kind === 'cache')!;
    const node = planSuggestion(s, [api, db, edge])!.add.find((e) => e.kind === 'rect')!;
    const overlaps = (a: BoardElement, b: BoardElement) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlaps(node, api) || overlaps(node, db)).toBe(false);
  });

  it('shares one hub when routing several edges', () => {
    const c1 = shape('Web', 0, 0);
    const c2 = shape('Mobile', 0, 200);
    const db = shape('Postgres', 600, 100);
    const e1 = arrow(c1, db);
    const e2 = arrow(c2, db);
    const s = evaluateSuggestions([c1, c2, db, e1, e2]).find((x) => x.kind === 'direct-db')!;
    const plan = planSuggestion(s, [c1, c2, db, e1, e2])!;
    expect(plan.remove.sort()).toEqual([e1.id, e2.id].sort());
    const hubs = plan.add.filter((e) => e.kind === 'rect');
    expect(hubs).toHaveLength(1);
    // two inbound links, one shared outbound link to the database
    expect(plan.add.filter((e) => e.kind === 'arrow')).toHaveLength(3);
  });

  it('add-node and focus-only actions', () => {
    const svcs = ['API', 'Orders service', 'Users service'].map((l, i) => shape(l, i * 250, 0));
    const db = shape('Postgres', 250, 200);
    const els = [...svcs, db, ...svcs.map((s) => arrow(s, db))];
    const mon = evaluateSuggestions(els).find((x) => x.kind === 'monitoring')!;
    const plan = planSuggestion(mon, els)!;
    expect(plan.add).toHaveLength(1);
    expect(plan.add[0]!.content).toBe('Monitoring');
    expect(plan.remove).toEqual([]);
  });
});
