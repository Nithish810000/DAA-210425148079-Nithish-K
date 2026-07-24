const $ = (id) => document.getElementById(id);

const nodes = [
  { id: 0, x: .12, y: .33 }, { id: 1, x: .34, y: .15 },
  { id: 2, x: .65, y: .16 }, { id: 3, x: .28, y: .57 },
  { id: 4, x: .58, y: .44 }, { id: 5, x: .47, y: .79 },
  { id: 6, x: .82, y: .70 }
];

const edges = [
  { w: 7, u: 0, v: 1 }, { w: 5, u: 0, v: 3 }, { w: 8, u: 1, v: 2 },
  { w: 9, u: 1, v: 3 }, { w: 7, u: 1, v: 4 }, { w: 5, u: 2, v: 4 },
  { w: 15, u: 3, v: 4 }, { w: 6, u: 3, v: 5 }, { w: 8, u: 4, v: 5 },
  { w: 9, u: 4, v: 6 }, { w: 11, u: 5, v: 6 }
].map((edge, id) => ({ ...edge, id }));

const finalMstIds = new Set([1, 5, 7, 0, 4, 9]);

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }
  find(x) {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(x, y) {
    let rx = this.find(x);
    let ry = this.find(y);
    if (rx === ry) return false;
    if (this.rank[rx] < this.rank[ry]) [rx, ry] = [ry, rx];
    this.parent[ry] = rx;
    if (this.rank[rx] === this.rank[ry]) this.rank[rx] += 1;
    return true;
  }
}

function kruskalSteps() {
  const uf = new UnionFind(nodes.length);
  const sorted = [...edges].sort((a, b) => a.w - b.w || a.id - b.id);
  const accepted = [];
  let cost = 0;
  return sorted.map((edge) => {
    const take = uf.union(edge.u, edge.v);
    if (take) {
      accepted.push(edge);
      cost += edge.w;
    }
    return {
      edge, accepted: [...accepted], cost,
      status: take ? 'accepted' : 'rejected',
      title: take ? `Accept ${edge.u}—${edge.v}` : `Reject ${edge.u}—${edge.v}`,
      text: take
        ? `Weight ${edge.w} connects two separate components, so the edge joins the growing MST.`
        : `The endpoints are already connected. Adding weight ${edge.w} would create a cycle.`
    };
  });
}

function primSteps(start) {
  const visited = new Set([start]);
  const accepted = [];
  const steps = [];
  let cost = 0;
  let frontier = edges.filter((edge) => edge.u === start || edge.v === start);

  while (visited.size < nodes.length && frontier.length) {
    frontier.sort((a, b) => a.w - b.w || a.id - b.id);
    const edge = frontier.shift();
    const uSeen = visited.has(edge.u);
    const vSeen = visited.has(edge.v);
    if (uSeen && vSeen) continue;
    const next = uSeen ? edge.v : edge.u;
    visited.add(next);
    accepted.push(edge);
    cost += edge.w;
    steps.push({
      edge, accepted: [...accepted], cost, status: 'accepted',
      title: `Grow to vertex ${next}`,
      text: `Edge ${edge.u}—${edge.v} is the lightest frontier edge. Vertex ${next} now joins the tree.`
    });
    frontier.push(...edges.filter((candidate) => {
      const crosses = visited.has(candidate.u) !== visited.has(candidate.v);
      return crosses && !frontier.some((item) => item.id === candidate.id);
    }));
    frontier = frontier.filter((candidate, index, list) =>
      visited.has(candidate.u) !== visited.has(candidate.v) &&
      list.findIndex((item) => item.id === candidate.id) === index
    );
  }
  return steps;
}

let algorithm = 'kruskal';
let steps = kruskalSteps();
let stepIndex = 0;
let autoplay = null;

function canvasSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

