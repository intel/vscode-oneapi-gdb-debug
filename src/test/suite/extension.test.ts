import * as assert from 'assert';
import { after } from 'mocha';

import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Extension test started!');

    after(() => {
        vscode.window.showInformationMessage('Extension tests done!');
    });

    test('Sample test', () => {

        // TODO:
        // 1. Check if "Extension Pack For Intel oneapi" is installed and contains below extensions:
        // 1.a. "Environment configurator"
        // 1.b. "Analysis tool"
        // 1.c. "Code sample browser"
        // 1.d. "GDB with GPU debug Support"
        // 1.e. "Devcloud connector"
        //
        // 2. Check GUI functions
        // 2.a. Generate Launch Json
        // 2.b. List unique oneapi commands (help)
        // 2.c. Open online oneapi documentation (help)
        // 2.d. Refresh SIMD
        //

        vscode.extensions.getExtension("intel-corporation.analysis-tools-launcher");

        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        // assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });
});
