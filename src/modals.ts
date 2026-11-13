import { App, Modal, Notice, Platform, Setting, setIcon } from "obsidian";
import type ConfessionPlugin from "./main";
import { Question, Section, TrackerData, allIds, newId } from "./data";
import { t } from "./i18n";

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private body: string,
		private confirmText: string,
		private onConfirm: () => void,
	) {
		super(app);
	}

	onOpen() {
		this.titleEl.setText(this.title);
		this.modalEl.addClass("ct-book");
		this.contentEl.createEl("p", { text: this.body, cls: "ct-confirm-body" });
		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText(t("cancel")).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(this.confirmText)
					.setCta()
					.onClick(() => {
						this.close();
						this.onConfirm();
					}),
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}

function swap<T>(list: T[], i: number, j: number) {
	if (j < 0 || j >= list.length) return;
	[list[i], list[j]] = [list[j], list[i]];
}

/** Edits a copy of the sections; ticks are taken from the note again on save. */
export class EditorModal extends Modal {
	private sections: Section[];
	private ids: Set<string>;
	private focusId: string | null = null;

	constructor(app: App, private plugin: ConfessionPlugin, data: TrackerData) {
		super(app);
		this.sections = JSON.parse(JSON.stringify(data.sections));
		this.ids = allIds(data);
	}

	onOpen() {
		this.titleEl.setText(t("editQuestions"));
		this.modalEl.addClasses(["ct-book", "ct-editor"]);
		this.renderBody();
	}

	onClose() {
		this.contentEl.empty();
	}

	private iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLButtonElement {
		const b = parent.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
		setIcon(b, icon);
		b.onclick = onClick;
		return b;
	}

	private moveButtons<T>(parent: HTMLElement, list: T[], i: number) {
		const up = this.iconButton(parent, "arrow-up", t("moveUp"), () => {
			swap(list, i, i - 1);
			this.renderBody();
		});
		const down = this.iconButton(parent, "arrow-down", t("moveDown"), () => {
			swap(list, i, i + 1);
			this.renderBody();
		});
		up.disabled = i === 0;
		down.disabled = i === list.length - 1;
	}

	private renderBody() {
		const el = this.contentEl;
		el.empty();
		let toFocus: HTMLInputElement | null = null;

		this.sections.forEach((section, si) => {
			const box = el.createDiv("ct-ed-section");
			const head = box.createDiv("ct-ed-row");
			const name = head.createEl("input", {
				type: "text",
				value: section.name,
				cls: "ct-ed-name",
				attr: { placeholder: t("sectionName") },
			});
			name.oninput = () => (section.name = name.value);
			this.moveButtons(head, this.sections, si);
			const del = this.iconButton(head, "trash-2", t("deleteSection"), () => {
				this.sections.splice(si, 1);
				this.renderBody();
			});
			if (section.questions.length) {
				del.disabled = true;
				del.setAttr("aria-label", t("cannotDeleteSection"));
			}

			section.questions.forEach((q, qi) => {
				const row = box.createDiv("ct-ed-question");
				row.toggleClass("is-hidden", !q.visible);
				const text = row.createEl("input", {
					type: "text",
					value: q.text,
					cls: "ct-ed-text",
					attr: { placeholder: t("question") },
				});
				text.oninput = () => (q.text = text.value);
				if (q.id === this.focusId) toFocus = text;

				const line = row.createDiv("ct-ed-row");
				const unit = line.createEl("input", {
					type: "text",
					value: q.unit,
					cls: "ct-ed-unit",
					attr: { placeholder: t("unit") },
				});
				unit.oninput = () => (q.unit = unit.value);
				this.iconButton(line, q.visible ? "eye" : "eye-off", q.visible ? t("hide") : t("show"), () => {
					q.visible = !q.visible;
					this.renderBody();
				});
				this.moveButtons(line, section.questions, qi);
			});

			box.createEl("button", { text: t("addQuestion") }).onclick = () => {
				const q: Question = { id: newId(this.ids), text: "", unit: t("defaultUnit"), visible: true, ticks: [] };
				section.questions.push(q);
				this.focusId = q.id;
				this.renderBody();
			};
		});

		el.createEl("button", { text: t("addSection") }).onclick = () => {
			this.sections.push({ name: t("newSection"), questions: [] });
			this.renderBody();
		};

		new Setting(el)
			.addButton((b) => b.setButtonText(t("cancel")).onClick(() => this.close()))
			.addButton((b) => b.setButtonText(t("save")).setCta().onClick(() => this.save()));

		(toFocus as HTMLInputElement | null)?.focus();
		this.focusId = null;
	}

	private save() {
		const edited = this.sections;
		this.plugin
			.updateData((data) => {
				const ticks = new Map(data.sections.flatMap((s) => s.questions.map((q) => [q.id, q.ticks] as const)));
				data.sections = edited.map((s) => ({
					name: s.name,
					// Drop questions that were added here but left blank; existing ones are never removed.
					questions: s.questions
						.filter((q) => q.text.trim() !== "" || ticks.has(q.id))
						.map((q) => ({ ...q, ticks: ticks.get(q.id) ?? [] })),
				}));
			})
			.then(() => this.close())
			.catch((e) => new Notice(t("error", { error: String(e?.message ?? e) })));
	}
}

/** Text box for a tick's note. With `onDelete`, it also offers to delete the tick. */
export class NoteModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private initial: string,
		private onSave: (text: string) => void,
		private onDelete?: () => void,
	) {
		super(app);
	}

	onOpen() {
		this.titleEl.setText(this.title);
		this.modalEl.addClass("ct-book");
		const input = this.contentEl.createEl("textarea", {
			cls: "ct-note-input",
			attr: { rows: "4", placeholder: t("notePlaceholder") },
		});
		input.value = this.initial;
		const buttons = new Setting(this.contentEl);
		if (this.onDelete) {
			const onDelete = this.onDelete;
			buttons.addButton((b) =>
				b
					.setButtonText(t("delete"))
					.setWarning()
					.onClick(() => {
						this.close();
						onDelete();
					}),
			);
		}
		buttons
			.addButton((b) => b.setButtonText(t("cancel")).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(t("save"))
					.setCta()
					.onClick(() => {
						this.close();
						this.onSave(input.value);
					}),
			);
		if (Platform.isMobile) {
			// On phones the keyboard covers the bottom of the screen: buttons go above the text box,
			// and the window sits at the top and shrinks to the space the keyboard leaves free.
			this.contentEl.prepend(buttons.settingEl);
			this.fitAboveKeyboard();
		}
		window.setTimeout(() => input.focus(), 0);
	}

	private stopFitting: (() => void) | null = null;

	private fitAboveKeyboard() {
		this.containerEl.addClass("ct-above-keyboard");
		const viewport = window.visualViewport;
		if (!viewport) return;
		// The CSS uses these, together with the notch's safe area, to place and size the window.
		const fit = () => {
			this.modalEl.style.setProperty("--ct-vv-top", `${viewport.offsetTop}px`);
			this.modalEl.style.setProperty("--ct-vv-height", `${viewport.height}px`);
		};
		fit();
		viewport.addEventListener("resize", fit);
		viewport.addEventListener("scroll", fit);
		this.stopFitting = () => {
			viewport.removeEventListener("resize", fit);
			viewport.removeEventListener("scroll", fit);
		};
	}

	onClose() {
		this.stopFitting?.();
		this.contentEl.empty();
	}
}
