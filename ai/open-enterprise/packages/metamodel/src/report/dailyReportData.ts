// ---------------------------------------------------------------------------
// Daily-report data contract — the only interface between the render template and the server generation logic.
//
// This type is the static form of data.json (see templates/daily-report/assets/data.example.json):
// the template accepts only this shape, and the generation logic produces only this shape. Either side
// that wants to change starts here, so the compiler catches the other side — instead of a page rendering undefined overnight.
//
// ── Where numbers and text come from ───────────────────────────────────────
//   · Every number / date / count / amount: deterministic server calculation (collect + scoring).
//     The LLM never touches them.
//   · Fields marked `AiText`: text slots the LLM writes, injected once in the finalize stage.
//   Generation assembles this object in those two groups. See ../pipeline/assemble.ts.
//
// ── Why color and icons live in the data ───────────────────────────────────
//   The template renders with no branch: level→color and trend→arrow are computed on the server and handed over as color values.
//   The page draws what it receives. The phone shell and the web shell then share this one payload,
//   and the frontend does not grow a second level→color map (two copies would drift).
// ---------------------------------------------------------------------------

/** Text produced by the LLM. Distinct from an ordinary string so assembly can exhaustively check which cells the model wrote. */
export type AiText = string & { readonly __brand: "AiText" };

/** Trend direction. The template draws the arrow and the up/down color from this. */
export type Trend = "up" | "down" | "flat";

/** Level color. The requirement uses only three tiers, high / medium / low. scoring supplies the color. */
export type RiskLevel = "high" | "medium" | "low";

export interface ReportHeader {
  readonly title: string;
  /** A formatted date, for example "August 10, 2026". */
  readonly date: string;
  readonly weekday: string;
  /** The daily report counts from the status at generation time. It does not replay asOf. */
  readonly statusAsOf: string;
}

export interface HealthScore {
  /** Display score = clamp(internalScore, 60, 95). */
  readonly score: number;
  readonly fullScore: number;
  /** Difference from yesterday's display score. null when there is no baseline to compare. */
  readonly change: number | null;
  readonly label: string;
}

export interface AiJudge {
  /** Operating status: Steady / Needs attention / Tight (mapped from level). */
  readonly status: string;
  readonly statusColor: string;
  readonly description: AiText;
  /** Key phrases in description to highlight (the template bolds and colors them). */
  readonly highlightParts: readonly string[];
}

export interface Indicator {
  readonly name: string;
  /** A formatted numeric string (decimal places are fixed by the calculation layer). */
  readonly value: string;
  readonly unit: string;
  /** null when there is no baseline to compare. The page shows "No comparison yet". */
  readonly change: number | null;
  readonly changeUnit: string;
  readonly trend: Trend;
  /** Color expresses the operating impact. It is not inferred backwards from the numeric arrow. */
  readonly sentiment: "positive" | "negative" | "neutral";
  /** A secondary deterministic indicator on the same card, such as the collection rate under cumulative sales. */
  readonly supplementary?: string;
}

export interface Overview {
  readonly title: string;
  readonly indicators: readonly Indicator[];
  readonly dataQuality: {
    readonly status: "complete" | "partial";
    readonly message: string;
  };
}

/** An AI summary paragraph. type picks the render style: text is a plain paragraph, followUp is to follow up, alert is a warning, risk is a risk. */
export interface SummaryParagraph {
  readonly type: "text" | "followUp" | "alert" | "risk";
  /** text type: the whole paragraph. */
  readonly content?: AiText;
  /** Optional highlight phrases for the text type. */
  readonly highlightParts?: readonly string[];
  /** followUp / alert / risk types: the badge and the body. */
  readonly icon?: string;
  readonly dotColor?: string;
  readonly label?: string;
  readonly labelColor?: string;
}

export interface AiSummary {
  readonly title: string;
  readonly paragraphs: readonly SummaryParagraph[];
}

/** Three stat cards: normal, watch, and warning. */
export interface BottomStat {
  readonly icon: string;
  readonly iconBg: string;
  readonly bg: string;
  readonly borderColor: string;
  readonly countColor: string;
  readonly titleColor: string;
  readonly title: string;
  readonly count: number;
  readonly unit: string;
  readonly description: string;
}

// ── Three things the owner must watch today ────────────────────────────────
// contents is a discriminated union: the three cards (delivery / production / approval) have different inner blocks, and the template branches on type.

