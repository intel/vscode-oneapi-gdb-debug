/*
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

(function() {
    // Get access to the VS Code API from within the webview context
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const vscode = acquireVsCodeApi();

    // Just like a regular webpage we need to wait for the webview
    // DOM to load before we can reference any of the HTML elements
    // or toolkit components
    window.addEventListener("load", main);

    // Main function that gets executed once the webview DOM loads
    function main() {
        setVSCodeMessageListener();
        setupCollapsibleElements();
    }

    function setupCollapsibleElements() {
        document.querySelectorAll(".collapsible").forEach((collapsible) => {
            collapsible.addEventListener("click", function() {
                this.classList.toggle("active");
            });
        });
    }

    function setVSCodeMessageListener() {
        // Set up message listener to handle messages sent from VS Code extension
        window.addEventListener("message", event => {
            const message = event.data; // The JSON data that the extension sent

            switch (message.command) {
            case "exampleCommand":
                // Handle the example command
                break;
                // Add more case statements as needed for other commands
            }
        });
    }

}());
