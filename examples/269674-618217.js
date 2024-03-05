webpack["618217"] = function (e, t, n) {
	"use strict";
	n.r(t),
		n.d(t, {
			default: function () {
				return N;
			},
		});
	var i = n("735250"),
		a = n("470079"),
		s = n("803997"),
		l = n.n(s),
		r = n("295807"),
		o = n("974328"),
		u = n("209760"),
		d = n("158619"),
		c = n("517191"),
		f = n("623664"),
		p = n("362"),
		m = n("517899"),
		h = n("144944"),
		E = n("30175"),
		_ = n("791074"),
		I = n("894434");
	function C(e) {
		let { text: t, language: a } = e,
			s = () =>
				(0, i.jsx)("pre", {
					children: (0, i.jsx)("code", {
						className: l()(I.scrollbarGhostHairline, _.codeView, "hljs"),
						children: t,
					}),
				});
		return (0, i.jsx)(r.LazyLibrary, {
			createPromise: () => n.el("618217@3479:3574").then(n.bind(n, "787079")),
			webpackId: "787079",
			render: (e) => {
				if (!e.hasLanguage(a)) return s();
				let n = e.highlight(a, t, !0);
				return null == n
					? s()
					: (0, i.jsx)("pre", {
							children: (0, i.jsx)("code", {
								className: l()(
									I.scrollbarGhostHairline,
									_.codeView,
									"hljs",
									n.language,
								),
								dangerouslySetInnerHTML: { __html: n.value },
							}),
					  });
			},
			renderFallback: () => s(),
		});
	}
	function y(e) {
		let { expanded: t, setExpanded: n, isWholeFile: a, numLines: s } = e,
			l = (
				a
					? E.default.Messages.PREVIEW_NUM_LINES
					: E.default.Messages.PREVIEW_NUM_LINES_AT_LEAST
			).format({ lines: s });
		return (0, i.jsx)(o.Tooltip, {
			text: `${
				t ? E.default.Messages.COLLAPSE : E.default.Messages.EXPAND
			} (${l})`,
			children: (e) =>
				(0, i.jsxs)(o.Clickable, {
					...e,
					className: _.toggleExpandSection,
					onClick: () => {
						n(!t);
					},
					children: [
						(0, i.jsx)(f.default, {
							direction: t
								? f.default.Directions.UP
								: f.default.Directions.DOWN,
						}),
						t ? E.default.Messages.COLLAPSE : E.default.Messages.EXPAND,
					],
				}),
		});
	}
	function S(e) {
		let { attachment: t } = e,
			n = `${t.filename} (${(0, d.formatKbSize)(t.size)})`;
		return (0, i.jsxs)(i.Fragment, {
			children: [
				(0, i.jsx)(o.Tooltip, {
					text: n,
					children: (e) =>
						(0, i.jsx)("span", {
							...e,
							className: l()(_.downloadSection, _.attachmentName),
							children: t.filename,
						}),
				}),
				(0, i.jsx)(o.Tooltip, {
					text: n,
					children: (e) =>
						(0, i.jsx)("span", {
							...e,
							className: l()(_.downloadSection, _.formattedSize),
							children: (0, d.formatKbSize)(t.size),
						}),
				}),
				(0, i.jsx)(o.Tooltip, {
					text: `${E.default.Messages.DOWNLOAD} ${n}`,
					children: (e) =>
						(0, i.jsx)(o.Anchor, {
							...e,
							className: _.downloadSection,
							href: t.url,
							target: "_blank",
							rel: "noreferrer noopener",
							children: (0, i.jsx)(p.default, {
								className: _.downloadButton,
								width: 24,
								height: 24,
							}),
						}),
				}),
			],
		});
	}
	function g(e) {
		let { language: t, setLanguage: n } = e;
		return (0, i.jsx)(o.Popout, {
			position: "left",
			renderPopout: (e) => {
				let { closePopout: a } = e;
				return (0, i.jsx)(o.Dialog, {
					"aria-label": E.default.Messages.PREVIEW_CHANGE_LANGUAGE,
					children: (0, i.jsx)(o.Combobox, {
						className: _.languageSelector,
						multiSelect: !1,
						placeholder: E.default.Messages.PREVIEW_SEARCH_LANGUAGE_PLACEHOLDER,
						value: new Set([t]),
						autoFocus: !0,
						onChange: (e) => {
							n(e), a();
						},
						children: (e) =>
							Array.from(u.PLAINTEXT_FILE_EXTENSIONS)
								.filter((t) => t.toLowerCase().includes(e.toLowerCase()))
								.map((e) =>
									(0, i.jsx)(
										o.ComboboxItem,
										{
											value: e,
											children: (0, i.jsx)(o.ComboboxItem.Label, {
												children: e,
											}),
										},
										e,
									),
								),
					}),
				});
			},
			children: (e) =>
				(0, i.jsx)(o.Tooltip, {
					text: E.default.Messages.PREVIEW_CHANGE_LANGUAGE,
					children: (t) =>
						(0, i.jsx)(h.default, {
							width: 24,
							height: 24,
							...t,
							...e,
							className: _.codeIcon,
						}),
				}),
		});
	}
	function x(e) {
		return (0, i.jsx)(o.Tooltip, {
			text: E.default.Messages.PREVIEW_WHOLE_FILE,
			children: (t) =>
				(0, i.jsx)(o.Clickable, {
					...t,
					className: _.openFullPreviewSection,
					onClick: () => {
						(0, o.openModal)((t) => (0, i.jsx)(A, { ...e, ...t }));
					},
					children: (0, i.jsx)(m.default, {}),
				}),
		});
	}
	function T(e) {
		let {
				attachment: t,
				fileContents: n,
				expanded: a,
				setExpanded: s,
				language: r,
				setLanguage: u,
				bytesLeft: c,
				className: f,
			} = e,
			p = n?.split("\n"),
			m = p?.length ?? 0,
			h = a ? 100 : 6,
			I = 0 === c,
			T = "";
		I && a && m > h ? (T = "\n...") : !I && (T = "..."),
			"" !== T &&
				(I
					? (T +=
							" " +
							E.default.Messages.PREVIEW_LINES_LEFT.format({ lines: m - h }))
					: (T +=
							" " +
							E.default.Messages.PREVIEW_BYTES_LEFT.format({
								formattedBytes: (0, d.formatKbSize)(c),
							})));
		let A = p?.slice(0, h).join("\n") + T,
			N = a || h < m;
		return (0, i.jsxs)("div", {
			className: l()(f, _.container),
			children: [
				(0, i.jsx)("div", {
					className: l()(_.textContainer, { [_.expanded]: a }),
					children:
						null == n
							? (0, i.jsx)(o.Spinner, { className: _.spinner })
							: (0, i.jsx)(C, { text: A, language: r }),
				}),
				(0, i.jsxs)(o.Text, {
					color: "header-secondary",
					className: _.footer,
					variant: "text-sm/normal",
					children: [
						N
							? (0, i.jsxs)(i.Fragment, {
									children: [
										(0, i.jsx)(y, {
											expanded: a,
											setExpanded: s,
											isWholeFile: I,
											numLines: m,
										}),
										(0, i.jsx)(x, {
											language: r,
											fileContents: n,
											bytesLeft: c,
											attachment: t,
										}),
									],
							  })
							: null,
						(0, i.jsx)("div", { className: _.footerGap }),
						(0, i.jsx)(S, { attachment: t }),
						(0, i.jsx)(g, { language: r, setLanguage: u }),
					],
				}),
			],
		});
	}
	function A(e) {
		let {
				transitionState: t,
				language: n,
				fileContents: s,
				bytesLeft: l,
				attachment: r,
			} = e,
			[u, c] = a.useState(n),
			f = s ?? "";
		return (
			0 !== l &&
				(f += `... ${E.default.Messages.PREVIEW_BYTES_LEFT.format({
					formattedBytes: (0, d.formatKbSize)(l),
				})}`),
			(0, i.jsx)(o.ModalRoot, {
				transitionState: t,
				"aria-label": E.default.Messages.PREVIEW_MODAL_LABEL,
				size: o.ModalSize.LARGE,
				className: _.modalRoot,
				children: (0, i.jsxs)("div", {
					className: _.modalContent,
					children: [
						(0, i.jsx)(o.ScrollerThin, {
							className: _.modalTextContainer,
							children:
								null == s
									? (0, i.jsx)(o.Spinner, { className: _.spinner })
									: (0, i.jsx)(C, { text: f, language: u }),
						}),
						(0, i.jsxs)(o.Text, {
							color: "header-secondary",
							className: _.footer,
							variant: "text-sm/normal",
							children: [
								(0, i.jsx)("div", { className: _.footerGap }),
								(0, i.jsx)(S, { attachment: r }),
								(0, i.jsx)(g, { language: u, setLanguage: c }),
							],
						}),
					],
				}),
			})
		);
	}
	var N = a.memo(
		function (e) {
			let { attachment: t, className: n, onClick: s, onContextMenu: r } = e,
				[o, u] = a.useState(!1),
				[d, f] = a.useState(t.filename.split(".").slice(-1)[0]),
				{
					fileContents: p,
					bytesLeft: m,
					hadError: h,
				} = (function (e, t) {
					let [n, i] = a.useState(!1),
						[s, l] = a.useState(null),
						[r, o] = a.useState(1);
					return (
						a.useEffect(() => {
							(async function n() {
								try {
									let n = await fetch(e, {
											headers: { Range: "bytes=0-50000", Accept: "text/plain" },
										}),
										a = (function (e) {
											let t = "utf-8",
												n = e?.split("charset=").slice(-1)[0] ?? t;
											try {
												return new TextDecoder(n);
											} catch (i) {
												if (
													e?.startsWith("text") ||
													n.toLowerCase().includes("utf")
												)
													return new TextDecoder(t);
												throw i;
											}
										})(t).decode(await n.arrayBuffer()),
										s = n.headers.get("content-range") ?? "0",
										r = n.headers.get("content-length") ?? "1",
										u = parseInt(s.split("/")[1]) - parseInt(r);
									l(0 === u ? a : a.slice(0, -1)), o(u), i(!1);
								} catch (e) {
									o(0), i(!0);
								}
							})();
						}, [e, t]),
						{ fileContents: s, bytesLeft: r, hadError: n }
					);
				})(t.url, t.content_type);
			return h
				? (0, i.jsx)(c.default, {
						url: t.url,
						filename: t.filename,
						size: t.size,
						onClick: s,
						onContextMenu: r,
						className: n,
				  })
				: (0, i.jsx)(T, {
						attachment: t,
						fileContents: p,
						bytesLeft: m,
						expanded: o,
						setExpanded: u,
						language: d,
						setLanguage: f,
						className: l()(_.newMosaicStyle, n),
				  });
		},
		(e, t) =>
			e.attachment.id === t.attachment.id && e.className === t.className,
	);
};
