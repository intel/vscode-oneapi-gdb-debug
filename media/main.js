(function() {
    // Get access to the VS Code API from within the webview context
    const vscode = acquireVsCodeApi();

    // Just like a regular webpage we need to wait for the webview
    // DOM to load before we can reference any of the HTML elements
    // or toolkit components
    window.addEventListener("load", main);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const ViewState = {
        COLORS: 0,
        NUMBERS: 1
    };

    // Main function that gets executed once the webview DOM loads
    function main() {

        setVSCodeMessageListener();

        var elements = document.getElementsByClassName("one");

        for (let element of elements){
            const basic = document.getElementById(element.id);
    
            basic.addEventListener("click", function(){changeLane(element.id);});
        }

        var coll = document.getElementsByClassName("collapsible");
        var i;

        for (i = 0; i < coll.length; i++) {
            coll[i].addEventListener("click", function() {
                this.classList.toggle("active");
                var content = this.nextElementSibling;

                if (content.style.display === "block") {
                    content.style.display = "none";
                } else {
                    content.style.display = "block";
                }
            });
        }
    }

    function changeLane(id) {
        vscode.postMessage({
            command: "changeLane",
            payload: id,
            data: JSON.stringify(document.getElementById(id))
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function updateLane(id, previousLaneId, viewType) {
        if (previousLaneId !== id) {
            const nextLane = document.getElementById(id);

            nextLane.innerHTML = "<span style=\"display:block; font-size:13px; text-align:center; margin:0 auto; width: 14px; height: 14px; color:#ffff00\">➡</span>";
            if (previousLaneId) {
                const previousLane = document.getElementById(previousLaneId);

                previousLane.innerHTML = "1";
            }}
    }
}());
