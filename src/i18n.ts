import * as obsidian from "obsidian";

const en = {
	viewTitle: "Confession",
	title: "Examination of conscience",
	since: "since {date}",
	editQuestions: "Edit questions",
	wentToConfession: "I went to confession",
	noFile: "The questions note {path} doesn't exist yet.",
	createFile: "Create it with example questions",
	invalidFile: "Couldn't read the questions in {path}. Check its YAML frontmatter.",
	openNote: "Open note",
	noVisible: "There are no visible questions. Use “Edit questions” to add some.",
	confirmBody: "This saves the current counts to a history note for {start} → {end} and resets all counters to 0.",
	confirm: "Save and reset",
	cancel: "Cancel",
	save: "Save",
	historySaved: "Saved {path} and reset the counters.",
	historyEmpty: "Nothing was recorded in this period.",
	question: "Question",
	count: "Count",
	sectionName: "Section name",
	unit: "Unit",
	show: "Show",
	hide: "Hide",
	addQuestion: "Add question",
	addSection: "Add section",
	deleteSection: "Delete section",
	cannotDeleteSection: "Only empty sections can be deleted. Hide its questions instead.",
	moveUp: "Move up",
	moveDown: "Move down",
	defaultUnit: "times",
	newSection: "New section",
	settingsQuestionsPath: "Questions note",
	settingsQuestionsPathDesc: "Note that stores the questions and the current counts.",
	settingsHistoryFolder: "History folder",
	settingsHistoryFolderDesc: "Folder where a note is saved each time you go to confession.",
	commandOpen: "Open confession tracker",
	error: "Confession tracker: {error}",
	notesOne: "1 note",
	notesMany: "{n} notes",
	notePlaceholder: "What happened?",
	delete: "Delete",
	removeLastBody: "This deletes the last +1 and its note:",
	noteChanged: "This note changed in the meantime. Try again.",
};

export type Key = keyof typeof en;

const es: Record<Key, string> = {
	viewTitle: "Confesión",
	title: "Examen de conciencia",
	since: "desde el {date}",
	editQuestions: "Editar preguntas",
	wentToConfession: "Me he confesado",
	noFile: "La nota de preguntas {path} todavía no existe.",
	createFile: "Crearla con preguntas de ejemplo",
	invalidFile: "No se pudieron leer las preguntas de {path}. Revisa su frontmatter YAML.",
	openNote: "Abrir nota",
	noVisible: "No hay preguntas visibles. Usa «Editar preguntas» para añadir algunas.",
	confirmBody: "Se guardarán los contadores actuales en una nota de historial para {start} → {end} y se pondrán todos a 0.",
	confirm: "Guardar y reiniciar",
	cancel: "Cancelar",
	save: "Guardar",
	historySaved: "Guardado {path} y contadores reiniciados.",
	historyEmpty: "No se registró nada en este periodo.",
	question: "Pregunta",
	count: "Cantidad",
	sectionName: "Nombre de la sección",
	unit: "Unidad",
	show: "Mostrar",
	hide: "Ocultar",
	addQuestion: "Añadir pregunta",
	addSection: "Añadir sección",
	deleteSection: "Eliminar sección",
	cannotDeleteSection: "Solo se pueden eliminar secciones vacías. Oculta sus preguntas en su lugar.",
	moveUp: "Subir",
	moveDown: "Bajar",
	defaultUnit: "veces",
	newSection: "Nueva sección",
	settingsQuestionsPath: "Nota de preguntas",
	settingsQuestionsPathDesc: "Nota que guarda las preguntas y los contadores actuales.",
	settingsHistoryFolder: "Carpeta de historial",
	settingsHistoryFolderDesc: "Carpeta donde se guarda una nota cada vez que te confiesas.",
	commandOpen: "Abrir registro de confesión",
	error: "Registro de confesión: {error}",
	notesOne: "1 nota",
	notesMany: "{n} notas",
	notePlaceholder: "¿Qué ha pasado?",
	delete: "Borrar",
	removeLastBody: "Se borrará el último +1 y su nota:",
	noteChanged: "Esta nota ha cambiado mientras tanto. Vuelve a intentarlo.",
};

export type Lang = "en" | "es";
const strings: Record<Lang, Record<Key, string>> = { en, es };

export let lang: Lang = "en";

export function initLanguage(): void {
	let code = "en";
	try {
		const getLanguage = (obsidian as unknown as { getLanguage?: () => string }).getLanguage;
		code = getLanguage?.() || window.localStorage.getItem("language") || "en";
	} catch {
		// Fall back to English.
	}
	const base = code.toLowerCase().split("-")[0];
	lang = base in strings ? (base as Lang) : "en";
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
	return strings[lang][key].replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/** "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" as a local date; null if it doesn't match. */
function parseLocal(value: string): { date: Date; hasTime: boolean } | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(value);
	if (!m) return null;
	const date = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
	return { date, hasTime: m[4] !== undefined };
}

function format(value: string, options: Intl.DateTimeFormatOptions): string {
	const parsed = parseLocal(value);
	if (!parsed) return value;
	const opts = { ...options };
	if (parsed.date.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
	if (!parsed.hasTime) {
		delete opts.hour;
		delete opts.minute;
	}
	return new Intl.DateTimeFormat(lang, opts).format(parsed.date);
}

/** "1 de noviembre" / "November 1" (with the year if it isn't this year). */
export function formatDay(value: string): string {
	return format(value, { day: "numeric", month: "long" });
}

/** "13 nov, 21:40" / "Nov 13, 9:40 PM". */
export function formatDateTime(value: string): string {
	return format(value, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
