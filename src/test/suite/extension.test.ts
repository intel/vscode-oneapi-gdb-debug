import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', async () => {
	vscode.window.showInformationMessage('Start all tests.');
	await vscode.extensions.getExtension("intel-corporation.analysis-tools-launcher");

	test('Sample test', () => {
		assert.strictEqual([1, 2, 3].indexOf(5), -1);
		assert.strictEqual([1, 2, 3].indexOf(0), -1);
	});
});
