/**
 * Copyright (c) 2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import * as vscode from "vscode";

export class FilterHelpWebview {
    static show(context: vscode.ExtensionContext) {
        const panel = vscode.window.createWebviewPanel(
            "filterHelp",
            "Filter Help",
            vscode.ViewColumn.Active,
            {
                enableScripts: false,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, "media"),
                ],
            }
        );

        const styleUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, "media", "filterHelp.css")
        );

        panel.webview.html = this.getHtml(styleUri);
    }

    private static getHtml(styleUri: vscode.Uri): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>SIMD Thread Filter Help</title>
</head>
<body>
    <h3>Thread Filter Options Help</h3>
    <p>
        Thread filter options allow to filter the range of thread or lanes and also then further filter from the selection using expression options given below.
    </p>
    <p>
        Here is the overview of these options:
    </p>
    <ul>
        <li>
            Select range of threads using available options. The option <code>\"all\"</code> shows all threads and the option <code>\"custom range\"</code> allows to enter range for consecutive list of threads. E.g. <code>1-5</code>
        </li>
        <li>
            Similarly lanes can be filtered from one of these options, <code>\"all\"</code> i.e. all lanes of each thread, <code>\"selected\"</code> i.e. default selected range of each thread and lastly custom range of lanes can be selected e.g. <code>1-3</code> i.e. all 1 to 3 lanes of each stopped thread.
        </li>
        <li>
            The selected range of threads and lanes can be further filtered using the combination of these GPU application fields <code>\"Work-item Local ID\"</code> / <code>\"Work-item Global ID\"</code> / <code>\"Work-group ID\"</code>.
        </li>
        <li>
            All these options take input in <code>x,y,z</code> format.
        </li>
        <li>
            To skip any of x/y/z either use <code>*</code> or leave the place empty for respective value.<br/>
            E.g. <code>\"y\"</code> can be skipped by entering value <code>\"x,*,z\"</code> or <code>\"x,,z\"</code>
        </li>
        <li>
            To enter range with maximum and minimum value of x/y/z, <code>*</code> can be used in place of end range for any of these.
        </li>
        <li>
            E.g. <code>\"x\"</code> can be filtered for all values where x ≥ 100 using input value <code>\"100\"</code> or for range of values <code>100-*</code> to filter all values where x ≥ 100.
        </li>
        <li>
            In addition to above filter options more advance C/C++ expressions can be added using gdb-oneapi.<br/>
            Convenience or program variables can be used for filter using <code>\"Custom Expression\"</code> text box.
        </li>
    </ul>
    <h4>Examples using convenience variables:</h4>
    <pre>
1) To filter all threads with Id above 150: $_thread > 150
2) To filter all threads where the first index of the workitem_local_id
   convenience variable is greater than 0: $_workitem_local_id[0] > 0
3) Both (1) & (2) can be used together by using logical operator:
   $_thread > 150 && $_workitem_local_id[0] > 0
    </pre>

    <h4>Example using program variables:</h4>
    <pre>
To filter all threads with variable "x" value greater than 100
   but less than 200: x>100 && x<200
    </pre>
</body>
</html>`;
    }
}
