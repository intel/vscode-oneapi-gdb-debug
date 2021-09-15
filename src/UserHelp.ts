/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';


export function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
	return {
		// Enable javascript in the webview
		enableScripts: true,

		// And restrict the webview to only loading content from our extension's `media/userHelp` directory.
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media', 'userHelp')]
	};
}

export class UserHelp {
	private gdbOneapiDocumentationLink = 'https://software.intel.com/gdb-oneapi-documentation';

	openOnlineDocumentation(): void {
		vscode.window
			.showInformationMessage('Open online documentation', 'Open')
			.then(selection => {
				if (selection === 'Open') {
					vscode.env.openExternal(vscode.Uri.parse(this.gdbOneapiDocumentationLink));
				}
			});
	}
}

interface SimpleDescription {
	name: string;
	description?: string;
}

interface PropertyCommand {
	name: string;
	link?: string;
	chapter?: string;
	descriptionShort: string;
	descriptionLong?: string;
}

interface KeyWord {
	name: string;
	aliases?: string;
	descriptionShort: string;
	descriptionLong?: string;
}

interface GDBCommandObject {
	id: string;
	command: PropertyCommand;
	keyWords: Array<KeyWord>;
}

interface UserHelpJSONFormat {
	intro: string;
	intro_oneapiFeatures: string;
	oneapiFeatures: Array<SimpleDescription>;
	intro_comparisonTable: string;
	gdbCommandsToCompare: Array<GDBCommandObject>;
	oneapiCommandsToCompare: Array<GDBCommandObject>;
	intro_oneapiNewCommands: string;
	oneapiNewCommands: Array<GDBCommandObject>;
}

export class DebuggerCommandsPanel {
	public static currentPanel: DebuggerCommandsPanel | undefined;
	public static readonly viewType = 'debuggerCommands';
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	userHelpPath = fs.readFileSync(path.join(__dirname, '..', 'media', 'userHelp', 'content.json'), 'utf8');
	userHelp: UserHelpJSONFormat = JSON.parse(this.userHelpPath);

