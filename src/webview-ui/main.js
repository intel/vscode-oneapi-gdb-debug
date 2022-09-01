// Get access to the VS Code API from within the webview context
const vscode = acquireVsCodeApi();

// Just like a regular webpage we need to wait for the webview
// DOM to load before we can reference any of the HTML elements
// or toolkit components
window.addEventListener("load", main);

// Main function that gets executed once the webview DOM loads
function main() {
    const changeViewButton = document.getElementById("change-view-button");

    changeViewButton.addEventListener("click", changeView);

    setVSCodeMessageListener();
}

function changeView() {
    vscode.postMessage({
        command: "change"
    });
}

function setVSCodeMessageListener() {
    window.addEventListener("message", (event) => {
        const command = event.data.command;
        const data = JSON.parse(event.data.payload);

        switch (command) {
        case "change":
            displayNewData(data);
            break;
        }
    });
}

function displayNewData(data) {
    document.getElementById("simd-view").innerHTML = data.newLanes;
}
