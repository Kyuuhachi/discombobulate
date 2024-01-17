import BParser    from "@babel/parser";
import BTraverse  from "@babel/traverse";
import BGenerator from "@babel/generator";
import * as t     from "@babel/types";

import {test, Id, T, match} from "./test.js";

const traverse = BTraverse.default;

export function cleanString(source) {
	const ast = BParser.parse(source);
	clean(ast);
	return BGenerator.default(ast).code
}

function eq(a, b) {
	return BGenerator.default(a.node).code === BGenerator.default(b.node).code;
}

export function clean(ast) {
	BTraverse.default(ast, BTraverse.visitors.merge([
		zeroVisitor,
		booleanVisitor,
		addBlockVisitor,
		commaVisitor,
		conditionalVisitor,
		nullCoalesceVisitor,
		optionalParameterVisitor,
		objectParameterVisitor,
		restParameterVisitor,
	]));

	const root = BTraverse.NodePath.get({ parent: ast, container: ast, key: "program" });
	root.scope.crawl();
	if(webpack(root)) {
		jsx(ast);
	}
	BTraverse.default(ast, inferNamesVisitor);
	BTraverse.default(ast, propertyShorthandVisitor);

	// 2015 parameters
	//      template-literals
	//      literals
	//      shorthand-properties
	// 2020 nullish-coalescing-operator
	//      optional-chaining

	// const {scopes} = escope.analyze(ast, { ecmaVersion: 6 });
	// for(const scope of scopes) {
	// 	if(scope.type != "class" && scope.type != "TDZ") {
	// 		for(let variable of scope.variables) {
	// 			for(const def of variable.identifiers) {
	// 				if(def.variable) throw def;
	// 				Object.defineProperty(def, "variable", { value: variable, enumerable: false });
	// 			}
	// 			for(const ref of variable.references) {
	// 				if(ref.identifier.variable !== undefined
	// 					&& !Object.is(ref.identifier.variable, variable)
	// 				) {
	// 					throw ref;
	// 				}
	// 				Object.defineProperty(ref.identifier, "variable", { value: variable, enumerable: false });
	// 			}
	// 		}
	// 	}
	// }
	//
	// unminify(ast);
	// restoreTemplates(ast);
	// const isWebpack = webpack(ast);
	// foldDestructures(ast);
	// if(isWebpack) {
	// 	unjsx(ast);
	// }
	// unzero(ast);
	// inferNames(ast);
	// renameAll(scopes);
	// if(isWebpack) {
	// 	renameJsx(scopes);
	// }
	// objectShorthand(ast);
}

function rename(path, name, { prio = 0 } = {}) {
	if(!path.node) return;
	if(!/^[_a-zA-Z]\w*$/.test(name)) return false;
	path.assertIdentifier();
	if(name == "default") name += "_";
	let bind = binding(path);
	if(bind._renamePrio ?? -1 < prio) {
		bind._renamePrio = prio;
		path.scope.rename(path.node.name, name);
	}
}

// function rename(variable, name, force = false) {
// 	if(!variable || variable._renamed && !force) return false;
// 	if(!/^[_a-zA-Z]\w*$/.test(name)) return false;
//
// 	let vars = [
// 		...variable.scope.through.map(v => v.resolved),
// 		...variable.scope.set.values(),
// 	].filter(v => v);
// 	let rawName = name;
// 	let n = 0;
// 	while(name == "default" || vars.find(v => v.name == name)) {
// 		name = rawName + (n++);
// 	}
//
// 	variable._renamed = true;
// 	variable.name = name;
// 	for(let def of variable.identifiers) def.name = name;
// 	for(let ref of variable.references) ref.identifier.name = name;
// 	return name == rawName;
// }

function binding(path) {
	path.assertIdentifier();
	return path.scope.getBinding(path.node.name);
}

const zeroVisitor = (() => {
	return {
		SequenceExpression(path) {
			if(test(path, T.SequenceExpression({
				expressions: [
					T.NumericLiteral({ value: 0, }),
					T.MemberExpression({
						computed: false,
						object: Id,
						property: T.Identifier,
					}),
				],
			}))) {
				path.replaceWith(path.get("expressions.1"))
			}
		},
	}
})();

