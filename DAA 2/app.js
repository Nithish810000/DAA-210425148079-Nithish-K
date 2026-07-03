const defaults = { array: '2, 5, 10, 15, 23, 35, 48, 60, 75, 90, 105, 120', target: 35 };
const $ = id => document.getElementById(id);

function interpolationSearch(arr, target) {
  let low = 0, high = arr.length - 1, comparisons = 0;
  const steps = [];
  while (low <= high && arr[low] <= target && target <= arr[high]) {
    comparisons++;
    if (low === high) {
      steps.push({ low, high, pos: low });
      return { index: arr[low] === target ? low : -1, comparisons, steps };
    }
    const range = arr[high] - arr[low];
    const pos = range === 0 ? low : low + Math.floor(((target - arr[low]) * (high - low)) / range);
    steps.push({ low, high, pos });
    if (arr[pos] === target) return { index: pos, comparisons, steps };
    if (arr[pos] < target) low = pos + 1; else high = pos - 1;
  }
  return { index: -1, comparisons, steps };
}

function binarySearch(arr, target) {
  let low = 0, high = arr.length - 1, comparisons = 0;
  while (low <= high) { comparisons++; const mid = Math.floor((low + high) / 2); if (arr[mid] === target) return { index: mid, comparisons }; if (arr[mid] < target) low = mid + 1; else high = mid - 1; }
  return { index: -1, comparisons };
}

function readInputs() {
  const parts = $('arrayInput').value.split(',').map(x => x.trim()).filter(Boolean);
  const arr = parts.map(Number); const target = Number($('targetInput').value);
  if (!parts.length || arr.some(Number.isNaN)) throw new Error('Enter a valid comma-separated list of numbers.');
  if ($('targetInput').value === '' || Number.isNaN(target)) throw new Error('Enter a valid target value.');
  if (arr.some((v, i) => i && v < arr[i - 1])) throw new Error('Interpolation search needs the array sorted from smallest to largest.');
  return { arr, target };
}

function renderSearch() {
  try {
    const { arr, target } = readInputs(); $('error').textContent = '';
    const result = interpolationSearch(arr, target); const visited = new Set(result.steps.map(s => s.pos));
    $('arrayTrack').innerHTML = arr.map((n, i) => `<div class="cell ${i === result.index ? 'found' : visited.has(i) ? 'probed' : ''}"><small>${i}</small>${n}</div>`).join('');
    $('status').textContent = result.index >= 0 ? 'Found' : 'Not found';
    $('index').textContent = result.index >= 0 ? result.index : '—';
    $('comparisons').textContent = result.comparisons;
    $('position').textContent = result.steps.length ? result.steps.at(-1).pos : '—';
    $('trace').innerHTML = result.steps.length ? result.steps.map((s, i) => `<p>Step ${i + 1}: range <code>${s.low}–${s.high}</code>, estimated index <code>${s.pos}</code></p>`).join('') : '<p>The target falls outside the array’s value range.</p>';
  } catch (e) { $('error').textContent = e.message; }
}

function makeUniformArray(size) { const arr = new Array(size); let value = Math.floor(Math.random() * 5); for (let i = 0; i < size; i++) { value += 1 + Math.floor(Math.random() * 9); arr[i] = value; } return arr; }
function benchmark() {
  const button = $('benchmarkBtn'); button.disabled = true; button.textContent = 'Running…';
  requestAnimationFrame(() => setTimeout(() => {
    const sizes = [1000, 5000, 10000, 50000, 100000];
    const rows = sizes.map(size => {
      const arr = makeUniformArray(size), target = arr[Math.floor(Math.random() * size)]; let isResult, bsResult;
      let start = performance.now(); for (let i = 0; i < 100; i++) isResult = interpolationSearch(arr, target); const isTime = (performance.now() - start) / 100;
      start = performance.now(); for (let i = 0; i < 100; i++) bsResult = binarySearch(arr, target); const bsTime = (performance.now() - start) / 100;
      return `<tr><td>${size.toLocaleString()}</td><td>${isTime.toFixed(4)} ms</td><td>${bsTime.toFixed(4)} ms</td><td>${isResult.comparisons}</td><td>${bsResult.comparisons}</td></tr>`;
    });
    $('benchmarkBody').innerHTML = rows.join(''); button.disabled = false; button.textContent = 'Run again';
  }, 30));
}

$('searchBtn').addEventListener('click', renderSearch);
$('benchmarkBtn').addEventListener('click', benchmark);
$('resetBtn').addEventListener('click', () => { $('arrayInput').value = defaults.array; $('targetInput').value = defaults.target; renderSearch(); });
$('targetInput').addEventListener('keydown', e => { if (e.key === 'Enter') renderSearch(); });
renderSearch();
