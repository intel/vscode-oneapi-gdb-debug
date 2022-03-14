import * as assert from 'assert';
import { after } from 'mocha';

import * as vscode from 'vscode';
import * as intellauncher from '../../extension';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Extension test started!');

	test('Sample test', () => {
		assert.equal([1, 2, 3].indexOf(5), -1);
		assert.equal([1, 2, 3].indexOf(0), -1);
	});
});