const booleanVisitor = (() => {
	return {
		UnaryExpression(path) {
			if(test(path, T.UnaryExpression({
				operator: "!",
				argument: T.NumericLiteral({ value: 0 }),
			}))) path.replaceWith(T.BooleanLiteral({ value: true }));

			if(test(path, T.UnaryExpression({
				operator: "!",
				argument: T.NumericLiteral({ value: 1 }),
			}))) path.replaceWith(T.BooleanLiteral({ value: false }));
		},
	}
})();

const addBlockVisitor = (() => {
	function inner(path) {
		if(path.node && !path.isBlockStatement()) {
			path.replaceWith(t.blockStatement([path.node]));
		}
	}
	return {
		IfStatement(path) {
			inner(path.get("consequent"));
			inner(path.get("alternate"));
		},
		"Loop|WithStatement|LabeledStatement"(path) {
			inner(path.get("body"));
		},
	}
})();

const commaVisitor = (() => {
	function containerOf(node) {
		if(node.container.type == "ForStatement" && node.key == "init") {
			node = node.parentPath;
		}
		if(node.parent.type != "SwitchCase")
			node.parentPath.assertBlockStatement();
		return node;
	}
	function commaInner(node, key) {
		const expr = node.get(key);
		if(expr.isSequenceExpression()) {
			const exprs = expr.node.expressions;
			expr.replaceWith(exprs.pop());
			containerOf(node).insertBefore(exprs.map(t.expressionStatement));
		}
	}

	return {
		VariableDeclaration(path) {
			const kind = path.node.kind;
			const decls = path.node.declarations;
			if(decls.length > 1) {
				path.replaceWith(t.variableDeclaration(kind, [ decls.pop() ]));
				containerOf(path).insertBefore(decls.map(decl => t.variableDeclaration(kind, [decl])));
				path.scope.crawl();
			}
		},
		ExpressionStatement(path) { commaInner(path, "expression"); },
		ReturnStatement(path)     { commaInner(path, "argument"); },
		ThrowStatement(path)      { commaInner(path, "argument"); },
		IfStatement(path)         { commaInner(path, "test"); },
		SwitchStatement(path)     { commaInner(path, "discriminant"); },
		ForStatement(path)        { commaInner(path, "init"); },
		ForInStatement(path)      { commaInner(path, "right"); },
	}
})();

const nullCoalesceVisitor = (() => {
	return {
		ConditionalExpression(path) {
			if(test(path, t.conditionalExpression(
				t.logicalExpression(
					"&&",
					t.binaryExpression(
						"!==",
						t.nullLiteral(),
						t.assignmentExpression(
							"=",
							T.Identifier,
							T.Expression
						),
					),
					t.binaryExpression(
						"!==",
						t.unaryExpression("void", t.numericLiteral(0)),
						Id,
					),
				),
				Id,
				T.Expression,
			))) {
				let a = path.get("test.left.right.left");
				let b = path.get("test.right.right");
				let c = path.get("consequent");
				let bind = binding(a);
				if(bind != binding(b)) return;
				if(bind != binding(c)) return;
				if(bind.path.parent.kind !== "var") return;
				if(bind.path.node.init !== null) return;
				bind.path.remove();
				path.replaceWith(t.logicalExpression(
					"??",
					path.get("test.left.right.right").node,
					path.get("alternate").node
				))
			}
		},
	}
})();

const conditionalVisitor = (() => {
	return {
		ExpressionStatement(path) {
			let expr = path.get("expression");
			if(expr.isConditionalExpression()) {
				path.replaceWith(t.ifStatement(
					expr.node.test,
					t.expressionStatement(expr.node.consequent),
					t.expressionStatement(expr.node.alternate),
				))
			} else if(expr.isLogicalExpression({ operator: "&&" })) {
				path.replaceWith(t.ifStatement(
					expr.node.left,
					t.expressionStatement(expr.node.right),
				))
			} else if(expr.isLogicalExpression({ operator: "||" })) {
				path.replaceWith(t.ifStatement(
					t.unaryExpression("!", expr.node.left),
					t.expressionStatement(expr.node.right),
				))
			}
		},
	}
})();

