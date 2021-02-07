// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ControlConnection } from './management/control-connection.js';

export class DebugInterface {
    #connection;
    #elements;

    constructor(elements) {
        this.#elements = elements;

        this.#connection = new ControlConnection();
        this.#connection.addEventListener(
            'connect', DebugInterface.prototype.onConnectionConnect.bind(this));
        this.#connection.addEventListener(
            'disconnect', DebugInterface.prototype.onConnectionDisconnect.bind(this));
        this.#connection.addEventListener(
            'message', DebugInterface.prototype.onConnectionMessage.bind(this));

        this.#connection.connect();
    }

    // ---------------------------------------------------------------------------------------------
    // ControlConnection event listeners
    // ---------------------------------------------------------------------------------------------

    onConnectionConnect() {
        this.consoleMessage('Connection with the server has been established.');
        this.composeRoomList();
    }

    onConnectionDisconnect() {
        this.consoleMessage('Connection with the server has been lost.');
    }

    onConnectionMessage(event) {}

    // ---------------------------------------------------------------------------------------------

    // Requests the list of rooms from the server, and displays them in an unordered list. Each of
    // the rooms can be clicked on to reveal a list of the available services for that room.
    async composeRoomList() {
        const container = this.#elements.rooms;
        const { rooms } = await this.#connection.send({ command: 'environment-room-list' });

        while (container.firstChild)
            container.removeChild(container.firstChild);

        const listElement = document.createElement('ul');
        for (const name of rooms) {
            const nameElement = document.createElement('li');

            nameElement.innerText = name;
            nameElement.addEventListener(
                'click', DebugInterface.prototype.composeServiceList.bind(this, name));

            listElement.appendChild(nameElement);
        }

        container.appendChild(listElement);
    }

    //
    async composeServiceList(room, event) {
        for (const element of document.querySelectorAll('#rooms li.selected'))
            element.classList.remove('selected');

        event.target.classList.add('selected');

        console.log(room, event);
    }

    // ---------------------------------------------------------------------------------------------

    // Writes the given |message| (in monospace font) to the console.
    consoleMessage(title, message) {
        const detailsElement = document.createElement('details');
        const summaryElement = document.createElement('summary');

        summaryElement.innerText = title;
        detailsElement.appendChild(summaryElement);

        if (message) {
            const contentElement = document.createElement('pre');
            contentElement.innerText = message;

            detailsElement.appendChild(contentElement);
        }

        this.#elements.console.appendChild(detailsElement);
        this.#elements.console.scrollTop =
            this.#elements.console.scrollHeight - this.#elements.console.clientHeight;
    }
}
