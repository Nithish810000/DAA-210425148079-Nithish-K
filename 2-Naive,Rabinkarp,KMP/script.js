"use strict";

const SAMPLE_TEXT = "AABAACAADAABAABA";
const SAMPLE_PATTERN = "AABA";
const STORAGE_KEY = "daa-string-matching-cases";

const form = document.querySelector("#search-form");
const textInput = document.querySelector("#text-input");
const patternInput = document.querySelector("#pattern-input");
const textCount = document.querySelector("#text-count");
const patternCount = document.querySelector("#pattern-count");
const formMessage = document.querySelector("#form-message");
const loadSampleButton = document.querySelector("#load-sample-button");
const addCaseButton = document.querySelector("#add-case-button");
const testCaseBody = document.querySelector("#test-case-body");
const emptyState = document.querySelector("#empty-state");
const caseTotal = document.querySelector("#case-total");
const matchCount = document.querySelector("#match-count");
const textPreview = document.querySelector("#text-preview");

let testCases = loadCases();

/**
 * Checks the pattern at every possible starting position.
 * @returns {{matches: number[], comparisons: number}}
 */
function naiveSearch(text, pattern) {
  const matches = [];
  let comparisons = 0;

  if (pattern.length === 0 || pattern.length > text.length) {
    return { matches, comparisons };
  }

  for (let i = 0; i <= text.length - pattern.length; i += 1) {
    let j = 0;

    while (j < pattern.length) {
      comparisons += 1;
      if (text[i + j] !== pattern[j]) {
        break;
      }
      j += 1;
    }

    if (j === pattern.length) {
      matches.push(i);
    }
  }

  return { matches, comparisons };
}

/**
 * Builds the Longest Prefix Suffix table used by KMP.
 */
function computeLps(pattern) {
  const lps = new Array(pattern.length).fill(0);
  let length = 0;
  let i = 1;

  while (i < pattern.length) {
    if (pattern[i] === pattern[length]) {
      length += 1;
      lps[i] = length;
      i += 1;
    } else if (length !== 0) {
      length = lps[length - 1];
    } else {
      lps[i] = 0;
      i += 1;
    }
  }

  return lps;
}

/**
 * Searches using the KMP failure-function/LPS table.
 * @returns {{matches: number[], comparisons: number}}
 */
function kmpSearch(text, pattern) {
  const matches = [];
  let comparisons = 0;

  if (pattern.length === 0 || pattern.length > text.length) {
    return { matches, comparisons };
  }

  const lps = computeLps(pattern);
  let i = 0;
  let j = 0;

  while (i < text.length) {
    comparisons += 1;

    if (pattern[j] === text[i]) {
      i += 1;
      j += 1;

      if (j === pattern.length) {
        matches.push(i - j);
        j = lps[j - 1];
      }
    } else if (j !== 0) {
      j = lps[j - 1];
    } else {
      i += 1;
    }
  }

  return { matches, comparisons };
}

/**
 * Searches by comparing rolling hashes, then verifies hash matches.
 * @returns {{matches: number[], comparisons: number}}
 */
function rabinKarpSearch(text, pattern, prime = 101) {
  const matches = [];
  let comparisons = 0;

  if (pattern.length === 0 || pattern.length > text.length) {
    return { matches, comparisons };
  }

  const alphabetSize = 256;
  const patternLength = pattern.length;
  let highOrderMultiplier = 1;
  let patternHash = 0;
  let textHash = 0;

  for (let i = 0; i < patternLength - 1; i += 1) {
    highOrderMultiplier = (highOrderMultiplier * alphabetSize) % prime;
  }

  for (let i = 0; i < patternLength; i += 1) {
    patternHash =
      (alphabetSize * patternHash + pattern.charCodeAt(i)) % prime;
    textHash =
      (alphabetSize * textHash + text.charCodeAt(i)) % prime;
  }

  for (let shift = 0; shift <= text.length - patternLength; shift += 1) {
    if (patternHash === textHash) {
      let characterIndex = 0;

      for (; characterIndex < patternLength; characterIndex += 1) {
        comparisons += 1;
        if (text[shift + characterIndex] !== pattern[characterIndex]) {
          break;
        }
      }

      if (characterIndex === patternLength) {
        matches.push(shift);
      }
    }

    if (shift < text.length - patternLength) {
      textHash =
        (
          alphabetSize *
            (textHash - text.charCodeAt(shift) * highOrderMultiplier) +
          text.charCodeAt(shift + patternLength)
        ) %
        prime;

      if (textHash < 0) {
        textHash += prime;
      }
    }
  }

  return { matches, comparisons };
}

