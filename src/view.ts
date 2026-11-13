import { ItemView, Notice, TAbstractFile, WorkspaceLeaf, setIcon } from "obsidian";
import type ConfessionPlugin from "./main";
import { Question, Tick, makeTick } from "./data";
import { formatDateTime, formatDay, t } from "./i18n";
import { ConfirmModal, EditorModal, NoteModal } from "./modals";

export const VIEW_TYPE = "confession-tracker";
const LONG_PRESS_MS = 500;

export class ConfessionView extends ItemView {
	private renderToken = 0;
	/** Questions whose notes list is expanded; kept across re-renders. */
	private openNotes = new Set<string>();
	/** Last count shown per question, to pulse the number when it changes. */
	private lastCounts = new Map<string, number>();

	constructor(leaf: WorkspaceLeaf, private plugin: ConfessionPlugin) {
		super(leaf);
	}

	getViewType() {
		return VIEW_TYPE;
	}

	getDisplayText() {
		return t("viewTitle");
	}

	getIcon() {
		return "church";
	}

	async onOpen() {
		const onChange = (file: TAbstractFile, oldPath?: string) => {
			const path = this.plugin.questionsPath();
			if (file.path === path || oldPath === path) this.render();
		};
		this.registerEvent(this.app.vault.on("modify", (f) => onChange(f)));
		this.registerEvent(this.app.vault.on("create", (f) => onChange(f)));
		this.registerEvent(this.app.vault.on("delete", (f) => onChange(f)));
		this.registerEvent(this.app.vault.on("rename", onChange));
		await this.render();
	}

	async render() {
		const token = ++this.renderToken;
		const state = await this.plugin.readState();
		if (token !== this.renderToken) return;

		const el = this.contentEl;
		const scroll = el.scrollTop;
		el.empty();
		el.addClasses(["confession-view", "ct-book"]);
		const page = el.createDiv("ct-page");

		const header = page.createDiv("ct-header");
		const title = header.createDiv("ct-title");
		title.createSpan({ cls: "ct-fleuron", text: "❦" });
		title.createSpan({ text: t("title") });
		title.createSpan({ cls: "ct-fleuron is-flipped", text: "❦" });

		if (state.status === "missing") {
			header.createDiv("ct-double-rule");
			page.createEl("p", { cls: "ct-message", text: t("noFile", { path: state.path }) });
			const footer = page.createDiv("ct-footer");
			footer.createEl("button", { text: t("createFile"), cls: "mod-cta" }).onclick = () =>
				this.plugin.createQuestionsFile().catch((e) => this.fail(e));
			return;
		}
		if (state.status === "invalid") {
			header.createDiv("ct-double-rule");
			page.createEl("p", { cls: "ct-message", text: t("invalidFile", { path: state.path }) });
			const footer = page.createDiv("ct-footer");
			footer.createEl("button", { text: t("openNote") }).onclick = () =>
				this.app.workspace.getLeaf(true).openFile(state.file);
			return;
		}

		const { data } = state;
		header.createDiv({ cls: "ct-since", text: t("since", { date: formatDay(data.period_start) }) });
		header.createDiv("ct-double-rule");

		let shown = 0;
		for (const section of data.sections) {
			const visible = section.questions.filter((q) => q.visible);
			if (!visible.length) continue;
			const heading = page.createEl("h3", { cls: "ct-section" });
			const [initial = "", ...rest] = Array.from(section.name.trim());
			heading.createSpan({ cls: "ct-initial", text: initial });
			heading.createSpan({ cls: "ct-section-rest", text: rest.join("") });
			const list = page.createDiv("ct-questions");
			for (const q of visible) this.renderQuestion(list, q);
			shown += visible.length;
		}
		if (!shown) page.createEl("p", { text: t("noVisible"), cls: "ct-empty" });

		const footer = page.createDiv("ct-footer");
		footer.createDiv({ cls: "ct-fleuron", text: "❧" });
		footer.createEl("button", { text: t("wentToConfession"), cls: "mod-cta" }).onclick = () =>
			this.plugin.confirmConfession();
		footer.createEl("button", { text: t("editQuestions"), cls: "ct-edit-link" }).onclick = () =>
			new EditorModal(this.app, this.plugin, data).open();

		el.scrollTop = scroll;
	}

