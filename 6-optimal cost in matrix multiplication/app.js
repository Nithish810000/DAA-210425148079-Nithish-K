const MAX_DIMENSIONS = 13;
const MAX_DIMENSION_VALUE = 1_000_000n;

const elements = {
  form: document.querySelector('#mcm-form'),
  input: document.querySelector('#dimensions'),
  inputWrap: document.querySelector('.dimension-input-wrap'),
  error: document.querySelector('#dimensions-error'),
  exampleButtons: [...document.querySelectorAll('.example-chip')],
  matrixPreview: document.querySelector('#matrix-preview'),
  matrixCount: document.querySelector('#matrix-count'),
  resultCard: document.querySelector('.result-card'),
  minimumCost: document.querySelector('#minimum-cost'),
  resultContext: document.querySelector('#result-context'),
  optimalExpression: document.querySelector('#optimal-expression'),
  leftToRightCost: document.querySelector('#ltr-cost'),
  savedCost: document.querySelector('#saved-cost'),
  savingsPercent: document.querySelector('#savings-percent'),
  resultInsight: document.querySelector('#result-insight'),
  copyResult: document.querySelector('#copy-result'),
  chainVisualization: document.querySelector('#chain-visualization'),
  executionGrid: document.querySelector('#execution-grid'),
  costTable: document.querySelector('#cost-table-container'),
  splitTable: document.querySelector('#split-table-container'),
  tabs: [...document.querySelectorAll('[role="tab"]')],
  finalSplitChart: document.querySelector('#final-split-chart'),
  winnerCallout: document.querySelector('#winner-callout'),
  traceGrid: document.querySelector('#trace-grid'),
  traceNote: document.querySelector('#trace-note'),
  copyCode: document.querySelector('#copy-code'),
  pythonCode: document.querySelector('#python-code'),
  toast: document.querySelector('#toast')
};

let currentResult = null;
let toastTimer = null;

