"use strict";
import * as vscode from "vscode";
import { SIMDWatchViewProvider } from "./viewProviders/SIMDWatchViewProvider";
import { parseResultToObject } from "./viewProviders/utils";

export class SIMDWatchProvider {

    private _globalCurrentThread: number | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private simdWatchViewProvider: SIMDWatchViewProvider
    ) {
        const { commands, debug } = vscode;

        this._globalCurrentThread = undefined;

        context.subscriptions.push(
            commands.registerCommand("intelOneAPI.watchPanel.expresionInput", this.expresionInput.bind(this)),
            commands.registerCommand("intelOneAPI.watchPanel.clearWatchPanel", this.clearWatch.bind(this)),
            commands.registerCommand("intelOneAPI.watchPanel.fetchSimdWatchPanel", this.fetchSimdWatchPanel.bind(this)),
            debug.onDidTerminateDebugSession(() => {
                commands.executeCommand("setContext", "oneapi:haveWatch", false);
            })
        );
    }

    public async fetchSimdWatchPanel(globalCurrentThread?: number): Promise<void> {
        if (globalCurrentThread) {
            this._globalCurrentThread = globalCurrentThread;
        }
        await this.simdWatchViewProvider.setView(this);
    }

    public fetchVars(watchRequests: WatchRequests, session: vscode.DebugSession): {
        promises: Promise<void>[];
        reqVariablesList: reqVariablesList;
    } {
        const reqVariablesList: reqVariablesList = { vars: [] };
        const promises: Promise<void>[] = [];

        watchRequests.requests.forEach((request, index) => {
            promises.push((async () => {
                const result = await this.ensureVariableCreation(session, request.expression);

                if (result && result["result-class"] === "done" && result.vars) {
                    const variables = await this.parseVariables(result.vars, request.uniqueId, session);

                    reqVariablesList.vars[index] = variables;
                } else {
                    const variable: Variables = {
                        expression: "",
                        uniqueId: request.uniqueId,
                        vars: []
                    };

                    reqVariablesList.vars[index] = variable;
                }
            })());
        });

        return {
            promises: promises,
            reqVariablesList: reqVariablesList
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async executeCustomRequest(session: vscode.DebugSession, expression: string): Promise<any> {
        try {
            const response = await session.customRequest("evaluate", {
                expression,
                context: "repl"
            });

            return response.result;
        } catch (error) {
            console.error(`Error executing request: ${expression}`, error);
            throw error;
        }
    }

    public async getSIMDExecMask(session: vscode.DebugSession): Promise<SIMDExecMaskOrWidthRequest> {
        try {
            const result = await this.executeCustomRequest(session, "-exec -thread-execution-mask");
            const resultObject = parseResultToObject(result);

            if (resultObject["result-class"] === "done" && resultObject["execution-mask"]) {
                const execMask = resultObject["execution-mask"];

                return {
                    result,
                    success: true,
                    execMask
                };
            } else {
                return {
                    result,
                    success: false
                };
            }
        } catch (error) {
            console.error("Error fetching SIMD execution mask:", error);
            return {
                result: error,
                success: false
            };
        }
    }

    public async getSIMDWidth(session: vscode.DebugSession): Promise<SIMDExecMaskOrWidthRequest> {
        try {
            const result = await this.executeCustomRequest(session, "-exec -thread-simd-width");
            const resultObject = parseResultToObject(result);

            if (resultObject["result-class"] === "done" && resultObject["simd-width"]) {
                const width = resultObject["simd-width"];

                return {
                    result,
                    success: true,
                    width: parseInt(width, 10)
                };
            } else {
                return {
                    result,
                    success: false
                };
            }
        } catch (error) {
            console.error("Error fetching SIMD execution mask:", error);
            return {
                result: error,
                success: false
            };
        }
    }

    private async createVariable(session: vscode.DebugSession, expression: string): Promise<VariableWatchRequest> {
        try {
            const result = await this.executeCustomRequest(session, `-exec -var-create - * ${expression}`);

            return {
                result,
                success: true
            };
        } catch (error) {
            return {
                result: error,
                success: false
            };
        }
    }

    private async deleteVariable(session: vscode.DebugSession, name: string): Promise<boolean> {
        try {
            await this.executeCustomRequest(session, `-exec -var-delete "${name}"`);
            return true;
        } catch (error) {
            return false;
        }
    }

    private async ensureVariableCreation(session: vscode.DebugSession, expression: string): Promise<ResultObject | undefined> {

        const simdWidthReq = await this.getSIMDExecMask(session);

        if (!simdWidthReq.success || !simdWidthReq.execMask) {
            console.error("Failed to fetch SIMD execMask");
            return undefined;
        }

        const bitmask = simdWidthReq.execMask;
        const fullExp = `\"${expression}\" ${bitmask}`;

        let variableWatchReq = await this.createVariable(session, fullExp);
        let resultObject = parseResultToObject(variableWatchReq.result);

        if (resultObject["result-class"] === "error" && resultObject["msg"].includes("Duplicate variable object name")) {
            const deleteSuccess = await this.deleteVariable(session, fullExp);

            if (deleteSuccess) {
                variableWatchReq = await this.createVariable(session, fullExp);
                resultObject = parseResultToObject(variableWatchReq.result);
            }
        }

        return resultObject;
    }

    private async fetchChildrenForVarObject(name: string, session: vscode.DebugSession): Promise<Variables | null> {
        const miFetchChildrenResult = await this.executeCustomRequest(session, `-exec -var-list-children --no-values "${name}" 0 1000`);
        const resultObject = parseResultToObject(miFetchChildrenResult);

        if (parseInt(resultObject["numchild"], 10) < 1) {
            return null;
        }

        const childrenArray = this.parseChildrenString(name, resultObject["children"]);

        return childrenArray;
    }

    private async getNextChild(var0name: string, session: vscode.DebugSession): Promise<Variables | null> {
        const childrenArray = await this.fetchChildrenForVarObject(var0name, session);

        if (childrenArray === null) {
            return null;
        }

        const promises: Promise<void>[] = [];

        for (let i = 0; i < childrenArray.vars.length; i++) {
            const child = childrenArray.vars[i];

            if (child === null) {
                continue;
            }
            if (child.type === "") {
                // Push a promise to the array
                promises.push(
                    (async () => {
                        const childVars = await this.getNextChild(child.name, session);

                        if (childVars && childVars.vars.length > 0) {
                            // Remove the original child and insert the new children at the same position
                            childrenArray.vars.splice(i, 1, ...childVars.vars);
                        }
                    })()
                );
            }
        }

        // Wait for all promises to resolve
        await Promise.all(promises);

        return childrenArray;
    }


    public async getInfoExp(var0name: string, session: vscode.DebugSession):
        Promise<{
            promises: Promise<void>[];
            resultVariables: Variables;
        } | null> {
        const promises: Promise<void>[] = [];
        const resultVariables: Variables = {
            uniqueId: var0name,
            vars: [],
            expression: ""
        };

        const nextlevelChildren = await this.getNextChild(var0name, session);

        if (!nextlevelChildren) {
            return null;
        }

        nextlevelChildren.vars.forEach((child, index) => {
            promises.push((async () => {
                child.pathExp = await this.getInfoPath(child.name, session);
                resultVariables.vars[index] = child;
            })());
        });

        return {
            promises: promises,
            resultVariables: resultVariables
        };
    }


    private async getInfoPath(name: string, session: vscode.DebugSession): Promise<string | undefined> {
        const miFetchChildrenResult = await this.executeCustomRequest(session, `-exec -var-info-path-expression "${name}"`);

        const resultObject = parseResultToObject(miFetchChildrenResult);

        if (resultObject["result-class"] === "error") {
            return undefined;
        }
        return resultObject["path_expr"];
    }

    private parseChildrenString(name: string, childrenString: string): Variables {
        const childrenArray: Array<{ [key: string]: string }> = [];

        let trimmedString = childrenString.trim();

        if (trimmedString.startsWith("[") && trimmedString.endsWith("]")) {
            trimmedString = trimmedString.substring(1, trimmedString.length - 1);
        }

        const childRegex = /child=\{([^}]*)\}/g;
        let match;

        // eslint-disable-next-line no-cond-assign
        while ((match = childRegex.exec(trimmedString)) !== null) {
            const childString = match[1];
            const childObject: { [key: string]: string } = {};

            const patterns = [
                { key: "name", start: "name=", ends: [",exp=", ",numchild=", ",type=", ",thread-id=", ",lane=", ",has_more="] },
                { key: "exp", start: "exp=", ends: [",numchild=", ",type=", ",thread-id=", ",lane=", ",has_more="] },
                { key: "numchild", start: "numchild=", ends: [",type=", ",thread-id=", ",lane=", ",has_more="] },
                { key: "type", start: "type=", ends: [",thread-id=", ",lane=", ",has_more="] },
                { key: "thread-id", start: "thread-id=", ends: [",lane=", ",has_more="] },
                { key: "lane", start: "lane=", ends: [",has_more="] },
                { key: "has_more", start: "has_more=", ends: [] }
            ];

            patterns.forEach(({ key, start, ends }) => {
                const startIndex = childString.indexOf(start);

                if (startIndex !== -1) {
                    let endIndex = childString.length;

                    ends.forEach(end => {
                        const idx = childString.indexOf(end, startIndex + start.length);

                        if (idx !== -1 && idx < endIndex) {
                            endIndex = idx;
                        }
                    });
                    childObject[key] = childString.substring(startIndex + start.length, endIndex).trim();
                } else {
                    childObject[key] = "";
                }
            });

            childrenArray.push(childObject);
        }

        const variables: Variable[] = childrenArray.map(child => {
            return {
                name: child.name,
                exp: child.exp,
                numchild: parseInt(child.numchild, 10),
                value: child.value,
                type: child.type,
                threadId: parseInt(child["thread-id"], 10),
                lane: parseInt(child.lane, 10),
                hasMore: child.has_more
            };
        });

        return { uniqueId: name, vars: variables, expression: variables[0].exp };
    }

    private async parseVariables(varsString: string, uniqueId: string, session: vscode.DebugSession): Promise<Variables> {
        let expression: string = "";
        /* 
        Trsnform string like:
        "[var={name=var5-0,numchild=1,value=0xffff81ac001dfc10,type=const _ZTSZZ4mainENKUlRT_E_clIN4sycl3_V17handlerEEEDaS0_EUlNS4_2idILi1EEEE_ *,thread-id=155,lane=0,has_more=0},
          var={name=var5-15,numchild=1,value=0xffff81ac001dffd0,type=const _ZTSZZ4mainENKUlRT_E_clIN4sycl3_V17handlerEEEDaS0_EUlNS4_2idILi1EEEE_ *,thread-id=155,lane=15,has_more=0}]"
        To array of strings like:
        ["var={name=var5-0,numchild=1,value=0xffff81ac001dfc10,type=const _ZTSZZ4mainENKUlRT_E_clIN4sycl3_V17handlerEEEDaS0_EUlNS4_2idILi1EEEE_ *,thread-id=155,lane=0,has_more=0},",
         "var={name=var5-15,numchild=1,value=0xffff81ac001dffd0,type=const _ZTSZZ4mainENKUlRT_E_clIN4sycl3_V17handlerEEEDaS0_EUlNS4_2idILi1EEEE_ *,thread-id=155,lane=15,has_more=0}",]
        */
        const varStrings = varsString.slice(1, -1).split("var={").slice(1).map(str => "var={" + str);

        const variables = varStrings.map(varStr => {
            const keyValuePairs = varStr.slice(5, -1).split(",").map(pair => pair.split("="));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const variable: any = {};

            keyValuePairs.forEach(([key, value]) => {
                variable[key] = value;
            });

            return variable;
        });

        const firstVariableWithName = variables.find(variable => variable.name);

        if (firstVariableWithName) {
            expression = await this.getInfoPath(firstVariableWithName.name, session) || "";
        }

        const vars: Variable[] = variables.map(variable => ({
            name: variable.name,
            exp: variable.exp || "", // Provide a default value of an empty string if expr is undefined
            numchild: parseInt(variable.numchild, 10),
            value: variable.value,
            type: variable.type,
            threadId: parseInt(variable["thread-id"], 10),
            lane: parseInt(variable.lane, 10),
            hasMore: variable.has_more
        }));

        return { uniqueId, vars, expression };
    }

    private expresionInput(): void {
        this.simdWatchViewProvider.showExpInput();
    }

    private clearWatch(): void {
        this.context.globalState.update("WatchRequests", undefined);
        this.fetchSimdWatchPanel();
    }

}

interface SIMDExecMaskOrWidthRequest {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any;
    success: boolean;
    execMask?: string;
    width?: number;
}

export interface WatchRequests {
    requests: Request[];
}

export interface Request {
    uniqueId: string;
    expression: string;
}

export interface Variable {
    name: string;
    exp: string;
    pathExp?: string;
    numchild: number;
    value: string;
    type: string;
    threadId: number;
    lane: number;
    hasMore: string;
}

export interface Variables {
    uniqueId: string;
    expression: string;
    vars: Variable[];
}

export interface reqVariablesList {
    vars: Variables[];
}

interface VariableWatchRequest {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any;
    success: boolean;
}

interface ResultObject {
    [key: string]: string;
}
