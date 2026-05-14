/**
 * Summarize Cursor dashboard CSV exports (default: data/cursor-analytics/cursor-analytics-summary.json).
 *
 * Supports:
 * - **Team daily rollup** (Analytics_Team_*.csv): `Date` + `Chats Usage Based Requests` + nested JSON
 *   in `File Extensions Data` → byMonth (usage-based requests), byRepo (file extensions → line volume proxy);
 *   optional `Models Time Series Data` → **byDayModelRequests** (per-day model slug → requests, optional token fields) for CSV estimate mode.
 * - **AI edits by repository / repo×developer** exports: carries AI lines and percentages for allocation views.
 * - **Generic tabular** CSVs: heuristic column matching (no ambiguous short "total" synonym).
 *
 * Usage:
 *   node scripts/cursor-analytics/summarize-cursor-exports.mjs --dir data/cursor-analytics/csv --out data/cursor-analytics/cursor-analytics-summary.json
 */

import fs from "node:fs";
import path from "node:path";

/** @param {string} text */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
    } else if (c === "\r") {
      if (text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
  return rows;
}

/** @param {string} s */
function normalizeHeader(s) {
  return s.replace(/^\uFEFF/, "").trim().toLowerCase();
}

/** @param {string[]} headers @param {string[]} synonyms */
function pickColumnIndex(headers, synonyms) {
  const norm = headers.map((h) => normalizeHeader(String(h)));
  for (const syn of synonyms) {
    const s = syn.toLowerCase();
    const exact = norm.indexOf(s);
    if (exact >= 0) return exact;
  }
  for (const syn of synonyms) {
    const s = syn.toLowerCase();
    const idx = norm.findIndex((h) => h === s || h.includes(s) || s.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

const DATE_SYNONYMS = [
  "date",
  "event_date",
  "event date",
  "timestamp",
  "usage date",
  "calendar date",
];
const USER_SYNONYMS = [
  "email",
  "user email",
  "member",
  "developer",
  "user name",
  "username",
  "display name",
  "account email",
];
const REPO_SYNONYMS = [
  "repository",
  "repo name",
  "repository name",
  "git repository",
  "remote url",
  "full repository",
];
const AMOUNT_SYNONYMS = [
  "cost",
  "spend",
  "amount",
  "total cost",
  "usd",
  "dollars",
  "price",
  "usage usd",
  "billable",
  "tokens used",
  "token count",
];
const AI_LINES_SYNONYMS = [
  "ai lines of code committed",
  "ai lines committed",
  "ai lines",
  "ai_loc",
];
const TOTAL_LINES_SYNONYMS = [
  "total lines of code committed",
  "total lines committed",
  "total lines",
];
const AI_PERCENT_SYNONYMS = [
  "code committed by ai",
  "ai %",
  "ai percent",
];

/** @param {string} raw */
function parseAmount(raw) {
  const t = String(raw).trim();
  if (t === "" || t === "-") return 0;
  const cleaned = t.replace(/[$€£,\s]/g, "").replace(/%$/, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** @param {string} raw */
function parsePercent(raw) {
  const t = String(raw).trim();
  if (!t) return null;
  const cleaned = t.replace(/%/g, "").trim();
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** @param {string} raw */
function isoDayFromCell(raw) {
  const t = String(raw).trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  const mdy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const mo = String(mdy[1]).padStart(2, "0");
    const da = String(mdy[2]).padStart(2, "0");
    const y = mdy[3];
    return `${y}-${mo}-${da}`;
  }
  return null;
}

/** @param {string} raw */
function monthKeyFromCell(raw) {
  const t = String(raw).trim();
  if (!t) return "_unknown";
  if (/^\d{4}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  const mdy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const mo = String(mdy[1]).padStart(2, "0");
    const y = mdy[3];
    return `${y}-${mo}`;
  }
  return "_unknown";
}

/** @param {string[]} headers */
function isTeamDailyRollup(headers) {
  if (headers.length < 2) return false;
  if (normalizeHeader(String(headers[0])) !== "date") return false;
  const h = headers.map((x) => normalizeHeader(String(x)));
  const usage = h.findIndex((x) => x === "chats usage based requests" || x.includes("usage based requests"));
  const ext = h.findIndex((x) => x.includes("file extensions data"));
  return usage >= 0 && ext >= 0;
}

/** @param {string[]} headers */
function isAiEditsRepoExport(headers) {
  const repoIdx = pickColumnIndex(headers, REPO_SYNONYMS);
  const aiIdx = pickColumnIndex(headers, AI_LINES_SYNONYMS);
  return repoIdx >= 0 && aiIdx >= 0;
}

/** @param {string} cell */
function parseFileExtensionsCell(cell) {
  const t = String(cell).trim();
  if (!t) return [];
  try {
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Team CSV "Models Time Series Data" cell: JSON array of objects, some with `model_breakdown`.
 * @param {string} cell
 * @returns {Record<string, { requests: number; users: number; inputTokens?: number; outputTokens?: number; totalTokens?: number }> | null}
 */
function parseModelsTimeSeriesModelBreakdown(cell) {
  const t = String(cell).trim();
  if (!t) return null;
  try {
    const parsed = JSON.parse(t);
    if (!Array.isArray(parsed)) return null;
    /** @type {Record<string, { requests: number; users: number; inputTokens?: number; outputTokens?: number; totalTokens?: number }>} */
    const out = {};
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const mb = entry.model_breakdown;
      if (!mb || typeof mb !== "object") continue;
      for (const [slug, v] of Object.entries(mb)) {
        if (!slug || !v || typeof v !== "object") continue;
        const requests = Number(v.requests ?? 0);
        const users = Number(v.users ?? 0);
        if (!Number.isFinite(requests) || requests < 0) continue;
        const ru = Number.isFinite(users) && users >= 0 ? Math.round(users) : 0;
        const rq = Math.round(requests);
        const it = Number(v.input_tokens ?? v.inputTokens ?? 0);
        const ot = Number(v.output_tokens ?? v.outputTokens ?? 0);
        const tt = Number(v.total_tokens ?? v.totalTokens ?? v.tokens ?? 0);
        const inputTokens = Number.isFinite(it) && it > 0 ? Math.round(it) : undefined;
        const outputTokens = Number.isFinite(ot) && ot >= 0 ? Math.round(ot) : undefined;
        const totalTokens = Number.isFinite(tt) && tt > 0 ? Math.round(tt) : undefined;
        /** @type {typeof out[string]} */
        const row = { requests: rq, users: ru };
        if (inputTokens !== undefined) row.inputTokens = inputTokens;
        if (outputTokens !== undefined) row.outputTokens = outputTokens;
        if (totalTokens !== undefined) row.totalTokens = totalTokens;
        mergeModelBreakdownIntoDay(out, { [slug]: row });
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, { requests: number; users: number; inputTokens?: number; outputTokens?: number; totalTokens?: number }>} target
 * @param {Record<string, { requests: number; users: number; inputTokens?: number; outputTokens?: number; totalTokens?: number }>} addition
 */
function mergeModelBreakdownIntoDay(target, addition) {
  for (const [slug, m] of Object.entries(addition)) {
    const cur = target[slug];
    if (!cur) {
      target[slug] = { ...m };
    } else {
      const nextIt = (cur.inputTokens ?? 0) + (m.inputTokens ?? 0);
      const nextOt = (cur.outputTokens ?? 0) + (m.outputTokens ?? 0);
      const nextTt = (cur.totalTokens ?? 0) + (m.totalTokens ?? 0);
      /** @type {typeof target[string]} */
      const merged = {
        requests: cur.requests + m.requests,
        users: Math.max(cur.users, m.users),
      };
      if (nextIt > 0) merged.inputTokens = nextIt;
      if (nextOt > 0) merged.outputTokens = nextOt;
      if (nextTt > 0) merged.totalTokens = nextTt;
      target[slug] = merged;
    }
  }
}

/** @param {Record<string, { rows: number; amount: number }>} map @param {string} key @param {number} amount */
function bump(map, key, amount) {
  if (!map[key]) map[key] = { rows: 0, amount: 0 };
  map[key].rows += 1;
  map[key].amount += amount;
}

/** @param {Record<string, { rows: number; amount: number }>} map @param {string} key @param {number} amount @param {number} rowAdds */
function bumpAmount(map, key, amount, rowAdds) {
  if (!map[key]) map[key] = { rows: 0, amount: 0 };
  map[key].rows += rowAdds;
  map[key].amount += amount;
}

/** @param {Record<string, { rows: number; amount: number }>} map */
function sortKeys(map) {
  const sorted = Object.create(null);
  for (const k of Object.keys(map).sort()) {
    sorted[k] = map[k];
  }
  return sorted;
}

/** @param {Record<string, { rows: number; aiLines: number; totalLines: number; aiPercent: number | null }>} map */
function sortMetricKeys(map) {
  const sorted = Object.create(null);
  for (const k of Object.keys(map).sort()) {
    sorted[k] = map[k];
  }
  return sorted;
}

/**
 * @param {string[]} headers
 * @param {string[][]} dataRows
 * @param {string} fileLabel
 * @param {Set<string>} seenDates
 */
function ingestTeamDaily(headers, dataRows, fileLabel, seenDates) {
  const norm = headers.map((x) => normalizeHeader(String(x)));
  const dateIdx = norm.indexOf("date");
  const usageIdx = norm.findIndex((x) => x === "chats usage based requests" || x.includes("usage based requests"));
  const extIdx = norm.findIndex((x) => x.includes("file extensions data"));
  const modelsIdx = norm.findIndex((x) => x.includes("models time series data"));

  /** @type {Record<string, { rows: number; amount: number }>} */
  const byMonth = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byRepo = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byMonthRepo = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byDay = {};
  /** @type {Record<string, Record<string, { requests: number; users: number }>>} */
  const byDayModelRequests = {};

  for (const row of dataRows) {
    if (row.length < headers.length) continue;
    const dateRaw = dateIdx >= 0 ? String(row[dateIdx] ?? "").trim() : "";
    if (!dateRaw || seenDates.has(dateRaw)) continue;
    seenDates.add(dateRaw);

    const month = monthKeyFromCell(dateRaw);
    const usage = usageIdx >= 0 ? parseAmount(String(row[usageIdx] ?? "0")) : 0;
    bumpAmount(byMonth, month, usage, 1);
    const iso = isoDayFromCell(dateRaw);
    if (iso) bumpAmount(byDay, iso, usage, 1);

    if (iso && modelsIdx >= 0) {
      const modelsCell = String(row[modelsIdx] ?? "");
      const breakdown = parseModelsTimeSeriesModelBreakdown(modelsCell);
      if (breakdown) {
        if (!byDayModelRequests[iso]) byDayModelRequests[iso] = {};
        mergeModelBreakdownIntoDay(byDayModelRequests[iso], breakdown);
      }
    }

    const extCell = extIdx >= 0 ? String(row[extIdx] ?? "") : "";
    const items = parseFileExtensionsCell(extCell);
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const ext = String(item.file_extension ?? "").trim();
      if (!ext) continue;
      const label = ext.startsWith(".") ? ext : `.${ext}`;
      const lines = Number(item.total_lines_accepted ?? 0);
      const n = Number.isFinite(lines) ? lines : 0;
      bumpAmount(byRepo, label, n, 1);
      bumpAmount(byMonthRepo, `${month}\t${label}`, n, 1);
    }
  }

  return {
    schema: "teamDaily",
    fileMeta: {
      file: fileLabel,
      dateColumn: headers[dateIdx] ?? "Date",
      userColumn: "(not in team daily export — use leaderboard CSV or Enterprise API)",
      repoColumn: "File Extensions Data → extensions",
      amountColumn: "Chats Usage Based Requests (usage-based volume proxy)",
    },
    byMonth,
    byRepo,
    byMonthRepo,
    byDay,
    /** team rollup: no per-developer dimension */
    byDeveloper: {
      _team: { rows: dataRows.length, amount: Object.values(byMonth).reduce((s, b) => s + b.amount, 0) },
    },
    byMonthDeveloper: {},
    byRepoDeveloper: {},
    repoAiEdits: {},
    repoDeveloperAiEdits: {},
    byDayModelRequests,
  };
}

/**
 * @param {string[]} headers
 * @param {string[][]} dataRows
 * @param {string} fileLabel
 */
function ingestAiEditsRepo(headers, dataRows, fileLabel) {
  const repoIdx = pickColumnIndex(headers, REPO_SYNONYMS);
  const developerIdx = pickColumnIndex(headers, USER_SYNONYMS);
  const aiLinesIdx = pickColumnIndex(headers, AI_LINES_SYNONYMS);
  const totalLinesIdx = pickColumnIndex(headers, TOTAL_LINES_SYNONYMS);
  const aiPctIdx = pickColumnIndex(headers, AI_PERCENT_SYNONYMS);

  /** @type {Record<string, { rows: number; aiLines: number; totalLines: number; aiPercent: number | null }>} */
  const repoAiEdits = {};
  /** @type {Record<string, { rows: number; aiLines: number; totalLines: number; aiPercent: number | null }>} */
  const repoDeveloperAiEdits = {};

  for (const row of dataRows) {
    const repoRaw = repoIdx >= 0 && repoIdx < row.length ? String(row[repoIdx] ?? "").trim() : "";
    if (!repoRaw) continue;
    const developerRaw =
      developerIdx >= 0 && developerIdx < row.length ? String(row[developerIdx] ?? "").trim() : "";
    const aiLinesRaw = aiLinesIdx >= 0 && aiLinesIdx < row.length ? String(row[aiLinesIdx] ?? "0") : "0";
    const totalLinesRaw =
      totalLinesIdx >= 0 && totalLinesIdx < row.length ? String(row[totalLinesIdx] ?? "0") : "0";
    const aiPctRaw = aiPctIdx >= 0 && aiPctIdx < row.length ? String(row[aiPctIdx] ?? "") : "";
    const aiLines = parseAmount(aiLinesRaw);
    const totalLines = parseAmount(totalLinesRaw);
    const aiPercent = parsePercent(aiPctRaw);

    if (!repoAiEdits[repoRaw]) {
      repoAiEdits[repoRaw] = { rows: 0, aiLines: 0, totalLines: 0, aiPercent: null };
    }
    repoAiEdits[repoRaw].rows += 1;
    repoAiEdits[repoRaw].aiLines += aiLines;
    repoAiEdits[repoRaw].totalLines += totalLines;
    repoAiEdits[repoRaw].aiPercent = aiPercent;

    if (developerRaw) {
      const key = `${repoRaw}\t${developerRaw}`;
      if (!repoDeveloperAiEdits[key]) {
        repoDeveloperAiEdits[key] = { rows: 0, aiLines: 0, totalLines: 0, aiPercent: null };
      }
      repoDeveloperAiEdits[key].rows += 1;
      repoDeveloperAiEdits[key].aiLines += aiLines;
      repoDeveloperAiEdits[key].totalLines += totalLines;
      repoDeveloperAiEdits[key].aiPercent = aiPercent;
    }
  }

  return {
    schema: "repoEdits",
    fileMeta: {
      file: fileLabel,
      dateColumn: null,
      userColumn: developerIdx >= 0 ? headers[developerIdx] : null,
      repoColumn: repoIdx >= 0 ? headers[repoIdx] : null,
      amountColumn: aiLinesIdx >= 0 ? headers[aiLinesIdx] : null,
    },
    byMonth: {},
    byRepo: {},
    byDeveloper: {},
    byMonthRepo: {},
    byMonthDeveloper: {},
    byRepoDeveloper: {},
    byDay: {},
    repoAiEdits,
    repoDeveloperAiEdits,
  };
}

/**
 * @param {string[]} headers
 * @param {string[][]} dataRows
 * @param {string} fileLabel
 */
function ingestGeneric(headers, dataRows, fileLabel) {
  const dateIdx = pickColumnIndex(headers, DATE_SYNONYMS);
  const userIdx = pickColumnIndex(headers, USER_SYNONYMS);
  const repoIdx = pickColumnIndex(headers, REPO_SYNONYMS);
  const amountIdx = pickColumnIndex(headers, AMOUNT_SYNONYMS);

  /** @type {Record<string, { rows: number; amount: number }>} */
  const byMonth = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byRepo = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byDeveloper = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byMonthRepo = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byMonthDeveloper = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byRepoDeveloper = {};

  /** @type {Record<string, { rows: number; amount: number }>} */
  const byDay = {};

  for (const row of dataRows) {
    if (row.length < headers.length && row.every((c) => String(c).trim() === "")) continue;

    const dateRaw = dateIdx >= 0 && dateIdx < row.length ? String(row[dateIdx] ?? "") : "";
    const userRaw =
      userIdx >= 0 && userIdx < row.length ? String(row[userIdx] ?? "").trim() : "_unknown";
    const repoRaw =
      repoIdx >= 0 && repoIdx < row.length ? String(row[repoIdx] ?? "").trim() : "_unknown";
    const amountRaw =
      amountIdx >= 0 && amountIdx < row.length ? String(row[amountIdx] ?? "") : "0";

    const month = monthKeyFromCell(dateRaw);
    const amount = amountIdx >= 0 ? parseAmount(amountRaw) : 0;
    const dev = userRaw || "_unknown";
    const repo = repoRaw || "_unknown";
    const iso = isoDayFromCell(dateRaw);
    if (iso) bump(byDay, iso, amount);

    bump(byMonth, month, amount);
    bump(byRepo, repo, amount);
    bump(byDeveloper, dev, amount);
    bump(byMonthRepo, `${month}\t${repo}`, amount);
    bump(byMonthDeveloper, `${month}\t${dev}`, amount);
    bump(byRepoDeveloper, `${repo}\t${dev}`, amount);
  }

  return {
    schema: "tabular",
    fileMeta: {
      file: fileLabel,
      dateColumn: dateIdx >= 0 ? headers[dateIdx] : null,
      userColumn: userIdx >= 0 ? headers[userIdx] : null,
      repoColumn: repoIdx >= 0 ? headers[repoIdx] : null,
      amountColumn: amountIdx >= 0 ? headers[amountIdx] : null,
    },
    byMonth,
    byRepo,
    byDeveloper,
    byMonthRepo,
    byMonthDeveloper,
    byRepoDeveloper,
    byDay,
    repoAiEdits: {},
    repoDeveloperAiEdits: {},
  };
}

/** @param {Record<string, { rows: number; amount: number }>} into @param {Record<string, { rows: number; amount: number }>} from */
function mergeBuckets(into, from) {
  for (const [k, v] of Object.entries(from)) {
    if (!into[k]) into[k] = { rows: 0, amount: 0 };
    into[k].rows += v.rows;
    into[k].amount += v.amount;
  }
}

/** @param {Record<string, { rows: number; aiLines: number; totalLines: number; aiPercent: number | null }>} into @param {Record<string, { rows: number; aiLines: number; totalLines: number; aiPercent: number | null }>} from */
function mergeAiEdits(into, from) {
  for (const [k, v] of Object.entries(from)) {
    if (!into[k]) into[k] = { rows: 0, aiLines: 0, totalLines: 0, aiPercent: null };
    into[k].rows += v.rows;
    into[k].aiLines += v.aiLines;
    into[k].totalLines += v.totalLines;
    if (v.aiPercent != null) into[k].aiPercent = v.aiPercent;
  }
}

/**
 * @param {Record<string, Record<string, { requests: number; users: number; inputTokens?: number; outputTokens?: number; totalTokens?: number }>>} into
 * @param {Record<string, Record<string, { requests: number; users: number; inputTokens?: number; outputTokens?: number; totalTokens?: number }>>} from
 */
function mergeDayModelRequests(into, from) {
  for (const [day, models] of Object.entries(from)) {
    if (!into[day]) into[day] = {};
    mergeModelBreakdownIntoDay(into[day], models);
  }
}

/** @param {Record<string, Record<string, { requests: number; users: number; inputTokens?: number; outputTokens?: number; totalTokens?: number }>>} m */
function sortDayModelRequestsMap(m) {
  const sorted = Object.create(null);
  for (const day of Object.keys(m).sort()) {
    const inner = m[day];
    const innerSorted = Object.create(null);
    for (const slug of Object.keys(inner).sort()) {
      innerSorted[slug] = inner[slug];
    }
    sorted[day] = innerSorted;
  }
  return sorted;
}

function parseArgs(argv) {
  let dir = "data/cursor-analytics/csv";
  /** @type {string | null} */
  let out = null;
  let verbose = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir" && argv[i + 1]) {
      dir = argv[++i];
    } else if (a === "--out" && argv[i + 1]) {
      out = argv[++i];
    } else if (a === "--verbose") {
      verbose = true;
    }
  }
  return { dir, out, verbose };
}

function main() {
  const { dir, out, verbose } = parseArgs(process.argv);
  const root = process.cwd();
  const absDir = path.isAbsolute(dir) ? dir : path.join(root, dir);

  if (!fs.existsSync(absDir)) {
    console.error(`Directory not found: ${absDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(absDir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .map((f) => path.join(absDir, f))
    .sort((a, b) => path.basename(b).localeCompare(path.basename(a), "en"));

  /** Dates already ingested from a newer-range team CSV (skip older duplicate rows). */
  const seenTeamDates = new Set();

  if (files.length === 0) {
    console.warn(`No .csv files in ${absDir}.`);
    if (out) {
      const outAbs = path.isAbsolute(out) ? out : path.join(root, out);
      fs.mkdirSync(path.dirname(outAbs), { recursive: true });
      const emptyReport = {
        schema: "empty",
        generatedAt: new Date().toISOString(),
        directory: path.relative(root, absDir),
        sources: [],
        columnDetection: [],
        byMonth: {},
        byRepo: {},
        byDeveloper: {},
        byMonthRepo: {},
        byMonthDeveloper: {},
        byRepoDeveloper: {},
        byDay: {},
        byDayModelRequests: {},
        repoAiEdits: {},
        repoDeveloperAiEdits: {},
      };
      fs.writeFileSync(outAbs, JSON.stringify(emptyReport, null, 2), "utf8");
      console.log(`Wrote empty summary to ${path.relative(root, outAbs)}`);
    }
    process.exit(0);
  }

  /** @type {Record<string, { rows: number; amount: number }>} */
  const byMonth = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byRepo = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byDeveloper = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byMonthRepo = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byMonthDeveloper = {};
  /** @type {Record<string, { rows: number; amount: number }>} */
  const byRepoDeveloper = {};

  /** @type {Record<string, { rows: number; amount: number }>} */
  const byDay = {};
  /** @type {Record<string, { rows: number; aiLines: number; totalLines: number; aiPercent: number | null }>} */
  const repoAiEdits = {};
  /** @type {Record<string, { rows: number; aiLines: number; totalLines: number; aiPercent: number | null }>} */
  const repoDeveloperAiEdits = {};

  /** @type {Record<string, Record<string, { requests: number; users: number }>>} */
  const byDayModelRequests = {};

  /** @type {string[]} */
  const sources = [];
  /** @type {Array<{ file: string; dateColumn: string | null; userColumn: string | null; repoColumn: string | null; amountColumn: string | null }>} */
  const fileMeta = [];

  /** @type {string[]} */
  const schemas = [];

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rows = parseCsv(text);
    if (rows.length < 2) continue;
    const headers = rows[0].map((h) => String(h));
    const dataRows = rows.slice(1);
    const label = path.basename(file);
    sources.push(path.relative(root, file));

    let chunk;
    if (isTeamDailyRollup(headers)) {
      chunk = ingestTeamDaily(headers, dataRows, label, seenTeamDates);
    } else if (isAiEditsRepoExport(headers)) {
      chunk = ingestAiEditsRepo(headers, dataRows, label);
    } else {
      chunk = ingestGeneric(headers, dataRows, label);
    }
    schemas.push(chunk.schema);
    fileMeta.push(chunk.fileMeta);

    mergeBuckets(byMonth, chunk.byMonth);
    mergeBuckets(byRepo, chunk.byRepo);
    mergeBuckets(byDeveloper, chunk.byDeveloper);
    mergeBuckets(byMonthRepo, chunk.byMonthRepo);
    mergeBuckets(byMonthDeveloper, chunk.byMonthDeveloper);
    mergeBuckets(byRepoDeveloper, chunk.byRepoDeveloper);
    mergeBuckets(byDay, chunk.byDay ?? {});
    mergeDayModelRequests(byDayModelRequests, chunk.byDayModelRequests ?? {});
    mergeAiEdits(repoAiEdits, chunk.repoAiEdits ?? {});
    mergeAiEdits(repoDeveloperAiEdits, chunk.repoDeveloperAiEdits ?? {});
  }

  const schema =
    new Set(schemas).size > 1 ? 'mixed' : (schemas[0] ?? 'tabular');

  const report = {
    schema,
    generatedAt: new Date().toISOString(),
    directory: path.relative(root, absDir),
    sources,
    columnDetection: fileMeta,
    byMonth,
    byRepo,
    byDeveloper,
    byMonthRepo: sortKeys(byMonthRepo),
    byMonthDeveloper: sortKeys(byMonthDeveloper),
    byRepoDeveloper: sortKeys(byRepoDeveloper),
    byDay: sortKeys(byDay),
    byDayModelRequests: sortDayModelRequestsMap(byDayModelRequests),
    repoAiEdits: sortMetricKeys(repoAiEdits),
    repoDeveloperAiEdits: sortMetricKeys(repoDeveloperAiEdits),
  };

  if (verbose) {
    console.error(JSON.stringify({ schema, columnDetection: report.columnDetection }, null, 2));
  }

  const json = JSON.stringify(report, null, 2);
  if (out) {
    const outAbs = path.isAbsolute(out) ? out : path.join(root, out);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, json, "utf8");
    console.log(`Wrote ${path.relative(root, outAbs)}`);
  } else {
    console.log(json);
  }
}

main();
