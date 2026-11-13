import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	getFrontMatterInfo,
	normalizePath,
	parseYaml,
	stringifyYaml,
} from "obsidian";
import { TrackerData, exampleData, historyMarkdown, normalize, today } from "./data";
import { formatDay, initLanguage, lang, t } from "./i18n";
import { ConfirmModal } from "./modals";
import { ConfessionView, VIEW_TYPE } from "./view";

interface Settings {
	questionsPath: string;
	historyFolder: string;
}

const DEFAULT_SETTINGS: Settings = {
	questionsPath: "Confession/Questions.md",
	historyFolder: "Confession/History",
};

export type State =
	| { status: "missing"; path: string }
	| { status: "invalid"; path: string; file: TFile }
	| { status: "ok"; path: string; file: TFile; data: TrackerData };

export default class ConfessionPlugin extends Plugin {
	settings: Settings = DEFAULT_SETTINGS;
	private queue: Promise<unknown> = Promise.resolve();

	async onload() {
		initLanguage();
		await this.loadSettings();

		this.registerView(VIEW_TYPE, (leaf) => new ConfessionView(leaf, this));
		this.addRibbonIcon("church", t("commandOpen"), () => this.activateView());
		this.addCommand({ id: "open", name: t("commandOpen"), callback: () => this.activateView() });
		this.addCommand({ id: "went-to-confession", name: t("wentToConfession"), callback: () => this.confirmConfession() });
		this.addSettingTab(new ConfessionSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshViews();
	}

	questionsPath(): string {
		return normalizePath(this.settings.questionsPath);
	}

	refreshViews() {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
			if (leaf.view instanceof ConfessionView) leaf.view.render();
		}
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getLeaf(true);
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	/** Reads the questions note straight from disk, so it is never stale. */
	async readState(): Promise<State> {
		const path = this.questionsPath();
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return { status: "missing", path };
		const info = getFrontMatterInfo(await this.app.vault.read(file));
		let data: TrackerData | null = null;
		try {
			data = info.exists ? normalize(parseYaml(info.frontmatter)) : null;
		} catch {
			data = null;
		}
		return data ? { status: "ok", path, file, data } : { status: "invalid", path, file };
	}

	/** Applies `fn` to the questions note's frontmatter. Updates run one at a time. */
	updateData(fn: (data: TrackerData) => void): Promise<TrackerData> {
		const run = async () => {
			const path = this.questionsPath();
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) throw new Error(t("noFile", { path }));
			let result = null as TrackerData | null;
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				const data = normalize(fm);
				if (!data) throw new Error(t("invalidFile", { path }));
				fn(data);
				fm.period_start = data.period_start;
				fm.sections = data.sections;
				result = data;
			});
			return result as TrackerData;
		};
		const next = this.queue.then(run, run);
		this.queue = next.catch(() => undefined);
		return next;
	}

	async ensureFolder(folder: string) {
		const parts = normalizePath(folder).split("/").filter((p) => p && p !== ".");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
		}
	}

	async createQuestionsFile() {
		const path = this.questionsPath();
		await this.ensureFolder(path.split("/").slice(0, -1).join("/"));
		await this.app.vault.create(path, "---\n" + stringifyYaml(exampleData(lang)) + "---\n");
	}

	async confirmConfession() {
		const state = await this.readState();
		if (state.status !== "ok") {
			new Notice(t(state.status === "missing" ? "noFile" : "invalidFile", { path: state.path }));
			return;
		}
		const end = today();
		new ConfirmModal(
			this.app,
			t("wentToConfession"),
			t("confirmBody", { start: formatDay(state.data.period_start), end: formatDay(end) }),
			t("confirm"),
			() => this.goToConfession().catch((e) => new Notice(t("error", { error: String(e?.message ?? e) }))),
		).open();
	}

	/** Saves the current period to a history note, then resets all counters. */
	async goToConfession() {
		const state = await this.readState();
		if (state.status !== "ok") throw new Error(t("invalidFile", { path: state.path }));
		const end = today();

		const folder = normalizePath(this.settings.historyFolder);
		await this.ensureFolder(folder);
		const base = (folder === "/" ? "" : folder + "/") + `${state.data.period_start} → ${end}`;
		let path = `${base}.md`;
		for (let n = 2; this.app.vault.getAbstractFileByPath(path); n++) path = `${base} (${n}).md`;
		await this.app.vault.create(path, historyMarkdown(state.data, end));

		await this.updateData((data) => {
			for (const s of data.sections) for (const q of s.questions) q.ticks = [];
			data.period_start = end;
		});
		new Notice(t("historySaved", { path }));
	}
}

class ConfessionSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ConfessionPlugin) {
		super(app, plugin);
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl)
			.setName(t("settingsQuestionsPath"))
			.setDesc(t("settingsQuestionsPathDesc"))
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.questionsPath)
					.setValue(this.plugin.settings.questionsPath)
					.onChange(async (value) => {
						this.plugin.settings.questionsPath = value.trim() || DEFAULT_SETTINGS.questionsPath;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName(t("settingsHistoryFolder"))
			.setDesc(t("settingsHistoryFolderDesc"))
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.historyFolder)
					.setValue(this.plugin.settings.historyFolder)
					.onChange(async (value) => {
						this.plugin.settings.historyFolder = value.trim() || DEFAULT_SETTINGS.historyFolder;
						await this.plugin.saveSettings();
					}),
			);
	}
}