export interface ChartSeries {
  readonly dates: readonly string[];
  /** null means that day has no computable denominator. The chart stays blank instead of pretending it is 0. */
  readonly values: readonly (number | null)[];
  readonly yUnit?: string;
  readonly peakIndex?: number;
  readonly peakLabel?: string;
  readonly endLabel?: string;
}

export interface BossContentSectionTitle {
  readonly type: "section-title";
  readonly text: string;
}

export interface BossContentHighlightCard {
  readonly type: "highlight-card";
  readonly customer: string;
  readonly amount: string;
  readonly amountUnit: string;
  readonly tags: readonly string[];
}

export interface BossContentTrend {
  readonly type: "trend";
  readonly title: string;
  readonly chartId: string;
  readonly data: ChartSeries;
}

export interface BossContentBarChart {
  readonly type: "bar-chart";
  readonly title: string;
  readonly chartId: string;
  readonly data: ChartSeries;
}

/** Shortage table (used by the production-risk card): rows and columns both come from the calculation layer. */
export interface BossContentTable {
  readonly type: "table";
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface BossContentText {
  readonly type: "text";
  readonly text: AiText;
}

export interface BossContentBigNumber {
  readonly type: "big-number";
  readonly value: string;
  readonly unit: string;
  readonly label: string;
}

export interface BossContentSuggestion {
  readonly type: "suggestion";
  readonly text: AiText;
}

export type BossFocusContent =
  | BossContentSectionTitle
  | BossContentHighlightCard
  | BossContentTrend
  | BossContentBarChart
  | BossContentTable
  | BossContentText
  | BossContentBigNumber
  | BossContentSuggestion;

export interface BossFocus {
  readonly number: string;
  readonly title: string;
  readonly subtitle: string;
  readonly bg: string;
  readonly borderColor: string;
  readonly headerColor: string;
  readonly contents: readonly BossFocusContent[];
}

// ── Operating-chain analysis ───────────────────────────────────────────────

export interface ChainMetric {
  readonly value: string;
  readonly unit: string;
}

export interface ChainSection {
  readonly icon: string;
  readonly title: string;
  readonly metrics: readonly ChainMetric[];
  readonly subInfo: string;
  readonly chartId: string;
  readonly chartColor: string;
  readonly chartData: ChartSeries;
  readonly aiText: AiText;
}

export interface BusinessChain {
  readonly title: string;
  readonly sections: readonly ChainSection[];
}

// ── Risks identified by AI ─────────────────────────────────────────────────

export interface RiskDistributionItem {
  readonly name: string;
  readonly value: number;
  readonly color: string;
}

export interface RiskDistribution {
  readonly chartId: string;
  readonly data: readonly RiskDistributionItem[];
  readonly totalLabel: string;
}

export interface RiskTrend {
  readonly title: string;
  readonly chartId: string;
  readonly dates: readonly string[];
  /** null means that day has no completed daily-report baseline. The chart breaks instead of filling 0. */
  readonly values: readonly (number | null)[];
  readonly yLabels: readonly string[];
  readonly peakIndex: readonly number[];
  readonly peakLabels: readonly string[];
}

export interface RiskItem {
  readonly level: RiskLevel;
  readonly levelColor: string;
  readonly desc: string;
  readonly scope: string;
  readonly amount: string;
  readonly owner: string;
  readonly due: string;
}

export interface BusinessRisk {
  readonly title: string;
  readonly distribution: RiskDistribution;
  readonly trend: RiskTrend;
  readonly riskList: readonly RiskItem[];
}

// ── Today's action list ────────────────────────────────────────────────────

export interface ActionItem {
  readonly time: string;
  readonly person: string;
  /** Action title: "confirm + object + action", polished by the LLM. */
  readonly task: AiText;
  readonly level: RiskLevel;
  readonly levelColor: string;
  readonly dotColor: string;
  readonly evidence: string;
}

export interface ActionSection {
  readonly title: string;
  readonly items: readonly ActionItem[];
}

export interface ActionList {
  readonly title: string;
  readonly sections: readonly ActionSection[];
}

// ── Top level ──────────────────────────────────────────────────────────────

export interface DailyReportData {
  readonly header: ReportHeader;
  readonly healthScore: HealthScore;
  readonly aiJudge: AiJudge;
  readonly overview: Overview;
  readonly summary: AiSummary;
  readonly bottomStats: readonly BottomStat[];
  readonly bossFocus: readonly BossFocus[];
  readonly businessChain: BusinessChain;
  readonly businessRisk: BusinessRisk;
  readonly actionList: ActionList;
}