function createElement(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatInteger(value) {
  try {
    return value.toLocaleString('en-US');
  } catch {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}

function parseDimensions(rawValue) {
  let value = rawValue.trim();

  if (!value) {
    throw new Error('Enter at least two dimensions, such as 10, 30, 5.');
  }

  const startsWithBracket = value.startsWith('[');
  const endsWithBracket = value.endsWith(']');
  if (startsWithBracket !== endsWithBracket) {
    throw new Error('Use both square brackets or remove them, for example [10, 30, 5].');
  }
  if (startsWithBracket) value = value.slice(1, -1).trim();

  if (!value) {
    throw new Error('Add dimensions inside the list, such as 10, 30, 5.');
  }
  if (/^-|[\s,]-\s*\d/.test(value) || /\b0\b/.test(value)) {
    throw new Error('Every dimension must be a positive whole number greater than zero.');
  }
  if (/\d*\.\d+/.test(value)) {
    throw new Error('Dimensions must be whole numbers; decimals are not supported.');
  }
  if (/^\s*,|,\s*$|,\s*,/.test(value)) {
    throw new Error('Remove the empty item or trailing comma from the dimension list.');
  }
  if (!/^[\d,\s]+$/.test(value)) {
    throw new Error('Use only positive whole numbers separated by commas or spaces.');
  }

  const tokens = value.split(/[\s,]+/).filter(Boolean);
  if (tokens.length < 2) {
    throw new Error('A matrix needs two dimensions. Add at least one more number.');
  }
  if (tokens.length > MAX_DIMENSIONS) {
    throw new Error(`Use at most ${MAX_DIMENSIONS} dimensions (${MAX_DIMENSIONS - 1} matrices) so the table stays readable.`);
  }

  const dimensions = tokens.map((token) => BigInt(token));
  const oversized = dimensions.find((dimension) => dimension > MAX_DIMENSION_VALUE);
  if (oversized !== undefined) {
    throw new Error(`Keep each dimension at or below ${formatInteger(MAX_DIMENSION_VALUE)}.`);
  }
  if (dimensions.some((dimension) => dimension <= 0n)) {
    throw new Error('Every dimension must be a positive whole number greater than zero.');
  }

  return dimensions;
}

function matrixChainOrder(dimensions) {
  const matrixTotal = dimensions.length - 1;
  const costs = Array.from({ length: matrixTotal }, () => Array(matrixTotal).fill(null));
  const splits = Array.from({ length: matrixTotal }, () => Array(matrixTotal).fill(null));
  const subproblems = [];

  for (let index = 0; index < matrixTotal; index += 1) {
    costs[index][index] = 0n;
  }

  for (let length = 2; length <= matrixTotal; length += 1) {
    for (let start = 0; start <= matrixTotal - length; start += 1) {
      const end = start + length - 1;
      let bestCost = null;
      let bestSplit = null;
      const candidates = [];

      for (let split = start; split < end; split += 1) {
        const leftCost = costs[start][split];
        const rightCost = costs[split + 1][end];
        const multiplicationCost = dimensions[start] * dimensions[split + 1] * dimensions[end + 1];
        const totalCost = leftCost + rightCost + multiplicationCost;

        candidates.push({
          split,
          leftCost,
          rightCost,
          multiplicationCost,
          totalCost,
          isWinner: false
        });

        // Strict comparison preserves the earliest split when two costs tie,
        // matching the supplied Python implementation.
        if (bestCost === null || totalCost < bestCost) {
          bestCost = totalCost;
          bestSplit = split;
        }
      }

      costs[start][end] = bestCost;
      splits[start][end] = bestSplit;
      candidates.forEach((candidate) => {
        candidate.isWinner = candidate.split === bestSplit;
      });
      subproblems.push({ length, start, end, bestCost, bestSplit, candidates });
    }
  }

  return { dimensions, matrixTotal, costs, splits, subproblems };
}

function buildParenthesization(splits, start, end) {
  if (start === end) return `A${start + 1}`;
  const split = splits[start][end];
  const left = buildParenthesization(splits, start, split);
  const right = buildParenthesization(splits, split + 1, end);
  return `(${left} × ${right})`;
}

function calculateLeftToRightCost(dimensions) {
  const matrixTotal = dimensions.length - 1;
  let total = 0n;
  for (let matrixIndex = 1; matrixIndex < matrixTotal; matrixIndex += 1) {
    total += dimensions[0] * dimensions[matrixIndex] * dimensions[matrixIndex + 1];
  }
  return total;
}

function buildExecutionPlan(result) {
  const steps = [];

  function visit(start, end) {
    if (start === end) {
      return {
        label: `A${start + 1}`,
        expression: `A${start + 1}`,
        rows: result.dimensions[start],
        columns: result.dimensions[start + 1]
      };
    }

    const split = result.splits[start][end];
    const left = visit(start, split);
    const right = visit(split + 1, end);
    const scalarCost = result.dimensions[start] * result.dimensions[split + 1] * result.dimensions[end + 1];
    const stepNumber = steps.length + 1;
    const output = {
      label: `R${stepNumber}`,
      expression: `(${left.expression} × ${right.expression})`,
      rows: result.dimensions[start],
      columns: result.dimensions[end + 1]
    };

    steps.push({
      stepNumber,
      left,
      right,
      output,
      scalarCost,
      factorText: `${formatInteger(result.dimensions[start])} · ${formatInteger(result.dimensions[split + 1])} · ${formatInteger(result.dimensions[end + 1])}`
    });

    return output;
  }

  visit(0, result.matrixTotal - 1);
  return steps;
}

function clearError() {
  elements.error.textContent = '';
  elements.input.setAttribute('aria-invalid', 'false');
  elements.inputWrap.classList.remove('has-error');
}

function showError(message, shouldFocus = true) {
  elements.error.textContent = message;
  elements.input.setAttribute('aria-invalid', 'true');
  elements.inputWrap.classList.add('has-error');
  if (shouldFocus) elements.input.focus();
}

function renderMatrixPreview(dimensions) {
  const matrixTotal = dimensions.length - 1;
  elements.matrixCount.textContent = `${matrixTotal} ${matrixTotal === 1 ? 'matrix' : 'matrices'}`;
  elements.matrixPreview.replaceChildren();
  elements.matrixPreview.setAttribute(
    'aria-label',
    dimensions.slice(0, -1).map((dimension, index) => (
      `A${index + 1}: ${formatInteger(dimension)} by ${formatInteger(dimensions[index + 1])}`
    )).join('; ')
  );

  for (let index = 0; index < matrixTotal; index += 1) {
    const matrix = createElement('div', 'preview-matrix');
    matrix.append(
      createElement('b', '', `A${index + 1}`),
      createElement('small', '', `${formatInteger(dimensions[index])} × ${formatInteger(dimensions[index + 1])}`)
    );
    elements.matrixPreview.append(matrix);

    if (index < matrixTotal - 1) {
      elements.matrixPreview.append(createElement('span', 'preview-times', '×'));
    }
  }
}

function renderChainVisualization(dimensions) {
  const matrixTotal = dimensions.length - 1;
  const track = createElement('div', 'chain-track');

  for (let index = 0; index < matrixTotal; index += 1) {
    const card = createElement('article', 'chain-card');
    card.setAttribute(
      'aria-label',
      `Matrix A${index + 1}, ${formatInteger(dimensions[index])} by ${formatInteger(dimensions[index + 1])}`
    );
    card.append(
      createElement('span', '', `MATRIX ${String(index + 1).padStart(2, '0')}`),
      createElement('strong', '', `A${index + 1}`),
      createElement('small', '', `${formatInteger(dimensions[index])} × ${formatInteger(dimensions[index + 1])}`)
    );
    track.append(card);

    if (index < matrixTotal - 1) {
      const link = createElement('div', 'chain-link');
      link.setAttribute('aria-label', `Shared dimension ${formatInteger(dimensions[index + 1])}`);
      link.append(createElement('span', '', formatInteger(dimensions[index + 1])));
      track.append(link);
    }
  }

  elements.chainVisualization.replaceChildren(track);
  elements.chainVisualization.setAttribute(
    'aria-label',
    `Compatible chain containing ${matrixTotal} ${matrixTotal === 1 ? 'matrix' : 'matrices'}`
  );
}

function renderExecutionPlan(result) {
  const steps = buildExecutionPlan(result);
  elements.executionGrid.replaceChildren();

  if (steps.length === 0) {
    elements.executionGrid.append(
      createElement('p', 'execution-empty', 'A1 is already a single matrix, so no scalar multiplications are needed.')
    );
    return;
  }

  steps.forEach((step) => {
    const card = createElement('article', 'execution-card');
    const top = createElement('div', 'execution-top');
    top.append(
      createElement('span', 'execution-number', `STEP ${String(step.stepNumber).padStart(2, '0')}`),
      createElement('span', '', `OUTPUT ${step.output.label}`)
    );

    const equation = createElement('div', 'execution-equation', `${step.left.label} × ${step.right.label}`);
    const dimensions = createElement(
      'div',
      'execution-dimensions',
      `${formatInteger(step.left.rows)}×${formatInteger(step.left.columns)}  ·  ${formatInteger(step.right.rows)}×${formatInteger(step.right.columns)}  →  ${formatInteger(step.output.rows)}×${formatInteger(step.output.columns)}`
    );
    const bottom = createElement('div', 'execution-bottom');
    const formula = createElement('div');
    formula.append(
      createElement('span', '', 'SCALAR COST'),
      createElement('div', 'execution-dimensions', step.factorText)
    );
    bottom.append(formula, createElement('strong', '', formatInteger(step.scalarCost)));
    card.append(top, equation, dimensions, bottom);
    elements.executionGrid.append(card);
  });
}

function createTable(result, tableType) {
  const isCostTable = tableType === 'cost';
  const table = createElement('table', 'dp-table');
  const caption = createElement(
    'caption',
    '',
    isCostTable
      ? 'm[i, j] — minimum scalar multiplications needed for every subchain Ai…Aj.'
      : 's[i, j] — split position k selected for every subchain Ai…Aj.'
  );
  table.append(caption);

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const corner = createElement('th', '', 'i / j');
  corner.scope = 'col';
  headRow.append(corner);
  for (let column = 0; column < result.matrixTotal; column += 1) {
    const header = createElement('th', '', `A${column + 1}`);
    header.scope = 'col';
    headRow.append(header);
  }
  head.append(headRow);
  table.append(head);

  const body = document.createElement('tbody');
  for (let row = 0; row < result.matrixTotal; row += 1) {
    const tableRow = document.createElement('tr');
    const rowHeader = createElement('th', '', `A${row + 1}`);
    rowHeader.scope = 'row';
    tableRow.append(rowHeader);

    for (let column = 0; column < result.matrixTotal; column += 1) {
      const cell = document.createElement('td');
      if (column < row) {
        cell.className = 'unused';
        cell.textContent = '—';
        cell.setAttribute('aria-label', `m ${row + 1}, ${column + 1} is unused`);
      } else if (column === row) {
        cell.className = 'diagonal';
        cell.textContent = isCostTable ? '0' : '—';
        cell.setAttribute(
          'aria-label',
          isCostTable
            ? `m ${row + 1}, ${column + 1} equals zero for one matrix`
            : `s ${row + 1}, ${column + 1} has no split for one matrix`
        );
      } else {
        const isFinalCell = row === 0 && column === result.matrixTotal - 1;
        if (isFinalCell) cell.classList.add('optimal-cell');
        if (!isCostTable) cell.classList.add('split-cell');
        cell.classList.add('cell-enter');
        cell.style.setProperty('--cell-delay', `${Math.min((column - row) * 42 + row * 18, 420)}ms`);

        const value = isCostTable
          ? formatInteger(result.costs[row][column])
          : `k = ${result.splits[row][column] + 1}`;
        const button = createElement('button', 'cell-button', value);
        button.type = 'button';
        button.dataset.traceStart = String(row);
        button.dataset.traceEnd = String(column);
        button.setAttribute(
          'aria-label',
          isCostTable
            ? `Cost m ${row + 1}, ${column + 1} is ${value}. Open candidate splits.`
            : `Split s ${row + 1}, ${column + 1} is ${value}. Open candidate splits.`
        );
        cell.append(button);
      }
      tableRow.append(cell);
    }
    body.append(tableRow);
  }
  table.append(body);
  return table;
}

function renderTables(result) {
  elements.costTable.replaceChildren(createTable(result, 'cost'));
  elements.splitTable.replaceChildren(createTable(result, 'split'));
}

function renderFinalSplitChart(result) {
  elements.finalSplitChart.replaceChildren();
  elements.winnerCallout.replaceChildren();

  if (result.matrixTotal === 1) {
    const message = createElement('p', 'execution-empty', 'There is no split to compare for a single matrix. Its cost is already zero.');
    elements.finalSplitChart.append(message);
    elements.winnerCallout.append(
      createElement('strong', '', 'No split required'),
      document.createTextNode(' A1 is the complete chain.')
    );
    elements.finalSplitChart.setAttribute('aria-label', 'No split is required for one matrix.');
    return;
  }

  const finalProblem = result.subproblems.find(
    (problem) => problem.start === 0 && problem.end === result.matrixTotal - 1
  );
  const maximumCost = finalProblem.candidates.reduce(
    (maximum, candidate) => candidate.totalCost > maximum ? candidate.totalCost : maximum,
    0n
  );

  finalProblem.candidates.forEach((candidate) => {
    const row = createElement('div', `bar-row${candidate.isWinner ? ' winner' : ''}`);
    const label = createElement('div', 'bar-label');
    label.append(
      createElement('b', '', `k = ${candidate.split + 1}`),
      createElement('span', '', `A1…A${candidate.split + 1} | A${candidate.split + 2}…A${result.matrixTotal}`)
    );
    const track = createElement('div', 'bar-track');
    const fill = createElement('div', 'bar-fill');
    const scale = Number((candidate.totalCost * 1000n) / maximumCost) / 1000;
    fill.dataset.scale = String(Math.max(scale, 0.025));
    track.append(fill);
    row.append(label, track, createElement('div', 'bar-value', formatInteger(candidate.totalCost)));
    elements.finalSplitChart.append(row);
  });

  const winner = finalProblem.candidates.find((candidate) => candidate.isWinner);
  elements.winnerCallout.append(
    createElement('strong', '', `Split at k = ${winner.split + 1}`),
    document.createTextNode(
      ` ${formatInteger(winner.leftCost)} + ${formatInteger(winner.rightCost)} + ${formatInteger(winner.multiplicationCost)} = ${formatInteger(winner.totalCost)}.`
    )
  );
  elements.finalSplitChart.setAttribute(
    'aria-label',
    finalProblem.candidates.map((candidate) => (
      `Split k ${candidate.split + 1}: cost ${formatInteger(candidate.totalCost)}${candidate.isWinner ? ', winner' : ''}`
    )).join('; ')
  );

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      elements.finalSplitChart.querySelectorAll('.bar-fill').forEach((fill) => {
        fill.style.setProperty('--bar-scale', fill.dataset.scale);
      });
    });
  });
}