const optionalParameterVisitor = (() => {
	const arglen = t.memberExpression(Id.arguments, Id.length);

	function addRest(state) {
		if(!state.rest) {
			state.rest = state.func.scope.generateUidIdentifier("rest");
			state.func.pushContainer("params", t.restElement(state.rest));
		}
		return t.cloneNode(state.rest);
	}

	const visitor = {
		Function(path, state) { if(!path.isArrowFunctionExpression()) path.skip(); },

		ConditionalExpression(path, state) {
			if(!state) return;
		},
	}

	return {
		Function: { exit(path) {
			if(!path.isArrowFunctionExpression()) {
				for(const node of path.get("body.body")) {
					if(!node.isVariableDeclaration()) break;
					let decl = node.get("declarations.0");
					let expr = node.get("declarations.0.init");

					let num = path.node.params.length;
					const rhs = t.memberExpression(Id.arguments, t.numericLiteral(num), true);
					const lhs = t.logicalExpression(
						"&&",
						t.binaryExpression(">", arglen, t.numericLiteral(num)),
						t.binaryExpression(
							"!==",
							t.unaryExpression("void", t.numericLiteral(0)),
							rhs,
						),
					);

					if(test(expr, t.conditionalExpression(lhs, rhs, T.Expression))) {
						path.pushContainer("params", t.assignmentPattern(decl.node.id, expr.node.alternate));
						node.remove();
					} else if(test(expr, t.logicalExpression("&&", lhs, rhs))) {
						path.pushContainer("params", t.assignmentPattern(decl.node.id, t.booleanLiteral(false)));
						node.remove();
					} else {
						// todo break
					}
				};
			}
		} }
	};
})();

const objectParameterVisitor = (() => {
	return {
		VariableDeclarator(path) {
			if(test(path, t.variableDeclarator(T.ObjectPattern, Id)) && path.parent.kind == "let") {
				let bind = binding(path.get("init"));
				if(bind.references == 1) {
					let scope = bind.scope;
					let node = bind.path;
					if(node.isVariableDeclarator()) node = node.get("id");
					let left = path.node.id;
					node.replaceWith(left);
					path.remove();
					scope.crawl();
					scope.path.requeue(bind.path);
				}
			}
		}
	};
})();

const restParameterVisitor = (() => {
	const arglen = t.memberExpression(Id.arguments, Id.length);

	function addRest(state) {
		if(!state.rest) {
			state.rest = state.func.scope.generateUidIdentifier("rest");
			state.func.pushContainer("params", t.restElement(state.rest));
		}
		return t.cloneNode(state.rest);
	}

	const visitor = {
		Function(path, state) { if(!path.isArrowFunctionExpression()) path.skip(); },

		ConditionalExpression(path, state) {
			if(!state) return;

			if(test(path, t.conditionalExpression(
				t.binaryExpression("<=", arglen, state.nargs),
				t.numericLiteral(0),
				t.binaryExpression("-", arglen, state.nargs),
			))) {
				path.replaceWith(t.memberExpression(addRest(state), Id.length));
			}

			if(test(path, t.conditionalExpression(
				t.binaryExpression("<=", arglen, t.binaryExpression("+", T.Expression, state.nargs)),
				t.unaryExpression("void", t.numericLiteral(0)),
				t.memberExpression(Id.arguments, t.binaryExpression("+", T.Expression, state.nargs), true),
			))) {
				let a = path.get("test.right.left");
				let b = path.get("alternate.property.left");
				if(eq(a, b)) {
					path.replaceWith(t.memberExpression(addRest(state), a.node, true));
				}
			}
		},
	}

	return {
		Function: { exit(path) {
			if(!path.isArrowFunctionExpression()) {
				path.traverse(visitor, {
					func: path,
					nargs: t.numericLiteral(path.node.params.length),
					rest: null,
				});
			}
		} }
	};
})();

function webpack(root) {
	if(test(root, T.Program({
		body: [ T.ExpressionStatement({
			expression: T.AssignmentExpression({
				left: T.MemberExpression({
					computed: true,
					object: Id.webpack,
					property: T.StringLiteral
				}),
				right: T.FunctionExpression,
			})
		}) ]
	}))) {
		webpackModule(root.get("body.0.expression.right"));
		return true;
	} else {
		return false;
	}
}