	private renderQuestion(parent: HTMLElement, q: Question) {
		const row = parent.createDiv("ct-question");
		row.toggleClass("is-zero", q.ticks.length === 0);
		const main = row.createDiv("ct-main");
		main.createDiv({ cls: "ct-text", text: q.text });
		this.renderNotes(main, q);

		const controls = row.createDiv("ct-controls");
		const minus = controls.createEl("button", { cls: "ct-step", attr: { "aria-label": "−1" } });
		setIcon(minus, "minus");
		const value = controls.createDiv("ct-value");
		const count = value.createSpan({ cls: "ct-count", text: String(q.ticks.length) });
		const previous = this.lastCounts.get(q.id);
		if (previous !== undefined && previous !== q.ticks.length) count.addClass("is-pulsing");
		this.lastCounts.set(q.id, q.ticks.length);
		if (q.unit) value.createSpan({ cls: "ct-unit", text: q.unit });
		const plus = controls.createEl("button", { cls: "ct-step is-plus", attr: { "aria-label": "+1" } });
		setIcon(plus, "plus");

		minus.onclick = () => {
			const index = q.ticks.length - 1;
			const last = q.ticks[index];
			if (!last) return;
			if (!last.text) {
				// Quick ticks: remove the current last one if it has no note (safe for rapid taps).
				return this.editQuestion(q.id, (item) => {
					if (!item.ticks[item.ticks.length - 1]?.text) item.ticks.pop();
				});
			}
			const remove = () => this.changeTick(q.id, index, last, (ticks) => ticks.splice(index, 1));
			const body = `${t("removeLastBody")}\n\n${last.at ? formatDateTime(last.at) + " · " : ""}${last.text}`;
			new ConfirmModal(this.app, q.text, body, t("delete"), remove).open();
		};

		// Short tap: +1. Long press (or right click): +1 with a note.
		let timer: number | null = null;
		let longPressed = false;
		const cancelTimer = () => {
			if (timer !== null) window.clearTimeout(timer);
			timer = null;
		};
		const openNote = () => {
			cancelTimer();
			if (longPressed) return;
			longPressed = true;
			new NoteModal(this.app, q.text, "", (text) =>
				this.editQuestion(q.id, (item) => item.ticks.push(makeTick(text))),
			).open();
		};
		plus.addEventListener("pointerdown", () => {
			longPressed = false;
			cancelTimer();
			timer = window.setTimeout(openNote, LONG_PRESS_MS);
		});
		plus.addEventListener("pointerup", cancelTimer);
		plus.addEventListener("pointerleave", cancelTimer);
		plus.addEventListener("pointercancel", cancelTimer);
		plus.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			openNote();
		});
		plus.addEventListener("click", () => {
			if (longPressed) {
				longPressed = false;
				return;
			}
			this.editQuestion(q.id, (item) => item.ticks.push(makeTick()));
		});
	}

	/** Collapsible list of this period's notes, newest first. Tap one to edit or delete it. */
	private renderNotes(parent: HTMLElement, q: Question) {
		const notes = q.ticks.map((tick, index) => ({ tick, index })).filter(({ tick }) => tick.text).reverse();
		if (!notes.length) return;

		const details = parent.createEl("details", { cls: "ct-notes" });
		details.open = this.openNotes.has(q.id);
		details.addEventListener("toggle", () => {
			if (details.open) this.openNotes.add(q.id);
			else this.openNotes.delete(q.id);
		});
		details.createEl("summary", {
			text: notes.length === 1 ? t("notesOne") : t("notesMany", { n: notes.length }),
		});
		const list = details.createEl("ul");
		for (const { tick, index } of notes) {
			const item = list.createEl("li", { cls: "ct-note" });
			if (tick.at) item.createSpan({ cls: "ct-note-at", text: formatDateTime(tick.at) });
			item.createSpan({ cls: "ct-note-text", text: tick.text });
			item.onclick = () =>
				new NoteModal(
					this.app,
					q.text,
					tick.text ?? "",
					(text) =>
						this.changeTick(q.id, index, tick, (ticks) => {
							const value = text.trim();
							if (value) ticks[index].text = value;
							else delete ticks[index].text;
						}),
					() => this.changeTick(q.id, index, tick, (ticks) => ticks.splice(index, 1)),
				).open();
		}
	}

	private editQuestion(id: string, fn: (q: Question) => void) {
		this.plugin
			.updateData((data) => {
				for (const s of data.sections) for (const q of s.questions) if (q.id === id) fn(q);
			})
			.catch((e) => this.fail(e));
	}

	/** Changes the tick at `index`, but only if it is still the one the user saw. */
	private changeTick(id: string, index: number, expected: Tick, fn: (ticks: Tick[]) => void) {
		this.editQuestion(id, (q) => {
			const current = q.ticks[index];
			if (!current || current.at !== expected.at || current.text !== expected.text) throw new Error(t("noteChanged"));
			fn(q.ticks);
		});
	}

	private fail(e: unknown) {
		new Notice(t("error", { error: String((e as Error)?.message ?? e) }));
	}
}