	public static createOrShow(extensionUri: vscode.Uri): void {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (DebuggerCommandsPanel.currentPanel) {
			DebuggerCommandsPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			DebuggerCommandsPanel.viewType,
			'Debugger Commands',
			column || vscode.ViewColumn.One,
			getWebviewOptions(extensionUri),
		);

		DebuggerCommandsPanel.currentPanel = new DebuggerCommandsPanel(panel, extensionUri);
		DebuggerCommandsPanel.currentPanel._panel.webview.postMessage({command:"userHelp", data:DebuggerCommandsPanel.currentPanel.userHelp});
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): void {
		DebuggerCommandsPanel.currentPanel = new DebuggerCommandsPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			() => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public dispose(): void {
		DebuggerCommandsPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.webview.html = this._getHtmlForWebview(webview);
		this._panel.webview.postMessage({command:"userHelp", data:this.userHelp});
	}

	private _generateHtmlTable_description(firstColumnTitle: string, tableContent: Array<SimpleDescription>) {
		const style_table = 'table table-striped table-col-first-300';
		let table = `<table class='${style_table}'><tr><th>${firstColumnTitle}</th><th>Description</th></tr>`;
		for (const object of tableContent) {
			table += `<tr><td>${object.name}</td>`;
			table += `<td>${object.description}</td></tr>`;
		}
		table += (`</table>`);
		return table;
	}

	private _generateHtmlTable_withClickableCommandWords(firstColumnTitle: string, commandsTable: Array<GDBCommandObject>) {
		const style_tr = 'table-row-50';
		const style_table = 'table table-striped';
		let table = `<table class="${style_table}"><tr><th>${firstColumnTitle}</th><th>Description</th></tr>`;
		for (const object of commandsTable) {
			table += `<tr class='${style_tr}'><td id='${object.id}'>${this._spreadWordsIntoSpanMarkups(object)}</td>`;
			table += `<td>${object.command.descriptionShort} ${object.command.hasOwnProperty("descriptionLong") && object.command.descriptionLong}</td></tr>`;
		}
		table += (`</table>`);
		return table;
	}

	private _spreadWordsIntoSpanMarkups(gdbCommand: GDBCommandObject) {
		let wordsSpreadedIntoSpanMarkups = '';
		for (const word of gdbCommand.keyWords) {
			// Put words into spans lets javascript find every keyword and create popup windows with proper help text to every word
			wordsSpreadedIntoSpanMarkups += `<span class='command-word' id='${this._generateSpanId(word.name, gdbCommand.id)}'>${word.name}</span>`;
		}
		return wordsSpreadedIntoSpanMarkups;
	}

	private _generateSpanId(commandWord: string, commandId: string) {
		return `${commandWord.replace(/[^a-zA-Z-_]/g, '')}_${commandId}`;
	}

	private _generateHtmlTable_comparison(gdbOneapiDifferences: UserHelpJSONFormat) {
		const style_table = 'table table-striped table-content-center';
		const style_tr = 'row-50';
		const style_button = 'button-documentation-mark';
		let gdbComparisonTable = `<table class="${style_table}"><tr><th>GDB</th><th></th><th>Intel® Distribution for GDB</th><th></th></tr>`;
		for (const i in gdbOneapiDifferences.oneapiCommandsToCompare) {
			const commandGdb: GDBCommandObject = gdbOneapiDifferences.gdbCommandsToCompare[i];
			const commandOneapi: GDBCommandObject = gdbOneapiDifferences.oneapiCommandsToCompare[i];

			// 1th column - pure GDB commands
			gdbComparisonTable += `<tr class='${style_tr}'><td id='${commandGdb.id}' class='command'>`;
			gdbComparisonTable += this._spreadWordsIntoSpanMarkups(commandGdb);

			// WARNING: Buttons are not ready yet
			gdbComparisonTable += `</td><td class='min-wdith'><button id='docButton_${commandGdb.id}' class='${style_button}'>?</button>`;
			gdbComparisonTable += `</td>`;

			// 2nd column - GDB oneAPI commands
			gdbComparisonTable += `<td id='${commandOneapi.id}' class='command'>`;
			gdbComparisonTable += this._spreadWordsIntoSpanMarkups(commandOneapi);

			// WARNING: Buttons are not ready yet
			gdbComparisonTable += `</td><td class='min-wdith'><button id='docButton_${commandOneapi.id}' class='${style_button}'>?</button>`;
			gdbComparisonTable += `</td></tr>`;
		}
		gdbComparisonTable += (`</table>`);
		return gdbComparisonTable;
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Links to documentations
		const gdbReferenceSheetLink = 'https://software.intel.com/content/www/us/en/develop/download/gdb-reference-sheet.html';
		const gdbOneapiUserManualLink = 'https://software.intel.com/content/www/us/en/develop/download/gdb-oneapi-user-guide.html';
		const gdbOneapiDocumentationLink = 'https://software.intel.com/gdb-oneapi-documentation';
		const gdbDocumentationLink = 'https://www.gnu.org/software/gdb/documentation/';

		// Local path js scripts run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'userHelp', 'script.js');

		// And the uri we use to load these scripts in the webview
		const scriptUri = (scriptPathOnDisk).with({ 'scheme': 'vscode-resource' });

		// Local path to css styles
		const styleMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'userHelp', 'style.css');

		// Uri to load styles into webview
		const styleMainUri = webview.asWebviewUri(styleMainPath);

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

		// Local path to JSON with descriptions of commands which differ between GDB and GDB-oneapi
		const userHelpPath = fs.readFileSync(path.join(__dirname, '..', 'media', 'userHelp', 'content.json'), 'utf8');
		const userHelp: UserHelpJSONFormat = JSON.parse(userHelpPath);

		// Generate HTML tables
		const oneapiFeaturesTable = this._generateHtmlTable_description("Features", userHelp.oneapiFeatures);
		const gdbComparisonTable = this._generateHtmlTable_comparison(userHelp);
		const oneapiNewCommandsTable = this._generateHtmlTable_withClickableCommandWords("Command", userHelp.oneapiNewCommands);

		const intro = userHelp.intro;
		const intro_oneapiFeatures = userHelp.intro_oneapiFeatures;
		const intro_comparisonTable = userHelp.intro_comparisonTable;
		const intro_oneapiNewCommands = userHelp.intro_oneapiNewCommands;

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleMainUri}" rel="stylesheet">
				<title>Usefull GDB-oneAPI Commands</title>
			</head>
			<body>
				<div class="wrapper">
					<div class="title">
						<h1>Intel® Distribution for GDB:<h1>
					</div>
					<div class="header">
						<a href='${gdbReferenceSheetLink}'>[GDB-oneAPI Cheat Sheet]</a>
						<a href='${gdbOneapiUserManualLink}'>[GDB-oneAPI User Manual]</a>
						<a href='${gdbOneapiDocumentationLink}''>[GDB-oneAPI Online Documentation</a>
						<a href='${gdbDocumentationLink}'>[GDB Documentation]</a>
					</div>
					<div class="content">
						<p class="intro"> ${intro} </p>
						<p class="intro"> ${intro_oneapiFeatures} </p>
						${oneapiFeaturesTable}
						<p class="intro"> ${intro_comparisonTable} </p>
						${gdbComparisonTable}
						<p class="intro" >${intro_oneapiNewCommands} </p>
						${oneapiNewCommandsTable}
					</div>
				</div>
				<script nonce="${nonce}" src="${scriptUri}" type="text/javascript"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

