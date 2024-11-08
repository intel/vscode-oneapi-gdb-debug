/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { SetInputText, Wait, Retry, CheckIfBreakpointHasBeenSet, GetLineNumberWebElement, PerformContextMenuAction, GetStringBetweenStrings, GetExceptionPopupMessage, GetDebugConsoleOutput } from "../CommonFunctions";
import { TextEditor, EditorView, WebElement, Key, Workbench, By } from "vscode-extension-tester";
import { ConditionalBreakpoint, ConditionalBreakpointType } from "./Types";
import { GetCurrentThread } from "../OneApiGpuThreads/OneApiGpuThreads";
import { SimdLane, Thread } from "../OneApiGpuThreads/Types";
import { LoggerAggregator as logger } from "../Logger";
import { assert } from "chai";

export async function SetConditionalBreakpoint(breakpoint: ConditionalBreakpoint): Promise<boolean> {
    const [fileName, lineNumber] = [breakpoint.fileName, breakpoint.lineNumber];

    await SetInputText(fileName, { input: await SetInputText("> Go to File...") });
    await Wait(1 * 1000);
    const textEditor = new TextEditor(new EditorView());

    await Wait(1 * 1000);
    logger.Info(`Go to line: ${lineNumber}`);
    await SetInputText(`:${lineNumber}`);
    await Wait(1 * 1000);
    switch (breakpoint.type) {
    case ConditionalBreakpointType.SimdGui:
    case ConditionalBreakpointType.NativeGui:
        await Retry(async() => {
            await PerformContextMenuAction(
                await GetLineNumberWebElement(breakpoint.lineNumber) as WebElement, "Add Conditional Breakpoint...");
            await (await GetConditionalBreakpointExpressionInput())?.sendKeys(breakpoint.condition, Key.ENTER);
        }, 30 * 1000);
        break;
    case ConditionalBreakpointType.SimdCommand:
        const input = await SetInputText("> Intel oneAPI: Add SIMD lane conditional breakpoint");

        await SetInputText(breakpoint.condition, { input: input });
        break;
    case ConditionalBreakpointType.NativeCommand:
        await Retry(async() => {
            await SetInputText("> Debug: Add Conditional Breakpoint...");
            await (await GetConditionalBreakpointExpressionInput())?.sendKeys(breakpoint.condition, Key.ENTER);
        }, 30 * 1000);
        break;
    default:
        const exception = new Error(`Unknown 'ConditionalBreakpointTypes' member of ${breakpoint.type}`);

        logger.Error(exception);
        throw exception;
    }
    await textEditor.click();
    await Wait(1 * 1000);
    const result = await CheckIfBreakpointHasBeenSet(breakpoint);

    logger.Info(`Breakpoint at line ${lineNumber} has been ${result ? "set" : "removed"}`);
    return result;
}

export async function ContinueDebugging(): Promise<void> {
    logger.Info("Continue debugging");
    const driver = new Workbench().getDriver();
    const continueButton = await driver.findElement(By.css("a.action-label.codicon.codicon-debug-continue"));

    await continueButton.click();
}

export async function CheckIfBreakpointConditionHasBeenMet(options: {
    expectedSimdLaneId?: number;
    expectedThread: Thread;
    breakpoint: ConditionalBreakpoint;
}): Promise<void> {
    const { expectedSimdLaneId, expectedThread, breakpoint } = options;
    const currentThread = await GetCurrentThread() as Thread;
    const breakpointSignature = expectedSimdLaneId ? await (async() => {
        const signature = GetStringBetweenStrings(await GetExceptionPopupMessage() as string, "Hit ", " at");

        return `${(signature as string)[0].toUpperCase()}${(signature as string).slice(1)}`;
    })() : undefined;
    const consoleOutput = await GetDebugConsoleOutput();
    const lastBreakpointHit = consoleOutput.join("\n").match(/Thread.*hit.*with SIMD lane.*at.*/gm)?.pop() as string;
    const lastLaneSwitch = consoleOutput.join("\n").match(/\[Switching to thread \d+.\d+:\d+ \([A-Z]* \d+.\d+.\d+.\d+ lane \d+\)]/gm)?.pop() as string;
    const targetIdDebugConsole = GetStringBetweenStrings(lastLaneSwitch, "(", ")]");
    const threadIdDebugConsole = GetStringBetweenStrings(lastLaneSwitch, "thread ", "(");
    const laneIdDebugConsole = GetStringBetweenStrings(lastLaneSwitch, "lane ", ")]");

    assert.isTrue([currentThread.targetId, targetIdDebugConsole].every(x => x === expectedThread.targetId) &&
    lastBreakpointHit.includes(threadIdDebugConsole) &&
    currentThread.threadId === expectedThread.threadId &&
    currentThread.location === `${breakpoint.fileName}:${breakpoint.lineNumber}` &&
    (currentThread.simdLanes.find(x => x.laneId === Number(laneIdDebugConsole)) as SimdLane).current &&
    expectedSimdLaneId ? currentThread.simdLanes.find(x => x.current)?.laneId === expectedSimdLaneId : true &&
    expectedSimdLaneId ? lastBreakpointHit.includes(breakpointSignature as string) : true);
    logger.Pass("Condition has been met");
}

export async function RemoveAllBreakpoints(): Promise<void> {
    await SetInputText("> Remove All Breakpoints");
}

async function GetConditionalBreakpointExpressionInput() {
    const conditionExpressionInputBox = await new Workbench().getDriver().findElement(By.css("div.inputContainer > div > div > textarea.inputarea.monaco-mouse-cursor-text"));

    if (!conditionExpressionInputBox) { throw new Error("Cannot find conditional BP expression input box"); }
    return conditionExpressionInputBox;
}