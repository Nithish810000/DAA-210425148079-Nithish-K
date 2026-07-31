const SAMPLE_EDGES = [
  { from: 0, to: 1, weight: 4 },
  { from: 0, to: 2, weight: 1 },
  { from: 1, to: 3, weight: 1 },
  { from: 2, to: 1, weight: 2 },
  { from: 2, to: 3, weight: 5 },
  { from: 3, to: 4, weight: 3 },
  { from: 4, to: 5, weight: 2 }
];

let edges = SAMPLE_EDGES.map(edge => ({ ...edge }));
let lastResult = null;

const elements = typeof document === "undefined" ? null : {
  edgeForm: document.querySelector("#edgeForm"),
  fromInput: document.querySelector("#fromInput"),
  toInput: document.querySelector("#toInput"),
  weightInput: document.querySelector("#weightInput"),
  sourceInput: document.querySelector("#sourceInput"),
  formMessage: document.querySelector("#formMessage"),
  resetButton: document.querySelector("#resetButton"),
  runButton: document.querySelector("#runButton"),
  edgeList: document.querySelector("#edgeList"),
  edgeCount: document.querySelector("#edgeCount"),
  resultStatus: document.querySelector("#resultStatus"),
  vertexMetric: document.querySelector("#vertexMetric"),
  edgeMetric: document.querySelector("#edgeMetric"),
  visitedMetric: document.querySelector("#visitedMetric"),
  graphBoard: document.querySelector("#graphBoard"),
  resultBody: document.querySelector("#resultBody"),
  traceList: document.querySelector("#traceList")
};

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;

    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent][0] <= this.items[index][0]) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  pop() {
    if (!this.items.length) return null;
    if (this.items.length === 1) return this.items.pop();

    const root = this.items[0];
    this.items[0] = this.items.pop();
    let index = 0;

    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;

      if (left < this.items.length && this.items[left][0] < this.items[smallest][0]) {
        smallest = left;
      }
      if (right < this.items.length && this.items[right][0] < this.items[smallest][0]) {
        smallest = right;
      }
      if (smallest === index) break;

      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }

    return root;
  }

  get size() {
    return this.items.length;
  }
}

function getVertexCount(edgeList, source = 0) {
  const highestVertex = edgeList.reduce(
    (highest, edge) => Math.max(highest, edge.from, edge.to),
    source
  );
  return highestVertex + 1;
}

function buildGraph(edgeList, source = 0) {
  const vertexCount = getVertexCount(edgeList, source);
  const graph = Array.from({ length: vertexCount }, () => []);

  edgeList.forEach(edge => {
    graph[edge.from].push({ vertex: edge.to, weight: edge.weight });
  });

  return graph;
}

function dijkstra(graph, source) {
  const distances = Array(graph.length).fill(Infinity);
  const previous = Array(graph.length).fill(null);
  const visited = new Set();
  const trace = [];
  const queue = new MinHeap();

  distances[source] = 0;
  queue.push([0, source]);

  while (queue.size) {
    const [currentDistance, vertex] = queue.pop();
    if (visited.has(vertex)) continue;

    visited.add(vertex);
    trace.push({
      type: "visit",
      message: `Visit vertex ${vertex}; its shortest distance is now ${formatDistance(currentDistance)}.`
    });

    graph[vertex].forEach(edge => {
      const candidate = currentDistance + edge.weight;

      if (candidate < distances[edge.vertex]) {
        const oldDistance = distances[edge.vertex];
        distances[edge.vertex] = candidate;
        previous[edge.vertex] = vertex;
        queue.push([candidate, edge.vertex]);
        trace.push({
          type: "relax",
          message:
            `Relax ${vertex} → ${edge.vertex} (weight ${formatDistance(edge.weight)}): ` +
            `${formatDistance(oldDistance)} becomes ${formatDistance(candidate)}.`
        });
      }
    });
  }

  return { distances, previous, visited, trace };
}

function reconstructPath(previous, source, target) {
  const path = [];
  let current = target;

  while (current !== null) {
    path.push(current);
    current = previous[current];
  }

  path.reverse();
  return path[0] === source ? path : [];
}