function measureSearch(searchFunction, text, pattern) {
  const repetitions = text.length < 1000 ? 100 : 10;
  const start = performance.now();
  let result;

  for (let index = 0; index < repetitions; index += 1) {
    result = searchFunction(text, pattern);
  }

  const elapsed = (performance.now() - start) / repetitions;
  return { ...result, elapsed };
}

function validateInput() {
  const text = textInput.value;
  const pattern = patternInput.value;

  if (text.length === 0 || pattern.length === 0) {
    formMessage.textContent = "Enter both a text and a pattern.";
    return null;
  }

  if (pattern.length > text.length) {
    formMessage.textContent =
      "The pattern is longer than the text, so no match is possible.";
  } else {
    formMessage.textContent = "";
  }

  return { text, pattern };
}

function runComparison({ text, pattern }, shouldScroll = false) {
  const results = {
    naive: measureSearch(naiveSearch, text, pattern),
    kmp: measureSearch(kmpSearch, text, pattern),
    "rabin-karp": measureSearch(rabinKarpSearch, text, pattern)
  };

  Object.entries(results).forEach(([algorithm, result]) => {
    const card = document.querySelector(`[data-algorithm="${algorithm}"]`);
    card.querySelector(".result-matches").textContent =
      result.matches.length > 0 ? `[${result.matches.join(", ")}]` : "None";
    card.querySelector(".result-comparisons").textContent =
      result.comparisons.toLocaleString();
    card.querySelector(".result-time").textContent =
      `${formatTime(result.elapsed)} avg`;
  });

  renderMatchPreview(text, pattern, results.naive.matches);

  if (shouldScroll) {
    document.querySelector("#results-region").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  return results;
}

function formatTime(milliseconds) {
  if (milliseconds < 0.001) {
    return `${(milliseconds * 1000).toFixed(2)} μs`;
  }

  if (milliseconds < 1) {
    return `${milliseconds.toFixed(3)} ms`;
  }

  return `${milliseconds.toFixed(2)} ms`;
}

function renderMatchPreview(text, pattern, matches) {
  textPreview.replaceChildren();
  matchCount.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"}`;

  if (matches.length === 0) {
    textPreview.textContent = text;
    return;
  }

  const matchedPositions = new Set();
  matches.forEach((start) => {
    for (let offset = 0; offset < pattern.length; offset += 1) {
      matchedPositions.add(start + offset);
    }
  });

  let plainText = "";
  let highlightedText = "";
  let isHighlighted = matchedPositions.has(0);

  const appendSegment = () => {
    if (isHighlighted) {
      const mark = document.createElement("mark");
      mark.textContent = highlightedText;
      textPreview.append(mark);
      highlightedText = "";
    } else {
      textPreview.append(document.createTextNode(plainText));
      plainText = "";
    }
  };

  for (let index = 0; index < text.length; index += 1) {
    const shouldHighlight = matchedPositions.has(index);

    if (shouldHighlight !== isHighlighted) {
      appendSegment();
      isHighlighted = shouldHighlight;
    }

    if (shouldHighlight) {
      highlightedText += text[index];
    } else {
      plainText += text[index];
    }
  }

  appendSegment();
}

function updateCharacterCounts() {
  textCount.textContent =
    `${textInput.value.length.toLocaleString()} characters`;
  patternCount.textContent =
    `${patternInput.value.length.toLocaleString()} characters`;
}

function loadCases() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      return saved.filter(
        (item) =>
          typeof item.text === "string" &&
          typeof item.pattern === "string" &&
          item.text.length > 0 &&
          item.pattern.length > 0
      );
    }
  } catch (error) {
    console.warn("Saved test cases could not be loaded.", error);
  }

  return [{ text: SAMPLE_TEXT, pattern: SAMPLE_PATTERN }];
}

