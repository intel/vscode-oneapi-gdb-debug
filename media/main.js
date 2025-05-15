/*
 * Copyright (c) 2022-2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

(function () {
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
        setupFilterPanel();

        const searchPanel = document.querySelector(".search-panel");
        const filterPanel = document.querySelector(".filter-panel");
        const searchDragHandle = searchPanel.querySelector(".drag-handle");
        const filterDragHandle = filterPanel.querySelector(".drag-handle");

        makeElementDraggable(searchPanel, searchDragHandle);
        makeElementDraggable(filterPanel, filterDragHandle);

        var elements = document.getElementsByClassName("one");

        for (let element of elements) {
            const basic = document.getElementById(element.id);

            basic.addEventListener("click", function () { changeLane(element.id); });

            if (basic.classList.contains("current")) {
                basic.scrollIntoView({ behavior: "auto", block: "center", inline: "start" });
            }
        }

        var coll = document.getElementsByClassName("collapsible");
        var i;

        for (i = 0; i < coll.length; i++) {
            coll[i].addEventListener("click", function () {
                var content = this.nextElementSibling;

                if (this.classList.contains("active")) {
                    content.style.display = "none";
                } else {
                    content.style.display = "block";
                }
                this.classList.toggle("active");
            });
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

    function showFilterPanel() {
        const filterPanel = document.querySelector(".filter-panel");
        filterPanel.style.display = "flex";

        // Retrieve ThreadFilter from localStorage (default to empty object if not present)
        const storedFilter = JSON.parse(localStorage.getItem("ThreadFilter")) || {};

        // 1) Restore main filter input
        document.getElementById("filterInput").value = storedFilter.filter || "";

        // 2) Restore threadValue
        const threadInput = document.getElementById("threadInput");
        const threadSelectedValue = document.getElementById("threadSelectedValue");
        restoreDropdownAndInput(
            storedFilter.threadValue,
            "",              // default if empty
            "All",               // label if it's -all
            "threadDropdownMenu",
            "threadDropdownContainer",
            threadSelectedValue,
            threadInput
        );

        // 3) Restore laneValue
        const laneInput = document.getElementById("laneInput");
        const laneSelectedValue = document.getElementById("laneSelectedValue");
        restoreDropdownAndInput(
            storedFilter.laneValue,
            "--selected-lanes",               // default if empty
            "Selected",                // label if it's --selected-lanes
            "laneDropdownMenu",
            "laneDropdownContainer",
            laneSelectedValue,
            laneInput
        );

        // 4) Restore local/global/workGroup
        document.getElementById("localWorkItemInput").value = storedFilter.localWorkItemValue || "";
        document.getElementById("globalWorkItemInput").value = storedFilter.globalWorkItemValue || "";
        document.getElementById("workGroupInput").value = storedFilter.workGroupValue || "";

        // Finally, focus the main filter text
        document.getElementById("filterInput").focus();
    }

    /**
     * Restores a dropdown/input pair based on the stored value.
     * @param {string} value - The stored field value (e.g., "--selected-lanes", "3,5,7", etc.)
     * @param {string} defaultValue - The fallback if `value` is empty (usually "--selected-lanes")
     * @param {string} defaultLabel - The label to show if we interpret this as the default (e.g. "All")
     * @param {string} menuId - The ID of the dropdown menu element (e.g. "laneDropdownMenu")
     * @param {string} containerId - The ID of the container for that dropdown (e.g. "laneDropdownContainer")
     * @param {HTMLElement} selectedValueEl - The <span> or <div> that shows the selected label
     * @param {HTMLInputElement} inputEl - The text input for custom values
     */
    function restoreDropdownAndInput(
        value,
        defaultValue,
        defaultLabel,
        menuId,
        containerId,
        selectedValueEl,
        inputEl
    ) {
        const menu = document.getElementById(menuId);
        const container = document.getElementById(containerId);
        const dropdownSelected = container?.querySelector(".dropdown-selected");

        // Clear previous selection
        const previouslySelected = menu?.querySelector(".dropdown-option.selected");
        previouslySelected?.classList.remove("selected");

        const isEmpty = !value || value.trim() === "";
        const specialFlags = ["--selected-lanes", "--all-lanes"];
        const isSpecial = specialFlags.includes(value);

        if (isEmpty || isSpecial) {
            const displayValue = isEmpty ? defaultValue : value;
            const label = value === "--all-lanes" ? "All Lanes" : defaultLabel;

            // If a special flag is entered in thread, move it to lane and reset thread
            if (menuId === "threadDropdownMenu" && specialFlags.includes(value)) {
                // Move the flag to lane
                const laneInput = document.getElementById("laneInput");
                const laneSelectedValue = document.getElementById("laneSelectedValue");
                const laneMenu = document.getElementById("laneDropdownMenu");
                const laneDropdownContainer = document.getElementById("laneDropdownContainer");
                const laneDropdownSelected = laneDropdownContainer?.querySelector(".dropdown-selected");
                laneInput.value = "";
                laneInput.style.display = "none";
                selectOptionInMenu(laneMenu, value);
                laneSelectedValue.textContent = value === "--all-lanes" ? "All Lanes" : "Selected";
                if (laneDropdownSelected) laneDropdownSelected.style.display = "flex";

                // Reset thread field
                selectedValueEl.textContent = "All";
                inputEl.value = "";
                inputEl.style.display = "none";
                selectOptionInMenu(menu, "");
                if (dropdownSelected) dropdownSelected.style.display = "flex";
                return;
            }

            // Always show the dropdown-selected element and update its label
            selectedValueEl.textContent = label;
            inputEl.value = displayValue === "--selected-lanes" ? "" : displayValue;
            inputEl.style.display = "none";
            selectOptionInMenu(menu, displayValue);
            if (dropdownSelected) dropdownSelected.style.display = "flex";
            return;
        }

        // For custom value: show it in the styled dropdown, hide input
        // Only set the span if value is non-empty, otherwise use defaultLabel
        if (value && value.trim() !== "") {
            selectedValueEl.textContent = value;
        } else {
            selectedValueEl.textContent = defaultLabel;
        }
        inputEl.value = value;
        inputEl.style.display = "none";
        selectOptionInMenu(menu, "");
        if (dropdownSelected) dropdownSelected.style.display = "flex";

        // Add blur handler to reset to default label and value if input is empty (for edit mode)
        inputEl.onblur = function () {
            if (inputEl.value.trim() === "") {
                selectedValueEl.textContent = defaultLabel;
                inputEl.style.display = "none";
                if (dropdownSelected) dropdownSelected.style.display = "flex";
                selectOptionInMenu(menu, "--selected-lanes");
            }
        };
    }

    /**
     * Finds the dropdown-option in `menu` with data-value == desiredValue
     * and marks it as selected.
     */
    function selectOptionInMenu(menu, desiredValue) {
        if (!menu) return;
        // Select by data-value for normal options, by id for custom
        let option = menu.querySelector(`.dropdown-option[data-value="${desiredValue}"]`);
        if (!option && desiredValue === "") {
            // If desiredValue is empty, try to select the custom option by id
            option = Array.from(menu.querySelectorAll('.dropdown-option')).find(opt => opt.id && opt.id.endsWith('-custom-option'));
        }
        if (option) {
            option.classList.add("selected");
        }
    }

    function initializeThreadDropdown() {
        const threadDropdownMenu = document.getElementById("threadDropdownMenu");
        if (!threadDropdownMenu) {
            console.error("#threadDropdownMenu not found.");
            return;
        }

        threadDropdownMenu.addEventListener("click", (event) => {
            const option = event.target.closest(".dropdown-option");
            if (!option) return;

            document.querySelectorAll("#threadDropdownMenu .dropdown-option").forEach((opt) =>
                opt.classList.remove("selected")
            );
            option.classList.add("selected");

            const threadInput = document.getElementById("threadInput");

            if (option.id && option.id.endsWith("-custom-option")) {
                threadInput.style.display = "block";
                threadInput.focus();
            } else {
                threadInput.style.display = "none";
                threadInput.value = "";
            }

            document.getElementById("threadSelectedValue").textContent = option.textContent;
        });
    }


    function initializeLaneDropdown() {
        const laneDropdownMenu = document.getElementById("laneDropdownMenu");
        if (!laneDropdownMenu) {
            console.error("#laneDropdownMenu not found.");
            return;
        }

        laneDropdownMenu.addEventListener("click", (event) => {
            const option = event.target.closest(".dropdown-option");
            if (option) {
                document.querySelectorAll("#laneDropdownMenu .dropdown-option").forEach((opt) => opt.classList.remove("selected"));
                option.classList.add("selected");

                // Use id-based detection for custom option
                if (option.id && option.id.endsWith('-custom-option')) {
                    const laneInput = document.getElementById("laneInput");
                    laneInput.style.display = "block";
                    laneInput.focus();
                } else {
                    document.getElementById("laneInput").style.display = "none";
                    document.getElementById("laneInput").value = "";
                }

                document.getElementById("laneSelectedValue").textContent = option.textContent;
            }
        });
    }

    function isNonEmptyFilter(filterObj) {
        // Correspondence check:
        // filterObj fields: filter, threadValue, laneValue, localWorkItemValue, globalWorkItemValue, workGroupValue
        // These fields are restored in restoreFilterValues() and gathered in gatherFilterData()
        // => Correspondence confirmed, no changes needed.
        return (
            // 1) Main filter text must be non-empty
            (filterObj.filter && filterObj.filter.trim() !== "") ||

            // 2) threadValue must be defined, not empty
            (filterObj.threadValue &&
                filterObj.threadValue.trim() !== "") ||

            // 3) laneValue must be defined, not empty, and not "--selected-lanes" or "--all-lanes"
            (filterObj.laneValue &&
                filterObj.laneValue.trim() !== "" &&
                filterObj.laneValue.trim() !== "--selected-lanes" &&
                filterObj.laneValue.trim() !== "--all-lanes") ||

            // 4) localWorkItemValue, globalWorkItemValue, workGroupValue:
            //    any must be defined and not empty
            (filterObj.localWorkItemValue &&
                filterObj.localWorkItemValue.trim() !== "") ||

            (filterObj.globalWorkItemValue &&
                filterObj.globalWorkItemValue.trim() !== "") ||

            (filterObj.workGroupValue &&
                filterObj.workGroupValue.trim() !== "")
        );
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
                case "triggerFilter":
                    showFilterPanel();
                    break;
                default:
                    break;
            }
        });
    }

    function setupFilterPanel() {
        document.getElementById("helpBtn").addEventListener("click", openFilterHelp);
        document.getElementById("applyFilterBtn").addEventListener("click", applyFilter);
        document.getElementById("clearBtn").addEventListener("click", clearFilter);
        document.getElementById("closeFilterBtn").addEventListener("click", closeFilterPanel);

        initializeCustomDropdown('threadDropdownContainer', 'threadDropdownMenu', 'threadInput', 'threadDropdownToggle', 'threadSelectedValue', '', 'All');
        initializeCustomDropdown('laneDropdownContainer', 'laneDropdownMenu', 'laneInput', 'laneDropdownToggle', 'laneSelectedValue', '--selected-lanes', 'Selected');
        initializeThreadDropdown();
        initializeLaneDropdown();

        restoreFilterValues();

        // Ensure the filter panel is hidden by default
        const filterPanel = document.querySelector(".filter-panel");
        if (filterPanel) {
            filterPanel.style.display = "none";
        }
    }

    function openFilterHelp() {
        vscode.postMessage({ command: "openFilterHelp" });
    }

    function applyFilter() {
        const filterData = gatherFilterData();
        const filterDataStr = JSON.stringify(filterData);

        localStorage.setItem("ThreadFilter", filterDataStr);

        vscode.postMessage({
            command: "applyFilter",
            payload: filterDataStr
        });

        updateFilterIcon(isNonEmptyFilter(filterData));
    }

    function clearFilter() {
        localStorage.removeItem("ThreadFilter");

        resetFilterInputs();
        applyFilter();
    }

    function closeFilterPanel() {
        document.querySelector(".filter-panel").style.display = "none";
    }

    function gatherFilterData() {
        const getInputValue = (id) => document.getElementById(id)?.value.trim() || "";
        const isVisible = (el) => !!el && el.offsetParent !== null;

        // === THREAD ===
        const threadInput = document.getElementById("threadInput");
        const threadSelectedSpan = document.getElementById("threadSelectedValue");
        let threadValue = "";

        if (isVisible(threadInput)) {
            threadValue = threadInput.value.trim();
        } else {
            // Always use the visible label (span) for thread value
        threadValue = threadSelectedSpan?.innerText?.trim() || "";
        }

        // === LANE ===
        const laneInput = document.getElementById("laneInput");
        const laneSelectedSpan = document.getElementById("laneSelectedValue");
        let laneValue = "";

        if (isVisible(laneInput)) {
            laneValue = laneInput.value.trim();
        } else {
            const selected = document.querySelector("#laneDropdownMenu .dropdown-option.selected");
            if (selected && !selected.id?.endsWith("-custom-option")) {
                laneValue = selected.getAttribute("data-value") || "--selected-lanes";
            } else {
                laneValue = laneSelectedSpan?.textContent?.trim() || "--selected-lanes";
            }
        }

        // === Lane special flags moved from thread ===
        const specialFlags = ["--selected-lanes", "--all-lanes"];
        if (specialFlags.includes(threadValue)) {
            laneValue = threadValue;
            threadValue = "";
        }

        return {
            filter: getInputValue("filterInput"),
            threadValue,
            laneValue,
            localWorkItemValue: getInputValue("localWorkItemInput"),
            globalWorkItemValue: getInputValue("globalWorkItemInput"),
            workGroupValue: getInputValue("workGroupInput"),
        };
    }

    function resetFilterInputs() {
        ["filterInput", "threadInput", "laneInput", "localWorkItemInput", "globalWorkItemInput", "workGroupInput"]
            .forEach(id => document.getElementById(id).value = "");

        document.getElementById("threadSelectedValue").textContent = "All";
        document.getElementById("laneSelectedValue").textContent = "Selected";

        ["threadInput", "laneInput"].forEach(id => document.getElementById(id).style.display = "none");

        ["threadDropdownContainer", "laneDropdownContainer"].forEach(containerId => {
            const container = document.getElementById(containerId);
            const dropSelected = container.querySelector(".dropdown-selected");
            if (dropSelected) dropSelected.style.display = "flex";

            const selectedOption = container.querySelector(".dropdown-option.selected");
            if (selectedOption) selectedOption.classList.remove("selected");
        });

        updateFilterIcon(false);
    }

    function restoreFilterValues() {
        const storedFilter = JSON.parse(localStorage.getItem("ThreadFilter")) || {};

        document.getElementById("filterInput").value = storedFilter.filter || "";

        restoreDropdownAndInput(
            storedFilter.threadValue,
            "",
            "All",
            "threadDropdownMenu",
            "threadDropdownContainer",
            document.getElementById("threadSelectedValue"),
            document.getElementById("threadInput")
        );

        restoreDropdownAndInput(
            storedFilter.laneValue,
            "--selected-lanes",
            "Selected",
            "laneDropdownMenu",
            "laneDropdownContainer",
            document.getElementById("laneSelectedValue"),
            document.getElementById("laneInput")
        );

        document.getElementById("localWorkItemInput").value = storedFilter.localWorkItemValue || "";
        document.getElementById("globalWorkItemInput").value = storedFilter.globalWorkItemValue || "";
        document.getElementById("workGroupInput").value = storedFilter.workGroupValue || "";
    }


    function updateFilterIcon(active) {
        const icon = document.getElementById("filterIcon");
        if (icon) icon.className = active ? "icon-filter-active" : "icon-filter";
    }

    function isNonEmptyFilter(filterObj) {
        // Correspondence check:
        // filterObj fields: filter, threadValue, laneValue, localWorkItemValue, globalWorkItemValue, workGroupValue
        // These fields are restored in restoreFilterValues() and gathered in gatherFilterData()
        // => Correspondence confirmed, no changes needed.
        return (
            // 1) Main filter text must be non-empty
            (filterObj.filter && filterObj.filter.trim() !== "") ||

            // 2) threadValue must be defined, not empty
            (filterObj.threadValue &&
                filterObj.threadValue.trim() !== "") ||

            // 3) laneValue must be defined, not empty, and not "--selected-lanes" or "--all-lanes"
            (filterObj.laneValue &&
                filterObj.laneValue.trim() !== "" &&
                filterObj.laneValue.trim() !== "--selected-lanes" &&
                filterObj.laneValue.trim() !== "--all-lanes") ||

            // 4) localWorkItemValue, globalWorkItemValue, workGroupValue:
            //    any must be defined and not empty
            (filterObj.localWorkItemValue &&
                filterObj.localWorkItemValue.trim() !== "") ||

            (filterObj.globalWorkItemValue &&
                filterObj.globalWorkItemValue.trim() !== "") ||

            (filterObj.workGroupValue &&
                filterObj.workGroupValue.trim() !== "")
        );
    }

    function initializeCustomDropdown(containerId, menuId, inputId, toggleId, selectedValueId, defaultValue, defaultLabel) {
        const container = document.getElementById(containerId);
        const menu = document.getElementById(menuId);
        const input = document.getElementById(inputId);
        const toggle = document.getElementById(toggleId);
        const selectedValue = document.getElementById(selectedValueId);

        // Toggle dropdown menu
        toggle.addEventListener('click', () => {
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        });

        // Handle dropdown option click
        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.dropdown-option');
            if (!option) return;

            // Use id-based detection for custom option
            if (option.id && option.id.endsWith('-custom-option')) {
                menu.style.display = 'none';
                container.querySelector('.dropdown-selected').style.display = 'none';
                input.style.display = 'block';
                input.focus();
            } else {
                selectedValue.textContent = option.textContent;
                menu.style.display = 'none';
            }
        });

        // Handle custom input blur
        input.addEventListener('blur', () => {
            if (input.value.trim() !== '') {
                selectedValue.textContent = input.value.trim();
            } else {
                // If input is empty, reset to default label and select default option
                selectedValue.textContent = defaultLabel;
                // Remove 'selected' from all options, add to default
                menu.querySelectorAll('.dropdown-option.selected').forEach(opt => opt.classList.remove('selected'));
                const defaultOption = menu.querySelector(`.dropdown-option[data-value="${defaultValue}"]`);
                if (defaultOption) defaultOption.classList.add('selected');
            }
            input.style.display = 'none';
            container.querySelector('.dropdown-selected').style.display = 'flex';
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
            if (!node || !keyword) { return; }

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
            if (matches.length > 0) { navigateResults(); }
        }

        highlightTextInNode(table, keyword);
        updateSearchCounter();
    }

    function navigateResults(direction) {
        if (matches.length === 0) { return; }

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
        let offsetX = 0,
            offsetY = 0,
            drag = false;
        let handleOffsetX = 0,
            handleOffsetY = 0,
            handleWidth = 0,
            handleHeight = 0;
        const margin = 10; // Extra margin to ensure complete visibility beyond scrollbars

        handle.onmousedown = (e) => {
            drag = true;
            const elementRect = element.getBoundingClientRect();
            const handleRect = handle.getBoundingClientRect();

            // Calculate the offset from the mouse position to the element's top-left
            offsetX = e.clientX - elementRect.left;
            offsetY = e.clientY - elementRect.top;

            // Determine the handle's position and size relative to the element
            handleOffsetX = handleRect.left - elementRect.left;
            handleOffsetY = handleRect.top - elementRect.top;
            handleWidth = handleRect.width;
            handleHeight = handleRect.height;

            document.onmousemove = onMouseMove;
            document.onmouseup = () => {
                drag = false;
                document.onmousemove = document.onmouseup = null;
            };
        };

        function onMouseMove(e) {
            if (!drag) return;

            // Proposed new position for the element
            let candidateLeft = e.clientX - offsetX;
            let candidateTop = e.clientY - offsetY;

            // Get viewport dimensions (excluding scrollbars)
            const viewportWidth = document.documentElement.clientWidth;
            const viewportHeight = document.documentElement.clientHeight;

            // Calculate the absolute position of the .drag-handle relative to the viewport
            let handleLeftAbsolute = candidateLeft + handleOffsetX;
            let handleTopAbsolute = candidateTop + handleOffsetY;

            // Constrain horizontally with margin so that the entire handle is visible
            if (handleLeftAbsolute < margin) {
                candidateLeft = margin - handleOffsetX;
            } else if (handleLeftAbsolute + handleWidth > viewportWidth - margin) {
                candidateLeft = viewportWidth - margin - handleWidth - handleOffsetX;
            }

            // Constrain vertically with margin so that the entire handle is visible
            if (handleTopAbsolute < margin) {
                candidateTop = margin - handleOffsetY;
            } else if (handleTopAbsolute + handleHeight > viewportHeight - margin) {
                candidateTop = viewportHeight - margin - handleHeight - handleOffsetY;
            }

            element.style.left = `${candidateLeft}px`;
            element.style.top = `${candidateTop}px`;
        }

        // Adjust element's position when the window is resized
        function adjustPosition() {
            // Get the current element position from its inline style or computed position
            let candidateLeft = parseFloat(element.style.left) || element.getBoundingClientRect().left;
            let candidateTop = parseFloat(element.style.top) || element.getBoundingClientRect().top;

            // Recalculate the handle's offset relative to the element
            const elementRect = element.getBoundingClientRect();
            const handleRect = handle.getBoundingClientRect();
            const currentHandleOffsetX = handleRect.left - elementRect.left;
            const currentHandleOffsetY = handleRect.top - elementRect.top;
            const currentHandleWidth = handleRect.width;
            const currentHandleHeight = handleRect.height;

            const viewportWidth = document.documentElement.clientWidth;
            const viewportHeight = document.documentElement.clientHeight;

            let handleLeftAbsolute = candidateLeft + currentHandleOffsetX;
            let handleTopAbsolute = candidateTop + currentHandleOffsetY;

            if (handleLeftAbsolute < margin) {
                candidateLeft = margin - currentHandleOffsetX;
            } else if (handleLeftAbsolute + currentHandleWidth > viewportWidth - margin) {
                candidateLeft = viewportWidth - margin - currentHandleWidth - currentHandleOffsetX;
            }

            if (handleTopAbsolute < margin) {
                candidateTop = margin - currentHandleOffsetY;
            } else if (handleTopAbsolute + currentHandleHeight > viewportHeight - margin) {
                candidateTop = viewportHeight - margin - currentHandleHeight - currentHandleOffsetY;
            }

            element.style.left = `${candidateLeft}px`;
            element.style.top = `${candidateTop}px`;
        }

        // Listen for window resize events to adjust the element's position
        window.addEventListener("resize", adjustPosition);
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
            }
        }
    }
}());
