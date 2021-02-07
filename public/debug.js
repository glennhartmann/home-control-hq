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

    // Requests the list of services available for the given |room|. The user interface will be
    // updated to reflect the fact that the |room| has been selected.
    async composeServiceList(room, event) {
        for (const element of this.#elements.rooms.querySelectorAll('li.selected'))
            element.classList.remove('selected');

        event.target.classList.add('selected');

        const container = this.#elements.services;
        const { services } = await this.#connection.send({
            command: 'environment-service-list',
            room,
        });

        while (container.firstChild)
            container.removeChild(container.firstChild);

        const listElement = document.createElement('ul');
        for (const { label, service, options } of services) {
            const serviceElement = document.createElement('li');

            serviceElement.innerText = label;
            serviceElement.addEventListener(
                'click', DebugInterface.prototype.composeControlList.bind(
                    this, room, service, options));

            listElement.appendChild(serviceElement);
        }

        container.appendChild(listElement);
    }

    // Composes the list of controls available for the given |service| in the |room|. The |options|
    // are treated as opaque for the debug page, and will just be passed back to the server.
    async composeControlList(room, service, options, event) {
        for (const element of this.#elements.services.querySelectorAll('li.selected'))
            element.classList.remove('selected');

        event.target.classList.add('selected');

        const container = this.#elements.controls;

        while (container.firstChild)
            container.removeChild(container.firstChild);

        // TODO: We hard-code this for Philips Hue controls for now. The server will likely need
        // some form of capabilities sharing to automate this across services.
        const controls = {
            'Turn on': { command: 'philips-hue-on' },
            'Turn off': { command: 'philips-hue-off' },
            'Brightness 25%': { command: 'philips-hue-brightness', brightness: 63 },
            'Brightness 100%': { command: 'philips-hue-brightness', brightness: 191 },
        };

        const listElement = document.createElement('ul');
        for (const [ label, command ] of Object.entries(controls)) {
            const controlElement = document.createElement('li');

            controlElement.innerText = label;
            controlElement.addEventListener(
                'click', DebugInterface.prototype.issueCommand.bind(
                    this, { room, service, options, ...command }));

            listElement.appendChild(controlElement);
        }

        container.appendChild(listElement);
    }

    // Issues the given |command| to the server. No visual feedback will be given for now.
    async issueCommand(command) {
        this.consoleMessage(`Command: ${command.command}`, await this.#connection.send(command));
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
            contentElement.innerText = JSON.stringify(message);

            detailsElement.appendChild(contentElement);
        }

        this.#elements.console.appendChild(detailsElement);
        this.#elements.console.scrollTop =
            this.#elements.console.scrollHeight - this.#elements.console.clientHeight;
    }
}
