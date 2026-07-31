const SAMPLE_ARRAY = [2, 5, 10, 15, 23, 35, 48, 60, 75, 90, 105, 120];

const elements = typeof document === "undefined" ? null : {
  form: document.querySelector("#searchForm"),
  arrayInput: document.querySelector("#arrayInput"),
  targetInput: document.querySelector("#targetInput"),
  newValueInput: document.querySelector("#newValueInput"),
  addValueButton: document.querySelector("#addValueButton"),
  resetButton: document.querySelector("#resetButton"),
  formMessage: document.querySelector("#formMessage"),
  resultStatus: document.querySelector("#resultStatus"),
  indexMetric: document.querySelector("#indexMetric"),
  comparisonMetric: document.querySelector("#comparisonMetric"),
  sizeMetric: document.querySelector("#sizeMetric"),
  arrayVisual: document.querySelector("#arrayVisual"),
  traceBody: document.querySelector("#traceBody"),
  benchmarkButton: document.querySelector("#benchmarkButton"),
  benchmarkBody: document.querySelector("#benchmarkBody")
};

function parseArray(rawValue) {
  const values = rawValue
    .split(/[\s,]+/)
    .map(value => value.trim())
    .filter(Boolean)
    .map(Number);

  if (!values.length) {
    throw new Error("Enter at least one array value.");
  }

  if (values.some(value => !Number.isFinite(value))) {
    throw new Error("Use only valid numbers separated by commas or spaces.");
  }

  return values.sort((a, b) => a - b);
}

function interpolationSearch(array, target) {
  let low = 0;
  let high = array.length - 1;
  let comparisons = 0;
  const trace = [];

  while (low <= high && target >= array[low] && target <= array[high]) {
    comparisons += 1;

    if (array[low] === array[high]) {
      const found = array[low] === target;
      trace.push({
        low,
        high,
        position: low,
        value: array[low],
        decision: found ? "Target found" : "Equal range; not found"
      });
      return { index: found ? low : -1, comparisons, trace };
    }

    const estimate = low + Math.floor(
      ((target - array[low]) * (high - low)) /
      (array[high] - array[low])
    );
    const position = Math.max(low, Math.min(high, estimate));
    const probeValue = array[position];

    if (probeValue === target) {
      trace.push({
        low,
        high,
        position,
        value: probeValue,
        decision: "Target found"
      });
      return { index: position, comparisons, trace };
    }

    if (probeValue < target) {
      trace.push({
        low,
        high,
        position,
        value: probeValue,
        decision: "Search right"
      });
      low = position + 1;
    } else {
      trace.push({
        low,
        high,
        position,
        value: probeValue,
        decision: "Search left"
      });
      high = position - 1;
    }
  }

  return { index: -1, comparisons, trace };
}

