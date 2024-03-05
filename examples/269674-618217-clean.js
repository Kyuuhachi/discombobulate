webpack["618217"] = function (module, exports, require) {
	"use strict";
	require.r(exports);
	require.d(exports, { default: () => _default });
	var ReactJsx = require("735250");
	var _0 = require("470079");
	var _1 = require.n(require("803997"));
	var _2 = require("295807");
	var _3 = require("974328");
	var _4 = require("209760");
	var _5 = require("158619");
	var _6 = require("517191");
	var _7 = require("623664");
	var _8 = require("362");
	var _9 = require("517899");
	var _10 = require("144944");
	var _11 = require("30175");
	var _12 = require("791074");
	var _13 = require("894434");
	function A0({ text, language }) {
		let b1 = () => (
			<pre>
				<code className={_1()(_13.scrollbarGhostHairline, _12.codeView, "hljs")}>{text}</code>
			</pre>
		);
		return (
			<_2.LazyLibrary
				createPromise={() => require.el("618217@3479:3574").then(require.bind(require, "787079"))}
				webpackId={"787079"}
				render={(c0) => {
					if (!c0.hasLanguage(language)) {
						return b1();
					}
					let c1 = c0.highlight(language, text, true);
					return null == c1 ? (
						b1()
					) : (
						<pre>
							<code
								className={_1()(_13.scrollbarGhostHairline, _12.codeView, "hljs", c1.language)}
								dangerouslySetInnerHTML={{ __html: c1.value }}
							/>
						</pre>
					);
				}}
				renderFallback={() => b1()}
			/>
		);
	}
	function A1({ expanded, setExpanded, isWholeFile, numLines }) {
		let d1 = (
			isWholeFile
				? _11.default.Messages.PREVIEW_NUM_LINES
				: _11.default.Messages.PREVIEW_NUM_LINES_AT_LEAST
		).format({ lines: numLines });
		return (
			<_3.Tooltip
				text={`${expanded ? _11.default.Messages.COLLAPSE : _11.default.Messages.EXPAND} (${d1})`}
			>
				{(props) => (
					<_3.Clickable
						{...props}
						className={_12.toggleExpandSection}
						onClick={() => {
							setExpanded(!expanded);
						}}
					>
						<_7.default
							direction={expanded ? _7.default.Directions.UP : _7.default.Directions.DOWN}
						/>
						{expanded ? _11.default.Messages.COLLAPSE : _11.default.Messages.EXPAND}
					</_3.Clickable>
				)}
			</_3.Tooltip>
		);
	}
	function A2({ attachment }) {
		let text = `${attachment.filename} (${_5.formatKbSize(attachment.size)})`;
		return (
			<ReactJsx.Fragment>
				<_3.Tooltip text={text}>
					{(props) => (
						<span {...props} className={_1()(_12.downloadSection, _12.attachmentName)}>
							{attachment.filename}
						</span>
					)}
				</_3.Tooltip>
				<_3.Tooltip text={text}>
					{(props) => (
						<span {...props} className={_1()(_12.downloadSection, _12.formattedSize)}>
							{_5.formatKbSize(attachment.size)}
						</span>
					)}
				</_3.Tooltip>
				<_3.Tooltip text={`${_11.default.Messages.DOWNLOAD} ${text}`}>
					{(props) => (
						<_3.Anchor
							{...props}
							className={_12.downloadSection}
							href={attachment.url}
							target={"_blank"}
							rel={"noreferrer noopener"}
						>
							<_8.default className={_12.downloadButton} width={24} height={24} />
						</_3.Anchor>
					)}
				</_3.Tooltip>
			</ReactJsx.Fragment>
		);
	}
	function A3({ language, setLanguage }) {
		return (
			<_3.Popout
				position={"left"}
				renderPopout={({ closePopout }) => {
					return (
						<_3.Dialog aria-label={_11.default.Messages.PREVIEW_CHANGE_LANGUAGE}>
							<_3.Combobox
								className={_12.languageSelector}
								multiSelect={false}
								placeholder={_11.default.Messages.PREVIEW_SEARCH_LANGUAGE_PLACEHOLDER}
								value={new Set([language])}
								autoFocus={true}
								onChange={(f0) => {
									setLanguage(f0);
									closePopout();
								}}
							>
								{(g0) =>
									Array.from(_4.PLAINTEXT_FILE_EXTENSIONS)
										.filter((h0) => h0.toLowerCase().includes(g0.toLowerCase()))
										.map((value) => (
											<_3.ComboboxItem value={value} key={value}>
												<_3.ComboboxItem.Label>{value}</_3.ComboboxItem.Label>
											</_3.ComboboxItem>
										))
								}
							</_3.Combobox>
						</_3.Dialog>
					);
				}}
			>
				{(props) => (
					<_3.Tooltip text={_11.default.Messages.PREVIEW_CHANGE_LANGUAGE}>
						{(props0) => (
							<_10.default
								width={24}
								height={24}
								{...props0}
								{...props}
								className={_12.codeIcon}
							/>
						)}
					</_3.Tooltip>
				)}
			</_3.Popout>
		);
	}
	function A4(props) {
		return (
			<_3.Tooltip text={_11.default.Messages.PREVIEW_WHOLE_FILE}>
				{(props0) => (
					<_3.Clickable
						{...props0}
						className={_12.openFullPreviewSection}
						onClick={() => {
							_3.openModal((props1) => <A6 {...props} {...props1} />);
						}}
					>
						<_9.default />
					</_3.Clickable>
				)}
			</_3.Tooltip>
		);
	}
	function A5({
		attachment,
		fileContents,
		expanded,
		setExpanded,
		language,
		setLanguage,
		bytesLeft,
		className,
	}) {
		let i1 = fileContents?.split("\n");
		let numLines = i1?.length ?? 0;
		let i2 = expanded ? 100 : 6;
		let isWholeFile = 0 === bytesLeft;
		let i3 = "";
		if (isWholeFile && expanded && numLines > i2) {
			i3 = "\n...";
		} else {
			if (!isWholeFile) {
				i3 = "...";
			}
		}
		if ("" !== i3) {
			if (isWholeFile) {
				i3 += " " + _11.default.Messages.PREVIEW_LINES_LEFT.format({ lines: numLines - i2 });
			} else {
				i3 +=
					" " +
					_11.default.Messages.PREVIEW_BYTES_LEFT.format({
						formattedBytes: _5.formatKbSize(bytesLeft),
					});
			}
		}
		let text = i1?.slice(0, i2).join("\n") + i3;
		let i4 = expanded || i2 < numLines;
		return (
			<div className={_1()(className, _12.container)}>
				<div className={_1()(_12.textContainer, { [_12.expanded]: expanded })}>
					{null == fileContents ? (
						<_3.Spinner className={_12.spinner} />
					) : (
						<A0 text={text} language={language} />
					)}
				</div>
				<_3.Text color={"header-secondary"} className={_12.footer} variant={"text-sm/normal"}>
					{i4 ? (
						<ReactJsx.Fragment>
							<A1
								expanded={expanded}
								setExpanded={setExpanded}
								isWholeFile={isWholeFile}
								numLines={numLines}
							/>
							<A4
								language={language}
								fileContents={fileContents}
								bytesLeft={bytesLeft}
								attachment={attachment}
							/>
						</ReactJsx.Fragment>
					) : null}
					<div className={_12.footerGap} />
					<A2 attachment={attachment} />
					<A3 language={language} setLanguage={setLanguage} />
				</_3.Text>
			</div>
		);
	}
	function A6({ transitionState, language, fileContents, bytesLeft, attachment }) {
		let [language0, setLanguage] = _0.useState(language);
		let text = fileContents ?? "";
		if (0 !== bytesLeft) {
			text += `... ${_11.default.Messages.PREVIEW_BYTES_LEFT.format({
				formattedBytes: _5.formatKbSize(bytesLeft),
			})}`;
		}
		return (
			<_3.ModalRoot
				transitionState={transitionState}
				aria-label={_11.default.Messages.PREVIEW_MODAL_LABEL}
				size={_3.ModalSize.LARGE}
				className={_12.modalRoot}
			>
				<div className={_12.modalContent}>
					<_3.ScrollerThin className={_12.modalTextContainer}>
						{null == fileContents ? (
							<_3.Spinner className={_12.spinner} />
						) : (
							<A0 text={text} language={language0} />
						)}
					</_3.ScrollerThin>
					<_3.Text color={"header-secondary"} className={_12.footer} variant={"text-sm/normal"}>
						<div className={_12.footerGap} />
						<A2 attachment={attachment} />
						<A3 language={language0} setLanguage={setLanguage} />
					</_3.Text>
				</div>
			</_3.ModalRoot>
		);
	}
	function a7(k0) {
		// outlined
		let k1 = "utf-8";
		let k2 = k0?.split("charset=").slice(-1)[0] ?? k1;
		try {
			return new TextDecoder(k2);
		} catch (l0) {
			if (k0?.startsWith("text") || k2.toLowerCase().includes("utf")) {
				return new TextDecoder(k1);
			}
			throw l0;
		}
	}
	function a8(m0, m1) {
		// outlined
		let [hadError, m2] = _0.useState(false);
		let [fileContents, m3] = _0.useState(null);
		let [bytesLeft, m4] = _0.useState(1);
		_0.useEffect(() => {
			(async function n0() {
				try {
					let o0 = await fetch(m0, { headers: { Range: "bytes=0-50000", Accept: "text/plain" } });
					let o1 = a7(m1).decode(await o0.arrayBuffer());
					let o2 = o0.headers.get("content-range") ?? "0";
					let o3 = o0.headers.get("content-length") ?? "1";
					let o4 = parseInt(o2.split("/")[1]) - parseInt(o3);
					m3(0 === o4 ? o1 : o1.slice(0, -1));
					m4(o4);
					m2(false);
				} catch (p0) {
					m4(0);
					m2(true);
				}
			})();
		}, [m0, m1]);
		return { fileContents, bytesLeft, hadError };
	}
	var _default = _0.memo(
		function ({ attachment, className, onClick, onContextMenu }) {
			let [expanded, setExpanded] = _0.useState(false);
			let [language, setLanguage] = _0.useState(attachment.filename.split(".").slice(-1)[0]);
			let { fileContents, bytesLeft, hadError } = a8(attachment.url, attachment.content_type);
			return hadError ? (
				<_6.default
					url={attachment.url}
					filename={attachment.filename}
					size={attachment.size}
					onClick={onClick}
					onContextMenu={onContextMenu}
					className={className}
				/>
			) : (
				<A5
					attachment={attachment}
					fileContents={fileContents}
					bytesLeft={bytesLeft}
					expanded={expanded}
					setExpanded={setExpanded}
					language={language}
					setLanguage={setLanguage}
					className={_1()(_12.newMosaicStyle, className)}
				/>
			);
		},
		(r0, r1) => r0.attachment.id === r1.attachment.id && r0.className === r1.className,
	);
};