function formatDistance(distance) {
  if (!Number.isFinite(distance)) return "∞";
  return Number.isInteger(distance)
    ? String(distance)
    : distance.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function renderEdges() {
  elements.edgeList.replaceChildren(
    ...edges.map((edge, index) => {
      const item = document.createElement("div");
      item.className = "edge-item";
      item.innerHTML = `
        <span>${edge.from} <b class="edge-arrow">→</b> ${edge.to}</span>
        <span class="edge-weight">weight ${formatDistance(edge.weight)}</span>
      `;

      const removeButton = document.createElement("button");
      removeButton.className = "remove-edge";
      removeButton.type = "button";
      removeButton.setAttribute("aria-label", `Remove edge ${edge.from} to ${edge.to}`);
      removeButton.textContent = "×";
      removeButton.addEventListener("click", () => {
        edges.splice(index, 1);
        lastResult = null;
        renderAll();
        clearResults("Edge removed — run Dijkstra again");
      });

      item.append(removeButton);
      return item;
    })
  );

  if (!edges.length) {
    const empty = document.createElement("p");
    empty.className = "empty-cell";
    empty.textContent = "No edges yet. Add an edge above.";
    elements.edgeList.append(empty);
  }

  elements.edgeCount.textContent = edges.length;
  elements.edgeMetric.textContent = edges.length;
}

function renderGraph(result = null, source = Number(elements.sourceInput.value) || 0) {
  const vertexCount = getVertexCount(edges, source);
  elements.vertexMetric.textContent = vertexCount;

  elements.graphBoard.replaceChildren(
    ...Array.from({ length: vertexCount }, (_, vertex) => {
      const card = document.createElement("article");
      card.className = "vertex-card";
      if (vertex === source) card.classList.add("source");
      if (result && !Number.isFinite(result.distances[vertex])) card.classList.add("unreachable");

      const name = document.createElement("strong");
      name.textContent = vertex;
      const distance = document.createElement("small");
      distance.textContent = result
        ? `DIST ${formatDistance(result.distances[vertex])}`
        : `VERTEX ${vertex}`;

      card.append(name, distance);
      return card;
    })
  );
}

function renderResults(result, source) {
  elements.resultBody.innerHTML = result.distances.map((distance, vertex) => {
    const path = reconstructPath(result.previous, source, vertex);
    return `
      <tr>
        <td>${vertex}</td>
        <td>${formatDistance(distance)}</td>
        <td>${path.length ? path.join(" → ") : "No path"}</td>
      </tr>
    `;
  }).join("");

  elements.traceList.innerHTML = result.trace.length
    ? result.trace.map(step => `<li>${step.message}</li>`).join("")
    : '<li class="trace-empty">The source has no outgoing reachable edges.</li>';

  elements.visitedMetric.textContent = result.visited.size;
  elements.resultStatus.textContent = `Shortest paths from vertex ${source}`;
  renderGraph(result, source);
}

function clearResults(message = "Ready to calculate") {
  elements.resultStatus.textContent = message;
  elements.visitedMetric.textContent = "—";
  elements.resultBody.innerHTML =
    '<tr><td colspan="3" class="empty-cell">Run Dijkstra to calculate the paths.</td></tr>';
  elements.traceList.innerHTML =
    '<li class="trace-empty">Run the algorithm to inspect heap visits and successful edge relaxations.</li>';
  renderGraph();
}

function addEdge(event) {
  event.preventDefault();
  elements.formMessage.textContent = "";

  const from = Number(elements.fromInput.value);
  const to = Number(elements.toInput.value);
  const weight = Number(elements.weightInput.value);

  if (!Number.isInteger(from) || from < 0 || !Number.isInteger(to) || to < 0) {
    elements.formMessage.textContent = "Vertices must be non-negative whole numbers.";
    return;
  }

  if (!Number.isFinite(weight) || weight < 0) {
    elements.formMessage.textContent = "Dijkstra requires a non-negative edge weight.";
    return;
  }

  edges.push({ from, to, weight });
  elements.edgeForm.reset();
  elements.fromInput.focus();
  lastResult = null;
  renderAll();
  clearResults(`Edge ${from} → ${to} added`);
}

function runAlgorithm() {
  elements.formMessage.textContent = "";
  const source = Number(elements.sourceInput.value);

  if (!Number.isInteger(source) || source < 0) {
    elements.formMessage.textContent = "Source must be a non-negative whole number.";
    return;
  }

  const graph = buildGraph(edges, source);
  lastResult = dijkstra(graph, source);
  renderResults(lastResult, source);
}

function resetSample() {
  edges = SAMPLE_EDGES.map(edge => ({ ...edge }));
  elements.edgeForm.reset();
  elements.sourceInput.value = "0";
  elements.formMessage.textContent = "";
  lastResult = null;
  renderAll();
  clearResults();
}

function renderAll() {
  renderEdges();
  renderGraph(lastResult);
}

globalThis.dijkstra = dijkstra;
globalThis.reconstructPath = reconstructPath;
globalThis.buildGraph = buildGraph;

if (elements) {
  elements.edgeForm.addEventListener("submit", addEdge);
  elements.runButton.addEventListener("click", runAlgorithm);
  elements.resetButton.addEventListener("click", resetSample);
  elements.sourceInput.addEventListener("change", () => {
    lastResult = null;
    clearResults("Source changed — run Dijkstra again");
  });

  resetSample();
}
