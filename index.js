#!/usr/bin/env node
import * as process from "process";
import * as fs from "fs";
import * as prettier from "prettier";
import { cleanString } from "./clean.js";

const input = fs.readFileSync(process.stdin.fd, 'utf-8');
const output = cleanString(input);
prettier.format(output, {
	parser: "babel",
	printWidth: 98,
	useTabs: true,
}).then(output => {
	fs.writeFileSync(process.stdout.fd, output);
})