function renderTrace(result) {
  elements.traceGrid.replaceChildren();
  elements.traceNote.hidden = true;

  if (result.subproblems.length === 0) {
    elements.traceGrid.append(
      createElement('p', 'execution-empty', 'No subproblem trace is needed for a single matrix.')
    );
    return;
  }

  result.subproblems.forEach((problem) => {
    const details = createElement('details', 'trace-card');
    details.id = `trace-${problem.start}-${problem.end}`;
    if (problem.start === 0 && problem.end === result.matrixTotal - 1) details.open = true;

    const summary = document.createElement('summary');
    const length = createElement('span', 'trace-length', `L${problem.length}`);
    const title = createElement('span', 'trace-title');
    title.append(
      createElement('b', '', `m[${problem.start + 1}, ${problem.end + 1}]`),
      createElement('small', '', `A${problem.start + 1} through A${problem.end + 1} · best k = ${problem.bestSplit + 1}`)
    );
    const best = createElement('strong', 'trace-best', formatInteger(problem.bestCost));
    const chevron = createElement('span', 'trace-chevron');
    chevron.setAttribute('aria-hidden', 'true');
    const chevronIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevronIcon.setAttribute('viewBox', '0 0 24 24');
    const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chevronPath.setAttribute('d', 'm6 9 6 6 6-6');
    chevronIcon.append(chevronPath);
    chevron.append(chevronIcon);
    summary.append(length, title, best, chevron);

    const candidateList = createElement('div', 'trace-candidates');
    problem.candidates.forEach((candidate) => {
      const row = createElement('div', `candidate-row${candidate.isWinner ? ' winner' : ''}`);
      row.append(
        createElement('b', '', `k=${candidate.split + 1}`),
        createElement(
          'span',
          '',
          `${formatInteger(candidate.leftCost)} + ${formatInteger(candidate.rightCost)} + ${formatInteger(candidate.multiplicationCost)}`
        ),
        createElement('strong', '', `= ${formatInteger(candidate.totalCost)}`)
      );
      candidateList.append(row);
    });

    details.append(summary, candidateList);
    elements.traceGrid.append(details);
  });
}

