/*
 * Copyright (c) 2022-2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

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

    let hideNonMatchesActive = false;

    // Main function that gets executed once the webview DOM loads
    function main() {

        setVSCodeMessageListener();
        setupSearchPanel();
        const searchPanel = document.querySelector(".search-panel");
        const dragHandle = document.querySelector(".drag-handle");

        makeElementDraggable(searchPanel, dragHandle);
        var elements = document.getElementsByClassName("one");

        for (let element of elements){
            const basic = document.getElementById(element.id);
    
            basic.addEventListener("click", function(){changeLane(element.id);});

            if(basic.classList.contains("current")) {
                basic.scrollIntoView({ behavior: "auto", block: "center", inline: "start" });
            }
        }

        var coll = document.getElementsByClassName("collapsible");
        var i;

        for (i = 0; i < coll.length; i++) {
            coll[i].addEventListener("click", function() {
                var content = this.nextElementSibling;
                
                if (this.classList.contains("active")) {
                    content.style.display = "none";
                } else {
                    content.style.display = "block";
                }
                this.classList.toggle("active");
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

    function debounce(func, wait) {
        let timeout;

        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };

            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function performSearch() {

        document.querySelector(".search-panel").style.display = "flex"; // Show search panel
        document.getElementById("searchInput").focus(); // Focus on the input field
        highlightResults(); // Perform the search highlighting
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
            case "triggerSearch":
                performSearch();
                break;
            default:
                break;
            }
        });
    }
    
    let currentIndex = 0; // To keep track of the current focused element
    let matches = []; // To store matching elements

    function setupSearchPanel() {
        const searchInput = document.getElementById("searchInput");

        // Wrapping highlightResults in a debounce function to delay execution
        const debouncedHighlightResults = debounce(() => {
            highlightResults();
            if (hideNonMatchesActive) {
                toggleHideNonMatches();
                hideNonMatchesActive = true; // Ensure filtering remains active after updating search
                toggleHideNonMatches();
            }
        }, 500); // 500 ms delay

        searchInput.addEventListener("input", debouncedHighlightResults);

        document.getElementById("nextBtn").addEventListener("click", () => navigateResults("next"));
        document.getElementById("prevBtn").addEventListener("click", () => navigateResults("prev"));
        document.getElementById("closeBtn").addEventListener("click", () => closeSearch());
        document.getElementById("toggleHideBtn").addEventListener("click", () => toggleHideNonMatches());
    }

    function closeSearch() {
        document.querySelector(".search-panel").style.display = "none"; // Hide search panel
        clearHighlights();
        showAllContent(); // Show all content when search is closed
    }

    function highlightResults() {
        const table = document.getElementById("simd-view");

        if (!table) {
            console.error("Table \"#simd-view\" not found.");
            return;
        }

        clearHighlights(); // Clear previous highlights

        const searchInput = document.getElementById("searchInput");
        const keyword = searchInput.value.toLowerCase();

        if (!keyword.trim()) {
            document.getElementById("searchCounter").textContent = "No results";
            return;
        }

        matches = []; // Reset matches array

        // Recursive function to process each element and its child nodes without creating nested spans
        function highlightTextInNode(node, keyword) {
            if (!node || !keyword) {return;}

            // Escape special characters in the keyword for regex
            const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            // Use the escaped keyword in the regex
            const keywordRegex = new RegExp(escapedKeyword, "gi");

            const container = document.getElementById("simd-view");

            if (!container) {
                console.error("Container element not found.");
                return;
            }

            const processTextNode = (element) => {
                Array.from(element.childNodes).forEach(child => {
                    if (child.nodeType === Node.TEXT_NODE && child.nodeValue.toLowerCase().includes(keyword.toLowerCase())) {
                        const matches = child.nodeValue.match(keywordRegex);

                        if (matches) {
                            const highlightedHTML = child.nodeValue.replace(keywordRegex, match => `<span class="highlight">${match}</span>`);
                            const fragment = document.createRange().createContextualFragment(highlightedHTML);

                            element.replaceChild(fragment, child);
                        }
                    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "SCRIPT" && child.tagName !== "STYLE" && !child.classList.contains("highlight")) {
                        processTextNode(child);
                    }
                });
            };

            processTextNode(container);

            // After processing, update the matches array
            matches = Array.from(container.querySelectorAll(".highlight"));
            if (matches.length > 0) {navigateResults();}
        }



        highlightTextInNode(table, keyword);
        updateSearchCounter();
    }

    function navigateResults(direction) {
        if (matches.length === 0) {return;}

        // Clear current match styling
        if (matches[currentIndex]) {
            matches[currentIndex].classList.remove("current-match");
            // Optionally, hide the tooltip text if the current match was inside it
            let currentSIMDTooltip = matches[currentIndex].closest(".simdtooltiptext");
            let currentTooltip = matches[currentIndex].closest(".tooltiptext");

            if (currentTooltip) {
                currentTooltip.style.visibility = "hidden";
                currentTooltip.style.opacity = "0";
            }

            if (currentSIMDTooltip) {
                currentSIMDTooltip.style.visibility = "hidden";
                currentSIMDTooltip.style.opacity = "0";
            }
        }

        // Adjust currentIndex based on navigation direction
        if (direction === "next") {
            currentIndex = (currentIndex + 1) % matches.length;
        } else if (direction === "prev") {
            currentIndex = (currentIndex - 1 + matches.length) % matches.length;
        } else {
        // If the function is called without a specific direction, start from the first element
            currentIndex = 0;
        }
        matches[currentIndex].classList.add("current-match");
        matches[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });

        // Check if the current match is inside a tooltiptext and make it visible
        let currentSIMDTooltip = matches[currentIndex].closest(".simdtooltiptext");
        let currentTooltip = matches[currentIndex].closest(".tooltiptext");

        if (currentTooltip) {
            currentTooltip.style.visibility = "visible";
            currentTooltip.style.opacity = "1";
        }

        if (currentSIMDTooltip) {
            currentSIMDTooltip.style.visibility = "visible";
            currentSIMDTooltip.style.opacity = "1";
        }

        updateSearchCounter();
    }

    function clearHighlights() {
    // Query all elements with the 'highlight' or 'current-match' class within the container
        const highlightedElements = document.querySelectorAll(".highlight, .current-match");

        highlightedElements.forEach(el => {
            // Create a text node from the span's content
            const textNode = document.createTextNode(el.textContent);

            // Check if the current element is inside a tooltip and make it invisible
            let currentTooltip = el.closest(".tooltiptext");
            let currentSIMDTooltip = el.closest(".simdtooltiptext");

            if (currentTooltip) {
                currentTooltip.style.visibility = "hidden";
                currentTooltip.style.opacity = "0";
            }

            if (currentSIMDTooltip) {
                currentSIMDTooltip.style.visibility = "hidden";
                currentSIMDTooltip.style.opacity = "0";
            }

            // Replace the span with the new text node
            el.parentNode.replaceChild(textNode, el);
        });

        // After removing all highlighted spans, merge adjacent text nodes
        // Assuming 'simd-view' is the container where search is performed
        const container = document.getElementById("simd-view");

        if (container) {
            container.normalize();
        }

        // Reset matches and currentIndex for the next search operation
        matches = [];
        currentIndex = 0;
        updateSearchCounter();
    }

    function toggleHideNonMatches() {
        const keyword = document.getElementById("searchInput").value.toLowerCase().trim();
        const tableRows = document.querySelectorAll("#simd-view tbody tr");
        if (!keyword) {
            showAllContent(); // If no keyword, show all content
            return;
        }

        hideNonMatchesActive = !hideNonMatchesActive;
        const toggleButton = document.getElementById("toggleHideBtn");

        if (hideNonMatchesActive) {
            tableRows.forEach(row => {
                const rowText = row.textContent.toLowerCase();
                const should_hide = (!rowText.includes(keyword));
                row.classList.toggle("hidden", should_hide);
            });

            toggleButton.classList.add("active");
        } else {
            showAllContent();
            toggleButton.classList.remove("active");
        }
    }

    function showAllContent() {
        const tableRows = document.querySelectorAll("#simd-view tbody tr");

        tableRows.forEach(row => row.classList.remove("hidden"));

        hideNonMatchesActive = false;
        document.getElementById("toggleHideBtn").classList.remove("active");
    }

    function updateSearchCounter() {
        document.getElementById("searchCounter").textContent = matches.length > 0 ? `${currentIndex + 1} of ${matches.length}` : "No results";
    }

    function makeElementDraggable(element, handle) {
        let offsetX = 0, offsetY = 0, drag = false;

        handle.onmousedown = (e) => {
            drag = true;
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;
            document.onmousemove = onMouseMove;
            document.onmouseup = () => {
                drag = false;
                document.onmousemove = document.onmouseup = null;
            };
        };

        function onMouseMove(e) {
            if (!drag) {return;}
            element.style.left = `${e.clientX - offsetX}px`;
            element.style.top = `${e.clientY - offsetY}px`;
        }
    }


    function displayNewData(newLanes) {
        document.getElementById("simd-view").innerHTML = newLanes;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function updateLane(id, previousLaneId, activeSymbol) {
        if (previousLaneId !== id) {
            const nextLane = document.getElementById(id);

            nextLane.classList.add("current");
            if (previousLaneId) {
                const previousLane = document.getElementById(previousLaneId);

                previousLane.classList.remove("current");
                previousLane.innerHTML = activeSymbol;
            }}
    }
}());
