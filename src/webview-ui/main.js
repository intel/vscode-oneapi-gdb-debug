// Get access to the VS Code API from within the webview context
const vscode = acquireVsCodeApi();

// Just like a regular webpage we need to wait for the webview
// DOM to load before we can reference any of the HTML elements
// or toolkit components
window.addEventListener("load", main);

const ViewState = {
	COLORS: 0,
	NUMBERS: 1
}

// Main function that gets executed once the webview DOM loads
function main() {
    const changeViewButton = document.getElementById("change-view-button");

    changeViewButton.addEventListener("click", changeView);

    setVSCodeMessageListener();

    var elements = document.getElementsByClassName("one");
    for (let element of elements){
        const basic = document.getElementById(element.id);
    
        basic.addEventListener("click", function(){changeLane(element.id)});
    }
}

function changeLane(id) {
    vscode.postMessage({
        command: "changeLane",
        payload: id,
        data: JSON.stringify(document.getElementById(id))
    });
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
            displayNewData(data.newLanes);
            break;
        case "changeLane":
            updateLane(data.id, data.previousLane, data.viewType);
            break;
        }
    });
}

function displayNewData(newLanes) {
    document.getElementById("simd-view").innerHTML = newLanes;
}

function updateLane(id, previousLaneId, viewType) {
    const nextLane = document.getElementById(id);

    nextLane.innerHTML = '<span style="display:block; font-size:13px; text-align:center; margin:0 auto; width: 14px; height: 14px; color: black">➡</span>';
    if (previousLaneId) {
        const previousLane = document.getElementById(previousLaneId);
        previousLane.innerHTML = viewType == ViewState.COLORS ? '' : '1';
    }
}
