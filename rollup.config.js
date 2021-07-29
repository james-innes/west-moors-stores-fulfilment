import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import livereload from "rollup-plugin-livereload";
import replaceHtmlVars from "rollup-plugin-replace-html-vars";
import { terser } from "rollup-plugin-terser";
import sveltePreprocess from "svelte-preprocess";
import babel from "rollup-plugin-babel";

const production = !process.env.ROLLUP_WATCH;

export default {
	input: "src/main.js",
	output: {
		sourcemap: true,
		format: "iife",
		name: "app",
		file: "public/build/bundle.js",
	},
	plugins: [
		replaceHtmlVars({
			files: "public/index.html",
			from: ["GOOGLE"],
			to: [process.env.GOOGLE],
		}),
		svelte({
			preprocess: sveltePreprocess({
				sourceMap: !production,
				defaults: { style: "scss" },
				scss: {
					prependData: `@import 'src/styles.scss';`,
				},
				postcss: {
					plugins: [require("autoprefixer")()],
				},
			}),

			dev: !production,
			css: css => css.write("bundle.css"),
			onwarn: (warning, handler) => {
				if (warning.code.includes("a11y")) return;
				handler(warning);
			},
		}),
		resolve({
			browser: true,
			dedupe: ["svelte"],
		}),
		commonjs(),
		production &&
			babel({
				extensions: [".js", ".mjs", ".html", ".svelte"],
				runtimeHelpers: true,
				exclude: ["node_modules/@babel/**", "node_modules/core-js/**"],
				presets: [
					[
						"@babel/preset-env",
						{
							targets: {
								esmodules: true,
							},
							loose: true,
							modules: false,
							useBuiltIns: "usage",
							corejs: 3,
						},
					],
				],
				plugins: [
					"@babel/plugin-syntax-dynamic-import",
					"@babel/plugin-proposal-optional-chaining",
					"@babel/plugin-proposal-object-rest-spread",
				],
			}),
		!production && serve(),
		!production && livereload("public"),
		production && terser(),
	],
	watch: {
		clearScreen: false,
	},
};

function serve() {
	let server;
	function toExit() {
		if (server) server.kill(0);
	}

	return {
		writeBundle() {
			if (server) return;
			server = require("child_process").spawn(
				"npm",
				["run", "start", "--", "--dev"],
				{
					stdio: ["ignore", "inherit", "inherit"],
					shell: true,
				}
			);
			process.on("SIGTERM", toExit);
			process.on("exit", toExit);
		},
	};
}
