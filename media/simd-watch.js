/*
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */
(function () {
    // Get access to the VS Code API from within the webview context
    const vscode = acquireVsCodeApi();

    // Just like a regular webpage we need to wait for the webview
    // DOM to load before we can reference any of the HTML elements
    // or toolkit components
    window.addEventListener("load", main);

    function main() {
        setVSCodeMessageListener();
        exprInput = document.querySelector(".expression-input");

        if (exprInput) {
            exprInput.addEventListener("keyup", function (ev) {
                value = this.value.trim();
                if (ev.key === "Enter" || ev.keyCode === 13) {
                    if (value) {
                        addExpression(value);
                    }
                    this.value = "";
                    this.closest(".row").classList.add("hidden");
                } else if (ev.key === "Escape" || ev.keyCode === 27) {
                    this.value = "";
                    this.closest(".row").classList.add("hidden");
                }
            });
        }

        document.addEventListener("click", function (e) {
            const removeBtn = e.target.closest(".remove");

            if (removeBtn) {
                const inputRow = e.target.closest(".input-row");

                if (inputRow) {
                    /* We got click from the input row. Close the input. */
                    exprInput.value = "";
                    inputRow.classList.add("hidden");
                } else {
                    const id = removeBtn.parentElement.parentElement.getAttribute("data-id");

                    if (id) {
                        vscode.postMessage({
                            command: "removeSIMDWatch",
                            data: {
                                uniqueId: id
                            }
                        });
                    }
                }
                return;
            }

            const expressionCell = e.target.closest(".expression-cell");
            const tooltip = e.target.closest(".shortTooltipText");

            if (expressionCell) {
                /* We don't want clicks on the tooltip to trigger the event. */
                if (!tooltip) {
                    toggleChildren(expressionCell);
                    return;
                }
            }

            if (!e.target.closest(".expression-input") && !e.target.closest(".input-row")) {
                exprInput.value = "";
                exprInput.closest(".row").classList.add("hidden");
            }
        });

        document.addEventListener("dblclick", function (e) {
            if (e.target.closest(".expression-input") || e.target.closest(".input-row")) {
                return;
            }
            const emptyAreaClicked = !e.target.closest(".row");

            if (emptyAreaClicked) {
                showExpInput();
            }
        });
    }

    /* Returns true if TREE is collapsed. */
    function isCollapsed(tree) {
        return tree && tree.classList.contains("collapsed");
    }

    function toggleChildren(el) {
        tree = el.querySelector(".tree");
        if (!tree) {
            /* Expression input event, ignore. */
            return;
        }
        rowEl = el.closest(".row");
        id = rowEl.getAttribute("data-id");
        varName = rowEl.getAttribute("data-var-name");

        if (isCollapsed(tree)) {
            expandChildren(rowEl, varName, id);
        } else {
            hideChildren(rowEl, id);
        }

        tree.classList.toggle("collapsed");
    }

    function expandChildren(rowEl, varName, id) {
        let levelAttr = rowEl.getAttribute("data-level");
        let level = levelAttr ? parseInt(levelAttr, 10) : 0;

        alreadyExpanded = +rowEl.getAttribute("data-already-expanded");

        if (alreadyExpanded === 1) {
            /* The children are hidden but present in DOM. */
            /* The level cannot be bigger that the number of rows in table. */
            const maxLevel = document.querySelectorAll(".row").length;
            let previousCollapsedLevel = maxLevel;
            let child = rowEl.nextElementSibling;

            /* Iterate over next rows. */
            while (child) {
                if (child.classList.contains("input-row")) {
                    /* End of the table. */
                    break;
                }

                let childLevelAttr = child.getAttribute("data-level");
                let childLevel = childLevelAttr ? parseInt(childLevelAttr, 10) : 0;

                if (childLevel <= level) {
                    /* We exhausted children. */
                    break;
                }

                if (previousCollapsedLevel < childLevel) {
                    /* This is a child of a hidden child */
                    shouldHide = true;
                } else {
                    /* The child should be shown, but possibly its children
                       must remain hidden. */
                    shouldHide = false;
                    const tree = child.querySelector(".tree");

                    if (tree && isCollapsed(tree)) {
                        /* All children of this element need to remain hidden. */
                        previousCollapsedLevel = childLevel;
                    } else {
                        previousCollapsedLevel = maxLevel;
                    }
                }

                child.classList.toggle("hidden", shouldHide);
                child = child.nextElementSibling;
                previousLevel = childLevel;
            }
        } else {
            rowEl.setAttribute("data-already-expanded", "1");
            /* We found no children, but they are expected. */
            vscode.postMessage({
                command: "expandVarObject",
                data: {
                    uniqueId: id,
                    varName: varName,
                    level: level
                }
            });
            rowEl.setAttribute("data-already-expanded", "1");
        }
    }

    function hideChildren(rowEl) {
        level = +rowEl.getAttribute("data-level");

        for (child = rowEl.nextElementSibling; child; child = child.nextElementSibling) {
            if (child.classList.contains("input-row")) { break; }

            childLevel = +child.getAttribute("data-level");

            if (childLevel <= level) {
                /* We exhausted children.  */
                break;
            }
            child.classList.add("hidden");
        }
    }

    function addExpression(expression) {
        const uniqueId = Date.now().toString();

        vscode.postMessage({
            command: "addSimdWatch",
            data: {
                expression: expression,
                uniqueId: uniqueId
            }
        });
    }

    function setVSCodeMessageListener() {
        window.addEventListener("message", (event) => {
            const command = event.data.command;
            const data = JSON.parse(event.data.payload);

            switch (command) {
                case "expandVarObject":
                    updateExpandContent(data.uniqueId, data.htmlChildren);
                    break;
                case "addSimdWatch":
                    addWatchContent(data.uniqueId, data.htmlNewWatch);
                    break;
                case "showExpInput":
                    showExpInput();
                    break;
                case "removeSIMDWatch":
                    removeElementAndChildren(data.uniqueId);
                    break;
                default:
                    break;
            }
        });
    }

    function addWatchContent(uniqueId, htmlNewWatch) {
        const table = document.getElementById("simd-watch");

        if (table) {
            const inputRow = table.querySelector(".input-row");

            if (inputRow) {
                const template = document.createElement("template");

                template.innerHTML = htmlNewWatch;
                inputRow.before(...template.content.children);

                const html = table.outerHTML;

                vscode.postMessage({
                    command: "saveHTMLState",
                    data: {
                        uniqueId: uniqueId,
                        html: html
                    }
                });
            }
        }
    }

    function removeElementAndChildren(uniqueId) {
        const parentEl = document.querySelector(".row[data-id=\"" + uniqueId + "\"]");

        if (parentEl) {
            const level = parentEl.getAttribute("data-level");
            let sibling = parentEl.nextElementSibling;

            while (sibling) {
                const siblingLevel = sibling.getAttribute("data-level");

                if (siblingLevel <= level) {
                    break;
                }
                const nextSibling = sibling.nextElementSibling;

                sibling.remove();
                sibling = nextSibling;
            }
            parentEl.remove();

            const html = document.getElementById("simd-watch").outerHTML;

            vscode.postMessage({
                command: "saveHTMLState",
                data: {
                    uniqueId: uniqueId,
                    html: html
                }
            });
        }
    }

    /* Finds a row with UNIQUE_ID and appends htmlChildren after. */
    function updateExpandContent(uniqueId, htmlChildren) {
        rowEl = document.querySelector(".row[data-id=\"" + uniqueId + "\"]");

        if (!rowEl) {
            /* The row was deleted in the meantime. */
            console.log("could not find parent row");
            return;
        }

        /* Find whether the appended children should be hidden. */
        shouldHide = isCollapsed(rowEl.querySelector(".tree"));
        level = +rowEl.getAttribute("data-level");
        previousRow = rowEl;

        while (!shouldHide && level > 0) {
            /* Go up to the root and check whether any parent is hidden. */
            previousRow = previousRow.previousElementSibling; /* Exists, as level > 0 */
            previousRowLevel = +previousRow.getAttribute("data-level");

            if (previousRowLevel < level) {
                level = previousRowLevel;
                shouldHide = isCollapsed(previousRow.querySelector(".tree"));
            }
        }

        template = document.createElement("template");
        template.innerHTML = htmlChildren;
        rowEl.after(...template.content.children);
        if (shouldHide) {
            hideChildren(rowEl);
        }

        const html = document.getElementById("simd-watch").outerHTML;

        vscode.postMessage({
            command: "saveHTMLState",
            data: {
                uniqueId: uniqueId,
                html: html
            }
        });
    }

    function showExpInput() {
        inputRow = document.querySelector(".input-row");
        if (!inputRow) { return; }

        inputRow.classList.remove("hidden");
        inputRow.querySelector(".expression-input").focus();
    }
}());