function rangeLabel(start, end) {
  return start === end ? `A${start + 1}` : `A${start + 1}–A${end + 1}`;
}

function resultInsight(result) {
  if (result.matrixTotal === 1) {
    return 'A1 is already the complete product, so its multiplication cost is zero.';
  }
  if (result.matrixTotal === 2) {
    return 'Only one multiplication order exists: multiply A1 by A2 directly.';
  }
  const split = result.splits[0][result.matrixTotal - 1];
  return `First solve ${rangeLabel(0, split)} and ${rangeLabel(split + 1, result.matrixTotal - 1)} optimally, then multiply their two results.`;
}

function renderResult(result) {
  const minimum = result.costs[0][result.matrixTotal - 1];
  const parenthesization = buildParenthesization(result.splits, 0, result.matrixTotal - 1);
  const leftToRight = calculateLeftToRightCost(result.dimensions);
  const saved = leftToRight > minimum ? leftToRight - minimum : 0n;
  const savingsTenths = leftToRight === 0n
    ? 0n
    : ((saved * 1000n) + (leftToRight / 2n)) / leftToRight;

  elements.minimumCost.textContent = formatInteger(minimum);
  elements.resultContext.textContent = `for a chain of ${result.matrixTotal} ${result.matrixTotal === 1 ? 'matrix' : 'matrices'}`;
  elements.optimalExpression.textContent = parenthesization;
  elements.leftToRightCost.textContent = formatInteger(leftToRight);
  elements.savedCost.textContent = formatInteger(saved);
  elements.savingsPercent.textContent = `${(Number(savingsTenths) / 10).toFixed(1)}%`;
  elements.resultInsight.textContent = resultInsight(result);

  renderMatrixPreview(result.dimensions);
  renderChainVisualization(result.dimensions);
  renderExecutionPlan(result);
  renderTables(result);
  renderFinalSplitChart(result);
  renderTrace(result);

  elements.resultCard.classList.remove('result-updated');
  // Restart the short reveal animation only after an explicit recalculation.
  void elements.resultCard.offsetWidth;
  elements.resultCard.classList.add('result-updated');
}

