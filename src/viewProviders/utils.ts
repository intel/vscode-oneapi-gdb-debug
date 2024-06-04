/**
 * Copyright (c) 2022-2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */
import * as vscode from "vscode";

export function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export async function checkGbdOneapiSession(): Promise<vscode.DebugSession | undefined> {
    const session = vscode.debug.activeDebugSession;

    if (!session) {
        return undefined;
    }

    for (let i = 0; i < 3; i++) { // Retry 3 times
        try {
            const evalresult = await session.customRequest("evaluate", { expression: "-exec thread", context: "repl" });

            if (evalresult.result.includes("lane") || evalresult.result.includes("inactive")) {
                return session;
            }
        } catch (error) {
            console.error("Failed to evaluate expression:", error);

            // If it's not the last attempt, wait for a second before retrying
            if (i < 2) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    return undefined;
}

export function parseResultToObject(result: string): { [key: string]: string } {
    const resultObject: { [key: string]: string } = {};

    result.split(/\r\n/).forEach((line: string) => {
        const [key, value] = line.split(": ");

        if (key) {
            resultObject[key.trim()] = value.trim();
        }
    });
    return resultObject;
}