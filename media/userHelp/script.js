/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
document.addEventListener('DOMContentLoaded', (function () {

    let USER_HELP;
    let ALL_GDB_COMMANDS;
    window.addEventListener('message', event => {
        const message = event.data; // The JSON data our extension sent
        switch (message.command) {
            case 'userHelp':
                USER_HELP = message.data;
                ALL_GDB_COMMANDS = [
                    USER_HELP.gdbCommandsToCompare,
                    USER_HELP.oneapiCommandsToCompare,
                    USER_HELP.oneapiNewCommands
                ];
                RUN_SCRIPT();
                break;
        }
    });

    let Z_INDEX = 2;

    function RUN_SCRIPT() {
        let commandWordsIds = composeCommandWordIds();
        setEventListeners(commandWordsIds);
    }

    function composeCommandWordIds() {
        const commandWordsIds = [];
        for (const collection of ALL_GDB_COMMANDS) {
            for (const command of collection) {
                for (const keyWord of command.keyWords) {
                    // getting all id's creating them in the same way how they had been created in src/UserHelp.ts
                    const spanId = `${keyWord.name.replace(/[^a-zA-Z-_]/g, '')}_${command.id}`;
                    commandWordsIds.push(spanId);
                }
            }
        }
        return commandWordsIds;
    }

    function setEventListeners(commandWordsIds) {
        // Set listeners for commands tds
        for (const collection of ALL_GDB_COMMANDS) {
            for (const command of collection) {
                htmlObjectCommand = document.getElementById(command.id);

                htmlObjectCommand.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (e.target.nodeName === "TD") {
                        const commandId = e.target.id;
                        const activeCommand = getItemFromJson(commandId, '', false);
                        const modal = createModal(commandId, activeCommand, false, true);
                        showModal(modal, e);
                    }
                });

                htmlObjectCommand.addEventListener('mouseenter', (e) => {
                    e.stopPropagation();
                    if (e.target.nodeName === "TD") {
                        const commandId = e.target.id;
                        const activeCommand = getItemFromJson(commandId, '', false);
                        const modal = createModal(commandId, activeCommand, true, true);
                        modal.addEventListener("mouseleave", (e) => modal.remove());
                        showModal(modal, e);
                    }
                });
            }
        }

        // Set listeners for buttons
        for (const collection of [USER_HELP.gdbCommandsToCompare, USER_HELP.oneapiCommandsToCompare]) {
            for (command of collection) {
                htmlObjectButtonToDocs = document.getElementById(`docButton_${command.id}`);

                htmlObjectButtonToDocs.addEventListener("click", (e) => {
                    // Need to reference to sibling to get to different commands - command.id leads always to last command in collection
                    const commandId = e.target.parentNode.previousElementSibling.id;
                    const activeCommand = getItemFromJson(commandId, '', false);
                    // console.log(`Button ${e.target.id} clicked and command ${activeCommand.name} appeared in docs`);
                    e.target.outerHTML = activeCommand.command['link'] ? `<p><a href=${activeCommand.command.link}>LINK</a></p>` : `<p>Chapter: ${activeCommand.command.chapter}</p>`;
                });
            }
        }

        // Set listeners for keyWords spans
        for (id of commandWordsIds) {
            htmlObjectKeyWord = document.getElementById(id);

            htmlObjectKeyWord.addEventListener("click", (e) => {
                e.stopPropagation();
                const keyWord = e.target.innerHTML;
                const commandId = e.target.parentNode.id;
                const activeKeyWord = getItemFromJson(commandId, keyWord, true);
                const modal = createModal(commandId, activeKeyWord, false, false);
                showModal(modal, e);
            });

            htmlObjectKeyWord.addEventListener("mouseenter", (e) => {
                e.stopPropagation();
                const keyWord = e.target.innerHTML;
                const commandId = e.target.parentNode.id;
                const activeKeyWord = getItemFromJson(commandId, keyWord, true);
                const modal = createModal(commandId, activeKeyWord, true, false);
                modal.addEventListener("mouseleave", (e) => modal.remove());
                showModal(modal, e);
            });
        }
    }

    function getItemFromJson(commandId, keyWord, isKeyWord) {
        for (const collection of ALL_GDB_COMMANDS) {
            for (const command of collection) {
                if (command.id === commandId) {
                    if (isKeyWord) {
                        for (word of command.keyWords) {
                            if (word.name === keyWord) {
                                return word;
                            }
                        }
                    }
                    return command;
                }
            }
        }
        console.error(`Function 'getItemFromJson' couldn't find item: ${item}`);
    }

    function createModal(commandId, item, isHover, isCommand) {
        const modal = document.createElement('div');
        const closeMark = document.createElement('div');
        const name = document.createElement('div');
        const description = document.createElement('div');
        const aliases = document.createElement('div');

        if (isCommand){
            item = item.command;
        }

        name.innerHTML = isCommand ? item.name : item.name.replace(/[^a-zA-Z-_]/g, '');
        description.innerHTML = `<p>${item.descriptionShort}</p><p>${!isHover && item['descriptionLong'] ? item['descriptionLong'] : ''}</p>`;
        aliases.innerHTML = `Aliases: ${item['aliases'] ? item['aliases'] : '-no-aliases-'}`;

        let id = '';

        if (isHover) {
            id = 'helpTextModal_hover';
        } else {
            if(isCommand){
                id = `helpTextModal_click_${commandId}`;
            }else{
                id = `helpTextModal_click_${name.innerHTML}_${commandId}`;
            }
        }

        const hoverModal = document.getElementById('helpTextModal_hover');
        if (hoverModal) {
            hideModal(hoverModal);
        }

        const oldModal = document.getElementById(id);
        if (oldModal) {
            hideModal(oldModal);
        }

        Z_INDEX = isHover ? 2 : 3;
        modal.style['z-index'] = Z_INDEX;
        modal.style['position'] = 'absolute';
        modal.style['font-family'] = 'Consolas';
        modal.style['border'] = '1px solid gray';
        modal.style['background-color'] = 'darkslategray';
        modal.style['max-width'] = '500px';

        name.style['font-weight'] = 'bolder';
        name.style['text-align'] = 'center';
        name.style['padding'] = '5px';
        name.style['border-bottom'] = '1px dotted lightgrey';

        description.style['width'] = 'fit-content';
        description.style['text-align'] = 'justify';
        description.style['padding'] = '5px';
        description.style['border-bottom'] = '1px dotted lightgrey';

        aliases.style['font-style'] = 'italic';
        aliases.style['text-align'] = 'left';
        aliases.style['padding'] = '5px';

        closeMark.style['width'] = '100%';
        closeMark.style['height'] = '20px';
        closeMark.style['margin-top'] = '-25px';
        closeMark.style['text-align'] = 'end';
        closeMark.style['color'] = 'white';
        closeMark.style['cursor'] = 'pointer';
        closeMark.innerHTML = `close X`;
        closeMark.addEventListener("click", () => hideModal(modal));
        closeMark.addEventListener("mouseover", () => closeMark.style['color'] = 'red');
        closeMark.addEventListener("mouseout", () => closeMark.style['color'] = 'white');

        modal.appendChild(name);
        modal.appendChild(description);
        modal.appendChild(aliases);

        if (!isHover) {
            modal.appendChild(closeMark);
        }

        modal.id = id;
        return modal;
    }

    function showModal(modal, event) {
        document.body.appendChild(modal);
        modal.style.left = `${event.clientX+10}px`;
        modal.style.top = `${event.clientY+window.scrollY+10}px`;
        modal.style.display = 'block';
        document.body.appendChild(modal);
    }

    function hideModal(modal) {
        modal.style.display = 'none';
        modal.remove();
    }


}));