function computeFromInput({ focusOnError = true } = {}) {
  try {
    const dimensions = parseDimensions(elements.input.value);
    clearError();
    currentResult = matrixChainOrder(dimensions);
    renderResult(currentResult);
    return true;
  } catch (error) {
    showError(error.message, focusOnError);
    return false;
  }
}

function updatePreviewWhileTyping() {
  try {
    const dimensions = parseDimensions(elements.input.value);
    renderMatrixPreview(dimensions);
    if (elements.input.getAttribute('aria-invalid') === 'true') clearError();
  } catch {
    // Validation feedback waits for submission so typing is not interrupted.
  }
}

function activateTableTab(selectedTab) {
  elements.tabs.forEach((tab) => {
    const isSelected = tab === selectedTab;
    tab.setAttribute('aria-selected', String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
    const panel = document.querySelector(`#${tab.getAttribute('aria-controls')}`);
    panel.hidden = !isSelected;
  });
}

function openTraceFromTable(event) {
  const button = event.target.closest('[data-trace-start]');
  if (!button) return;
  const details = document.querySelector(`#trace-${button.dataset.traceStart}-${button.dataset.traceEnd}`);
  if (!details) return;
  details.open = true;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  details.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  details.querySelector('summary').focus({ preventScroll: true });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('visible'), 3200);
}

