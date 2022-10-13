(function () {
    const vscode = acquireVsCodeApi();

    const changeViewButton = document.getElementById("change-view-button");

    changeViewButton.addEventListener("click", changeView);

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const command = event.data.command;
            const data = JSON.parse(event.data.payload);

            switch (command) {
            case "change":
                displayNewData(data);
                break;
            }
    });

    function displayNewData(data) {
        document.getElementById("simd-view").innerHTML = data.newLanes;
    }

    function changeView() {
        vscode.postMessage({
            command: "change"
        });
    }
}());
