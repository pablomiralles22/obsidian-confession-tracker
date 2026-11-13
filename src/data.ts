import { Lang, t } from "./i18n";

/** One +1. `at` is "YYYY-MM-DD HH:mm" (empty if written by hand without it). */
export interface Tick {
	at: string;
	text?: string;
}

export interface Question {
	id: string;
	text: string;
	unit: string;
	visible: boolean;
	ticks: Tick[];
}

export interface Section {
	name: string;
	questions: Question[];
}

export interface TrackerData {
	period_start: string;
	sections: Section[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function today(): string {
	return ymd(new Date());
}

export function now(): string {
	const d = new Date();
	return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function makeTick(text = ""): Tick {
	const tick: Tick = { at: now() };
	if (text.trim()) tick.text = text.trim();
	return tick;
}

/** Returns a new id not in `taken`, and adds it to `taken`. */
export function newId(taken: Set<string>): string {
	let id: string;
	do {
		id = "q" + Math.random().toString(36).slice(2, 6);
	} while (id.length < 5 || taken.has(id));
	taken.add(id);
	return id;
}

export function allIds(data: TrackerData): Set<string> {
	return new Set(data.sections.flatMap((s) => s.questions.map((q) => q.id)));
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (v == null ? "" : String(v));

function toTick(v: Raw): Tick {
	const at = v.at instanceof Date && !isNaN(v.at.getTime()) ? v.at.toISOString().slice(0, 16).replace("T", " ") : str(v.at);
	const text = str(v.text).trim();
	return text ? { at, text } : { at };
}

function toDate(v: unknown): string | null {
	if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	if (typeof v === "string" && v.trim()) return v.trim();
	return null;
}

/**
 * Turns raw frontmatter into well-formed data: fills in missing fields,
 * and gives every question a unique id. Returns null if there is no `sections` list.
 */
export function normalize(fm: unknown): TrackerData | null {
	if (!isObj(fm) || !Array.isArray(fm.sections)) return null;
	const rawSections = fm.sections.filter(isObj);

	const taken = new Set<string>();
	for (const s of rawSections) {
		for (const q of asArray(s.questions).filter(isObj)) if (str(q.id)) taken.add(str(q.id));
	}

	const seen = new Set<string>();
	const sections = rawSections.map((s) => ({
		name: str(s.name),
		questions: asArray(s.questions)
			.filter(isObj)
			.map((q): Question => {
				let id = str(q.id);
				if (!id || seen.has(id)) id = newId(taken);
				seen.add(id);
				return {
					id,
					text: str(q.text),
					unit: str(q.unit),
					visible: q.visible !== false && q.visible !== "false",
					ticks: asArray(q.ticks).filter(isObj).map(toTick),
				};
			}),
	}));

	return { period_start: toDate(fm.period_start) ?? today(), sections };
}

const EXAMPLES: Record<Lang, [string, [string, string][]][]> = {
	en: [
		["God", [["Did I neglect daily prayer?", "days"], ["Did I miss Mass on a Sunday or holy day of obligation?", "times"]]],
		["Neighbor", [["Did I speak badly of others?", "times"]]],
		["Myself", [["Did I neglect my duties out of laziness?", "days"]]],
	],
	es: [
		["Dios", [["¿Descuidé la oración diaria?", "días"], ["¿Falté a misa en domingo o fiesta de precepto?", "veces"]]],
		["Prójimo", [["¿Hablé mal de otros?", "veces"]]],
		["Uno mismo", [["¿Descuidé mis deberes por pereza?", "días"]]],
	],
};

export function exampleData(lang: Lang): TrackerData {
	const taken = new Set<string>();
	return {
		period_start: today(),
		sections: EXAMPLES[lang].map(([name, qs]) => ({
			name,
			questions: qs.map(([text, unit]) => ({ id: newId(taken), text, unit, visible: true, ticks: [] })),
		})),
	};
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/** Markdown for a history note: only questions with at least one tick, then their notes. */
export function historyMarkdown(data: TrackerData, end: string): string {
	const lines = ["---", `period_start: ${data.period_start}`, `period_end: ${end}`, "---", ""];
	let any = false;
	for (const s of data.sections) {
		const qs = s.questions.filter((q) => q.ticks.length > 0);
		if (!qs.length) continue;
		any = true;
		lines.push(`## ${s.name || "—"}`, "", `| ${t("question")} | ${t("count")} |`, "|---|---|");
		for (const q of qs) lines.push(`| ${cell(q.text)} | ${q.ticks.length}${q.unit ? " " + cell(q.unit) : ""} |`);
		lines.push("");
		for (const q of qs) {
			const notes = q.ticks.filter((tick) => tick.text);
			if (!notes.length) continue;
			lines.push(`**${q.text}**`);
			for (const n of notes) lines.push(`- ${n.at ? n.at + " · " : ""}${(n.text ?? "").replace(/\r?\n/g, "\n  ")}`);
			lines.push("");
		}
	}
	if (!any) lines.push(t("historyEmpty"), "");
	return lines.join("\n");
}