function saveCases() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(testCases));
  } catch (error) {
    console.warn("Test cases will be kept for this session only.", error);
  }
}

function renderTestCases() {
  testCaseBody.replaceChildren();
  emptyState.hidden = testCases.length !== 0;
  document.querySelector(".table-wrap").hidden = testCases.length === 0;
  caseTotal.textContent =
    `${testCases.length} ${testCases.length === 1 ? "case" : "cases"}`;

  testCases.forEach((testCase, index) => {
    const row = document.createElement("tr");
    const matchResult = naiveSearch(testCase.text, testCase.pattern);

    const numberCell = document.createElement("td");
    numberCell.className = "case-index";
    numberCell.textContent = String(index + 1).padStart(2, "0");

    const textCell = document.createElement("td");
    const textCode = document.createElement("code");
    textCode.className = "case-code";
    textCode.title = testCase.text;
    textCode.textContent = testCase.text;
    textCell.append(textCode);

    const patternCell = document.createElement("td");
    const patternCode = document.createElement("code");
    patternCode.className = "case-code";
    patternCode.title = testCase.pattern;
    patternCode.textContent = testCase.pattern;
    patternCell.append(patternCode);

    const matchesCell = document.createElement("td");
    matchesCell.className = "case-matches";
    matchesCell.textContent = matchResult.matches.length.toLocaleString();

    const actionCell = document.createElement("td");
    actionCell.className = "case-actions";

    const runButton = document.createElement("button");
    runButton.className = "table-action";
    runButton.type = "button";
    runButton.dataset.action = "run";
    runButton.dataset.index = index;
    runButton.textContent = "Run";
    runButton.setAttribute("aria-label", `Run test case ${index + 1}`);

    const deleteButton = document.createElement("button");
    deleteButton.className = "table-action delete";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.index = index;
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete test case ${index + 1}`);

    actionCell.append(runButton, deleteButton);
    row.append(numberCell, textCell, patternCell, matchesCell, actionCell);
    testCaseBody.append(row);
  });
}

function loadInput(testCase, shouldRun = true) {
  textInput.value = testCase.text;
  patternInput.value = testCase.pattern;
  updateCharacterCounts();
  formMessage.textContent = "";

  if (shouldRun) {
    runComparison(testCase, true);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = validateInput();
  if (input) {
    runComparison(input);
  }
});

addCaseButton.addEventListener("click", () => {
  const input = validateInput();
  if (!input) {
    return;
  }

  const isDuplicate = testCases.some(
    (testCase) =>
      testCase.text === input.text && testCase.pattern === input.pattern
  );

  if (isDuplicate) {
    formMessage.textContent = "This test case is already saved.";
    return;
  }

  testCases.push(input);
  saveCases();
  renderTestCases();
  runComparison(input);
  formMessage.textContent = "Test case added successfully.";
});

loadSampleButton.addEventListener("click", () => {
  loadInput({ text: SAMPLE_TEXT, pattern: SAMPLE_PATTERN });
});

testCaseBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);

  if (button.dataset.action === "run") {
    loadInput(testCases[index]);
  }

  if (button.dataset.action === "delete") {
    testCases.splice(index, 1);
    saveCases();
    renderTestCases();
  }
});

textInput.addEventListener("input", updateCharacterCounts);
patternInput.addEventListener("input", updateCharacterCounts);

updateCharacterCounts();
renderTestCases();
runComparison({ text: textInput.value, pattern: patternInput.value });