function binarySearch(array, target) {
  let low = 0;
  let high = array.length - 1;
  let comparisons = 0;

  while (low <= high) {
    comparisons += 1;
    const middle = Math.floor((low + high) / 2);

    if (array[middle] === target) {
      return { index: middle, comparisons };
    }

    if (array[middle] < target) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return { index: -1, comparisons };
}

function formatValue(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function renderArray(array, result = null) {
  const probed = new Set(result ? result.trace.map(step => step.position) : []);

  elements.arrayVisual.replaceChildren(
    ...array.map((value, index) => {
      const cell = document.createElement("div");
      cell.className = "array-cell";
      if (probed.has(index)) cell.classList.add("probed");
      if (result && result.index === index) cell.classList.add("found");

      const indexLabel = document.createElement("small");
      indexLabel.textContent = index;
      cell.append(indexLabel, document.createTextNode(formatValue(value)));
      return cell;
    })
  );

  elements.sizeMetric.textContent = array.length;
}

function renderTrace(trace) {
  if (!trace.length) {
    elements.traceBody.innerHTML =
      '<tr><td colspan="6" class="empty-cell">The target is outside the array range, so no probe was required.</td></tr>';
    return;
  }

  elements.traceBody.innerHTML = trace.map((step, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${step.low}</td>
      <td>${step.high}</td>
      <td>${step.position}</td>
      <td>${formatValue(step.value)}</td>
      <td>${step.decision}</td>
    </tr>
  `).join("");
}

function runSearch(event) {
  event?.preventDefault();
  elements.formMessage.textContent = "";

  try {
    const array = parseArray(elements.arrayInput.value);
    const target = Number(elements.targetInput.value);

    if (!Number.isFinite(target)) {
      throw new Error("Enter a valid target value.");
    }

    elements.arrayInput.value = array.join(", ");
    const result = interpolationSearch(array, target);
    renderArray(array, result);
    renderTrace(result.trace);

    elements.indexMetric.textContent = result.index;
    elements.comparisonMetric.textContent = result.comparisons;
    elements.resultStatus.textContent = result.index === -1
      ? `${formatValue(target)} was not found`
      : `${formatValue(target)} found at index ${result.index}`;
  } catch (error) {
    elements.formMessage.textContent = error.message;
  }
}

function addValue() {
  elements.formMessage.textContent = "";

  try {
    const value = Number(elements.newValueInput.value);
    if (!Number.isFinite(value)) {
      throw new Error("Enter a valid number to add.");
    }

    const array = parseArray(elements.arrayInput.value);
    array.push(value);
    array.sort((a, b) => a - b);
    elements.arrayInput.value = array.join(", ");
    elements.newValueInput.value = "";
    renderArray(array);
    elements.resultStatus.textContent = `${formatValue(value)} added — run the search`;
    elements.indexMetric.textContent = "—";
    elements.comparisonMetric.textContent = "—";
    elements.newValueInput.focus();
  } catch (error) {
    elements.formMessage.textContent = error.message;
  }
}

function resetSample() {
  elements.arrayInput.value = SAMPLE_ARRAY.join(", ");
  elements.targetInput.value = "35";
  elements.newValueInput.value = "";
  elements.formMessage.textContent = "";
  elements.resultStatus.textContent = "Ready to search";
  elements.indexMetric.textContent = "—";
  elements.comparisonMetric.textContent = "—";
  elements.traceBody.innerHTML =
    '<tr><td colspan="6" class="empty-cell">Run the search to inspect each probe.</td></tr>';
  renderArray(SAMPLE_ARRAY);
}

function runBenchmark() {
  const sizes = [1000, 5000, 10000, 50000, 100000];
  const repetitions = 100;
  elements.benchmarkButton.disabled = true;
  elements.benchmarkButton.firstChild.textContent = "Running… ";

  window.setTimeout(() => {
    const rows = sizes.map(size => {
      const array = Array.from({ length: size }, (_, index) => index * 3 + (index % 2));
      const target = array[Math.floor(size * 0.67)];
      let interpolationResult;
      let binaryResult;

      const interpolationStart = performance.now();
      for (let attempt = 0; attempt < repetitions; attempt += 1) {
        interpolationResult = interpolationSearch(array, target);
      }
      const interpolationTime = (performance.now() - interpolationStart) / repetitions;

      const binaryStart = performance.now();
      for (let attempt = 0; attempt < repetitions; attempt += 1) {
        binaryResult = binarySearch(array, target);
      }
      const binaryTime = (performance.now() - binaryStart) / repetitions;

      return `
        <tr>
          <td>${size.toLocaleString()}</td>
          <td>${interpolationTime.toFixed(4)}</td>
          <td>${binaryTime.toFixed(4)}</td>
          <td>${interpolationResult.comparisons}</td>
          <td>${binaryResult.comparisons}</td>
        </tr>
      `;
    });

    elements.benchmarkBody.innerHTML = rows.join("");
    elements.benchmarkButton.disabled = false;
    elements.benchmarkButton.firstChild.textContent = "Run again ";
  }, 40);
}

globalThis.interpolationSearch = interpolationSearch;
globalThis.binarySearch = binarySearch;

if (elements) {
  elements.form.addEventListener("submit", runSearch);
  elements.addValueButton.addEventListener("click", addValue);
  elements.newValueInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      addValue();
    }
  });
  elements.resetButton.addEventListener("click", resetSample);
  elements.benchmarkButton.addEventListener("click", runBenchmark);
  elements.arrayInput.addEventListener("change", () => {
    try {
      renderArray(parseArray(elements.arrayInput.value));
      elements.formMessage.textContent = "";
    } catch (error) {
      elements.formMessage.textContent = error.message;
    }
  });

  resetSample();
}