function webpackModule(node) {
	const [_module, _exports, _require] = node.get("params");
	rename(_module, "module");
	rename(_exports, "exports");
	rename(_require, "require");

	const requireBinding = binding(_require);
	const Require = T.Identifier({ [match]: path => binding(path) == requireBinding });

	let import_n = 0;
	node.get("body.body").forEach(node => {
		if(test(node, t.variableDeclaration("var", [ t.variableDeclarator(T.Identifier, T.Expression) ]))) {
			const decl = node.get("declarations.0");

			if(test(decl.get("init"), t.callExpression(Require, [T.StringLiteral]))) {
				binding(decl.get("id"))._import = true;
				rename(decl.get("id"), "_" + import_n++, { prio: 1000 });
			}

			if(test(decl.get("init"), t.callExpression(t.memberExpression(Require, Id.n), [Id]))) {
				const inner = decl.get("init.arguments.0");
				const bind = binding(inner);
				if(bind._import) {
					if(bind.references == 1
						&& bind.referencePaths[0].node == inner.node
						&& bind.path.node == node.getPrevSibling().get("declarations.0").node
					) {
						let name = inner.node.name;
						inner.replaceWith(bind.path.node.init);
						bind.path.remove();
						binding(decl.get("id"))._import = true;
						rename(decl.get("id"), name, { prio: 1000 });
					} else {
						throw new Error("invalid require.n()");
					}
				}
			}
		}

		if(test(node, t.expressionStatement(
			t.callExpression(t.memberExpression(Require, Id.d), [ Id.exports, T.ObjectExpression ]),
		))) {
			for(const prop of node.get("expression.arguments.1.properties")) {
				if(!test(prop, t.objectProperty(T.Identifier,
					t.functionExpression(null, [], t.blockStatement([ t.returnStatement() ])),
				))) throw prop.node;
				let name = prop.get("key.name").node;
				if(name === "default") name = "_default";
				let ret = prop.get("value.body.body.0.argument");
				if(ret.isReferencedIdentifier()) {
					rename(ret, name, { prio: 1000 });
				}
				prop.get("value").replaceWith(t.arrowFunctionExpression([], ret.node))
			}
		}
	})
}

const inferNamesVisitor = (() => {
	return {
		"ObjectPattern|ObjectExpression"(path) {
			for(const prop of path.get("properties")) {
				if(test(prop, t.objectProperty(T.Identifier, T.Identifier))) {
					rename(prop.get("value"), prop.node.key.name)
				} else if(test(prop, t.objectProperty(T.Identifier, t.assignmentPattern(T.Identifier, T.Expression)))) {
					rename(prop.get("value.left"), prop.node.key.name)
				}
			}
		},
		JSXSpreadAttribute(path) {
			if(test(path, t.jsxSpreadAttribute(Id))) {
				rename(path.get("argument"), "props");
			}
		},
		JSXAttribute(path) {
			if(test(path, t.jsxAttribute(T.JSXIdentifier, t.jsxExpressionContainer(Id)))) {
				rename(path.get("value.expression"), path.node.name.name);
			}
		}
	}
})();

const propertyShorthandVisitor = (() => {
	return {
		"ObjectPattern|ObjectExpression"(path) {
			for(const prop of path.get("properties")) {
				if(test(prop, t.objectProperty(T.Identifier, T.Identifier))) {
					if(prop.node.value.name == prop.node.key.name)
						prop.node.shorthand = true;
				} else if(test(prop, t.objectProperty(T.Identifier, t.assignmentPattern(T.Identifier, T.Expression)))) {
					if(prop.node.value.left.name == prop.node.key.name)
						prop.node.shorthand = true;
				}
			}
		}
	}
})();