function drawGraph(canvas, options = {}) {
  const { context: ctx, width, height } = canvasSize(canvas);
  const acceptedIds = new Set((options.accepted || []).map((edge) => edge.id));
  const currentId = options.current?.id;
  const rejected = options.status === 'rejected';
  const hero = options.hero;
  const padX = hero ? 30 : 24;
  const padY = hero ? 25 : 18;
  const point = (node) => ({
    x: padX + node.x * (width - padX * 2),
    y: padY + node.y * (height - padY * 2)
  });
  ctx.clearRect(0, 0, width, height);

  edges.forEach((edge) => {
    const a = point(nodes[edge.u]);
    const b = point(nodes[edge.v]);
    const accepted = acceptedIds.has(edge.id) || (hero && finalMstIds.has(edge.id));
    const current = currentId === edge.id;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = accepted ? 4 : current ? 4 : 1.5;
    ctx.strokeStyle = accepted
      ? (hero ? '#dfff62' : '#23b877')
      : current ? (rejected ? '#f16f5d' : '#ffc94b')
      : (hero ? '#496057' : '#c3c6be');
    ctx.stroke();

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    ctx.beginPath();
    ctx.arc(mx, my, 10, 0, Math.PI * 2);
    ctx.fillStyle = hero ? '#173128' : '#f7f6f0';
    ctx.fill();
    ctx.fillStyle = accepted && hero ? '#dfff62' : hero ? '#9cafA5' : '#5e665f';
    ctx.font = `700 10px ${getComputedStyle(document.documentElement).getPropertyValue('--mono')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(edge.w, mx, my);
  });

  nodes.forEach((node) => {
    const p = point(node);
    const selected = options.accepted?.some((edge) => edge.u === node.id || edge.v === node.id);
    ctx.beginPath();
    ctx.arc(p.x, p.y, hero ? 18 : 20, 0, Math.PI * 2);
    ctx.fillStyle = hero ? '#10231c' : selected ? '#10231c' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = hero ? '#dfff62' : selected ? '#10231c' : '#7f8882';
    ctx.stroke();
    ctx.fillStyle = hero ? '#ffffff' : selected ? '#ffffff' : '#15211c';
    ctx.font = `700 ${hero ? 11 : 12}px ${getComputedStyle(document.documentElement).getPropertyValue('--mono')}`;
    ctx.fillText(node.id, p.x, p.y);
  });
}

function currentState() {
  return stepIndex === 0
    ? { accepted: [], cost: 0 }
    : steps[Math.min(stepIndex - 1, steps.length - 1)];
}

function render() {
  const state = currentState();
  const current = stepIndex ? steps[stepIndex - 1] : null;
  drawGraph($('graphCanvas'), {
    accepted: state.accepted,
    current: current?.edge,
    status: current?.status
  });
  $('traceCounter').textContent = `STEP ${stepIndex} / ${steps.length}`;
  $('selectedCount').textContent = `${state.accepted.length} / 6`;
  $('currentCost').textContent = state.cost;
  $('selectedEdges').innerHTML = state.accepted.length
    ? state.accepted.map((edge) => `<div class="edge-row"><span>${edge.u} — ${edge.v}</span><strong>${edge.w}</strong></div>`).join('')
    : '<p>No edges selected yet.</p>';

  if (!current) {
    $('traceStatus').textContent = 'Ready to begin';
    $('decisionTitle').textContent = algorithm === 'kruskal' ? 'Sort the edges' : `Start at vertex ${$('startVertex').value}`;
    $('decisionText').textContent = algorithm === 'kruskal'
      ? 'Kruskal begins with the smallest edge and uses Union–Find to prevent cycles.'
      : 'Prim begins at one vertex and chooses the lightest edge leaving the current tree.';
  } else {
    $('traceStatus').textContent = current.status === 'accepted' ? 'Edge accepted' : 'Cycle detected';
    $('decisionTitle').textContent = current.title;
    $('decisionText').textContent = current.text;
  }

  const finished = stepIndex >= steps.length;
  if (finished) {
    $('traceStatus').textContent = 'Minimum spanning tree complete';
    $('decisionTitle').textContent = 'Total cost: 39';
    $('decisionText').textContent = 'All 7 vertices are connected with 6 edges and the minimum possible total weight.';
  }
  $('stepBtn').disabled = finished;
  $('finishBtn').disabled = finished;
}

function stopAutoplay() {
  if (autoplay) clearInterval(autoplay);
  autoplay = null;
  $('playBtn').innerHTML = '<span>▶</span> Auto play';
}

function rebuild() {
  stopAutoplay();
  steps = algorithm === 'kruskal' ? kruskalSteps() : primSteps(Number($('startVertex').value));
  stepIndex = 0;
  render();
}

function nextStep() {
  if (stepIndex < steps.length) {
    stepIndex += 1;
    render();
  }
  if (stepIndex >= steps.length) stopAutoplay();
}

document.querySelectorAll('.algorithm-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    algorithm = tab.dataset.algorithm;
    document.querySelectorAll('.algorithm-tab').forEach((item) => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    $('startControl').classList.toggle('disabled', algorithm !== 'prim');
    rebuild();
  });
});

$('stepBtn').addEventListener('click', nextStep);
$('resetBtn').addEventListener('click', rebuild);
$('startVertex').addEventListener('change', rebuild);
$('finishBtn').addEventListener('click', () => {
  stopAutoplay();
  stepIndex = steps.length;
  render();
});
$('playBtn').addEventListener('click', () => {
  if (autoplay) {
    stopAutoplay();
    return;
  }
  if (stepIndex >= steps.length) stepIndex = 0;
  $('playBtn').innerHTML = '<span>Ⅱ</span> Pause';
  nextStep();
  autoplay = setInterval(nextStep, 850);
});

const codeSnippets = {
  union: `# --- Union-Find for Kruskal ---
class UnionFind:
   def __init__(self, n):
       self.parent = list(range(n))
       self.rank   = [0] * n

   def find(self, x):
       if self.parent[x] != x:
           self.parent[x] = self.find(self.parent[x])
       return self.parent[x]

   def union(self, x, y):
       rx, ry = self.find(x), self.find(y)
       if rx == ry:
           return False
       if self.rank[rx] < self.rank[ry]:
           rx, ry = ry, rx
       self.parent[ry] = rx
       if self.rank[rx] == self.rank[ry]:
           self.rank[rx] += 1
       return True`,
  kruskal: `def kruskal(n, edges):
   """edges: list of (weight, u, v)"""
   edges.sort()  # O(E log E)
   uf   = UnionFind(n)
   mst  = []
   cost = 0

   for w, u, v in edges:
       if uf.union(u, v):
           mst.append((u, v, w))
           cost += w
           if len(mst) == n - 1:
               break

   return mst, cost`,
  prim: `def prim(n, adj, start=0):
   """adj: adjacency list {u: [(v, w), ...]}"""
   INF    = float('inf')
   key    = [INF] * n
   parent = [-1] * n
   inMST  = [False] * n
   key[start] = 0
   pq = [(0, start)]
   mst, cost = [], 0

   while pq:
       w, u = heapq.heappop(pq)
       if inMST[u]:
           continue
       inMST[u] = True
       if parent[u] != -1:
           mst.append((parent[u], u, w))
           cost += w
       for v, wt in adj.get(u, []):
           if not inMST[v] and wt < key[v]:
               key[v] = wt
               parent[v] = u
               heapq.heappush(pq, (wt, v))

   return mst, cost`,
  full: `import heapq

# --- Union-Find for Kruskal ---
class UnionFind:
   def __init__(self, n):
       self.parent = list(range(n))
       self.rank   = [0] * n

   def find(self, x):
       if self.parent[x] != x:
           self.parent[x] = self.find(self.parent[x])
       return self.parent[x]

   def union(self, x, y):
       rx, ry = self.find(x), self.find(y)
       if rx == ry: return False
       if self.rank[rx] < self.rank[ry]: rx, ry = ry, rx
       self.parent[ry] = rx
       if self.rank[rx] == self.rank[ry]: self.rank[rx] += 1
       return True

def kruskal(n, edges):
   edges.sort()
   uf, mst, cost = UnionFind(n), [], 0
   for w, u, v in edges:
       if uf.union(u, v):
           mst.append((u, v, w))
           cost += w
           if len(mst) == n - 1: break
   return mst, cost

def prim(n, adj, start=0):
   INF = float('inf')
   key, parent = [INF] * n, [-1] * n
   inMST, key[start] = [False] * n, 0
   pq, mst, cost = [(0, start)], [], 0
   while pq:
       w, u = heapq.heappop(pq)
       if inMST[u]: continue
       inMST[u] = True
       if parent[u] != -1:
           mst.append((parent[u], u, w))
           cost += w
       for v, wt in adj.get(u, []):
           if not inMST[v] and wt < key[v]:
               key[v], parent[v] = wt, u
               heapq.heappush(pq, (wt, v))
   return mst, cost

n = 7
edges = [
   (7, 0, 1), (5, 0, 3), (8, 1, 2), (9, 1, 3),
   (7, 1, 4), (5, 2, 4), (15, 3, 4), (6, 3, 5),
   (8, 4, 5), (9, 4, 6), (11, 5, 6)
]
adj = {}
for w, u, v in edges:
   adj.setdefault(u, []).append((v, w))
   adj.setdefault(v, []).append((u, w))

k_mst, k_cost = kruskal(n, edges[:])
p_mst, p_cost = prim(n, adj)

print("Kruskal:", k_mst, "Cost:", k_cost)
print("Prim:", p_mst, "Cost:", p_cost)`
};

let activeCode = 'union';
function renderCode() {
  const code = codeSnippets[activeCode];
  const lines = code.split('\n');
  $('codeDisplay').textContent = code;
  $('lineNumbers').textContent = lines.map((_, index) => index + 1).join('\n');
  $('lineCount').textContent = `${lines.length} lines`;
}

document.querySelectorAll('.code-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    activeCode = tab.dataset.code;
    document.querySelectorAll('.code-tab').forEach((item) => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    renderCode();
  });
});

$('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(codeSnippets[activeCode]);
    $('copyBtn').textContent = 'Copied ✓';
    setTimeout(() => { $('copyBtn').textContent = 'Copy code'; }, 1500);
  } catch {
    $('copyBtn').textContent = 'Copy unavailable';
  }
});

function drawAll() {
  drawGraph($('heroCanvas'), { hero: true });
  render();
}

window.addEventListener('resize', drawAll);
$('startControl').classList.add('disabled');
renderCode();
drawAll();
