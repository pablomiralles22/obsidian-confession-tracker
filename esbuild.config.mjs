import esbuild from "esbuild";
import { builtinModules } from "node:module";

const prod = process.argv[2] === "production";

const common = {
	bundle: true,
	logLevel: "info",
	minify: prod,
};

// styles.css is generated from src/styles.css, with the fonts embedded so they work offline.
const css = await esbuild.context({
	...common,
	entryPoints: ["src/styles.css"],
	loader: { ".woff2": "dataurl" },
	outfile: "styles.css",
});

const js = await esbuild.context({
	...common,
	entryPoints: ["src/main.ts"],
	external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules],
	format: "cjs",
	target: "es2018",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
});

if (prod) {
	await Promise.all([css.rebuild(), js.rebuild()]);
	process.exit(0);
} else {
	await Promise.all([css.watch(), js.watch()]);
}
