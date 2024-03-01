#!/usr/bin/env node
import * as process from "node:process";
import * as fsp from "node:fs/promises";

import { program } from 'commander';
import * as prettier from "prettier";
import { cleanString } from "./clean.js";

program.option("-n, --no-prettier").option("--prettier");
program.parse();
const opts = program.opts();

if(program.args.length) {
	const results = []
	for(const path of program.args) {
		const input = await fsp.readFile(path);
		const output = await run(input);
		console.log(path);
		results.push({
			path,
			output,
		});
	}
	for(const { path, output } of results) {
		await fsp.writeFile(path, output);
	}
} else {
	const inbuf = [];
	for await(const chunk of process.stdin) inbuf.push(chunk);
	const input = Buffer.concat(inbuf);
	const output = await run(input);
	await process.stdout.write(output);
}

async function run(buf) {
	let text = buf.toString('utf8')
	text = cleanString(text);
	if(opts.prettier) {
		text = await prettier.format(text, {
			parser: "babel-ts",
			printWidth: 98,
			useTabs: true,
		})
	}
	return text;
}