function jsx(ast) {
	function isJsx(path) {
		return test(path, T.CallExpression({
			callee: t.memberExpression(
				T.Identifier({ [match]: p => binding(p)?._import }),
				T.Identifier({ name: n => n == "jsx" || n == "jsxs" }),
			),
			arguments: v => v.length <= 3,
		}))
	}
	function findReact(ast) {
		let state = new Set();
		BTraverse.default(ast, {
			CallExpression(path) {
				if(isJsx(path)) {
					state.add(binding(path.get("callee.object")))
				}
			}
		});
		return state.size == 1 ? [...state][0] : null
	}
	let react = findReact(ast);
	if(!react) return;
	react.path.assertVariableDeclarator();
	rename(react.path.get("id"), "React", { prio: 2000 });

	function jsxName(name, top = true) {
		if(test(name, T.StringLiteral)) {
			return t.jsxIdentifier(name.node.value);
		} else if(test(name, T.MemberExpression({ computed: false }))) {
			return t.jsxMemberExpression(
				jsxName(name.get("object"), false),
				jsxName(name.get("property")),
			);
		} else if(test(name, T.Identifier)) {
			if(top && binding(name)) binding(name)._jsx = true;
			return t.jsxIdentifier(name.node.name);
		} else {
			console.error(name.node);
			throw new Error("invalid jsxName");
		}
	}

	function jsxAttributes(props, key) {
		let children = undefined;
		let attributes = [];
		for(const item of props.get("properties")) {
			if(item.type == "ObjectProperty" && !item.node.computed) {
				if(item.node.key.name == "children") {
					children = jsxChildren(item.node.value);
				} else {
					attributes.push(T.JSXAttribute({
						name: jsxName(item.get("key")),
						value: T.JSXExpressionContainer({ expression: item.node.value }),
					}));
				}
			} else if(item.type == "SpreadElement") {
				attributes.push(t.jsxSpreadAttribute(item.node.argument));
			} else {
				throw new Error("invalid jsxAttributes");
			}
		}
		if(key) {
			attributes.push(t.jsxAttribute(
				t.jsxIdentifier("key"),
				t.jsxExpressionContainer(key.node),
			))
		}
		return [attributes, children]
	}

	function jsxChildren(child) {
		switch(child.type) {
			case "ArrayExpression":
				return child.elements.map(child => {
					switch(child.type) {
						case "JSXElement":
							return child;
						default:
							return t.jsxExpressionContainer(child)
					}
				});
			case "JSXElement":
				return [ child ];
			default:
				return [ t.jsxExpressionContainer(child) ]
		}
	}

	BTraverse.default(ast, {
		CallExpression: { exit(path) {
			if(isJsx(path)) {
				const [_name, props, key] = path.get("arguments");
				const name = jsxName(_name);
				const [attributes, children] = jsxAttributes(props, key);
				path.replaceWith(t.jsxElement(
					t.jsxOpeningElement(name, attributes, children === undefined),
					children !== undefined ? t.jsxClosingElement(name) : null,
					children ?? [],
				))
			}
		} }
	});
}

/*
function renameAll(scopes) {
	function toExcelCol(n) {
		n += 1;
		const chars = []
		let d;
		while(n > 0) {
			const a = Math.floor(n / 26);
			const b = n % 26;
			[n, d] = b === 0 ? [a - 1, b + 26] : [a, b]
			chars.push(String.fromCodePoint('a'.codePointAt(0) + d - 1));
		}
		return chars.join('')
	}
	let nscope = 0;
	for(const scope of scopes) {
		if(scope.type != "class" && scope.type != "TDZ") {
			let scopeName = toExcelCol(nscope);
			let nvar = 0;
			for(let variable of scope.variables) {
				if(variable.tainted) continue;
				if(!variable.defs.length) continue;
				if(variable._renamed) continue;
				rename(variable, scopeName + nvar++)
			}
			if(nvar != 0) nscope += 1;
		}
	}
}

function renameJsx(scopes) {
	for(const scope of scopes) {
		if(scope.type != "class" && scope.type != "TDZ") {
			for(let variable of scope.variables) {
				if(variable.jsx) {
					let fst = variable.name.charAt(0);
					if(fst != fst.toUpperCase()) {
						rename(variable, fst.toUpperCase() + variable.name.slice(1), true);
					} else if(fst == fst.toLowerCase()) {
						rename(variable, "C" + variable.name, true);
					}
				}
			}
		}
	}
}

// }}}

function restoreTemplates(ast) {
	estraverse.replace(ast, {
		leave(node) {
			if(test(node, T.CallExpression({
				callee: T.MemberExpression({
					object: T.StringLiteral,
					property: Id.concat,
				})
			}))) {
				return T.TemplateLiteral({
					quasis: [
						T.TemplateElement({ value: { raw: node.callee.object.value } }),
						T.TemplateElement({ value: { raw: node.arguments[1]?.value ?? "" } }),
					],
					expressions: [
						node.arguments[0],
					],
				})
			}

			if(test(node, T.CallExpression({
				callee: T.MemberExpression({
					object: T.TemplateLiteral,
					property: Id.concat,
				})
			}))) {
				return T.TemplateLiteral({
					quasis: [
						...node.callee.object.quasis,
						T.TemplateElement({ value: { raw: node.arguments[1]?.value ?? "" } }),
					],
					expressions: [
						...node.callee.object.expressions,
						node.arguments[0],
					],
				})
			}
		}
	})
}

*/