async function copyText(text, successMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.append(textArea);
      textArea.select();
      const copied = document.execCommand('copy');
      textArea.remove();
      if (!copied) throw new Error('Copy was not available');
    }
    showToast(successMessage);
  } catch {
    showToast('Could not copy automatically. Select the text and copy it manually.');
  }
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  computeFromInput();
});

elements.input.addEventListener('input', () => {
  elements.exampleButtons.forEach((button) => button.classList.remove('active'));
  updatePreviewWhileTyping();
});

elements.exampleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    elements.exampleButtons.forEach((item) => item.classList.toggle('active', item === button));
    elements.input.value = button.dataset.dimensions;
    computeFromInput({ focusOnError: false });
  });
});

elements.tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTableTab(tab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + elements.tabs.length) % elements.tabs.length;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % elements.tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = elements.tabs.length - 1;
    elements.tabs[nextIndex].focus();
    activateTableTab(elements.tabs[nextIndex]);
  });
});

elements.costTable.addEventListener('click', openTraceFromTable);
elements.splitTable.addEventListener('click', openTraceFromTable);

elements.copyResult.addEventListener('click', () => {
  if (!currentResult) return;
  copyText(elements.optimalExpression.textContent, 'Optimal parenthesization copied.');
});

elements.copyCode.addEventListener('click', () => {
  copyText(elements.pythonCode.textContent, 'Python code copied.');
});

computeFromInput({ focusOnError: false });
