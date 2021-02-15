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
        const { rooms } = await this.#connection.send({ command: 'environment-rooms' });

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
            command: 'environment-services',
            room,
        });

        while (container.firstChild)
            container.removeChild(container.firstChild);

        const listElement = document.createElement('ul');
        for (const { label, service, options } of services) {
            const serviceElement = document.createElement('li');

            serviceElement.innerText = label;
            serviceElement.addEventListener(
                'click', DebugInterface.prototype.composeCommandList.bind(this, service, options));

            listElement.appendChild(serviceElement);
        }

        container.appendChild(listElement);
    }

    // Composes the list of commands available for the given |service| in a room. The |options| are
    // treated as opaque for the debug page, and will just be passed back to the server.
    async composeCommandList(service, options, event) {
        for (const element of this.#elements.services.querySelectorAll('li.selected'))
            element.classList.remove('selected');

        event.target.classList.add('selected');

        const container = this.#elements.controls;
        const { commands } = await this.#connection.send({
            command: 'service-commands',
            service,
        });

        while (container.firstChild)
            container.removeChild(container.firstChild);

        const listElement = document.createElement('ul');
        for (const command of commands) {
            const commandElement = document.createElement('li');

            commandElement.innerText = command.command;
            commandElement.addEventListener(
                'click', DebugInterface.prototype.composeConfigureCommand.bind(
                    this, options, command));

            listElement.appendChild(commandElement);
        }

        container.appendChild(listElement);
    }

    // Composes a dialog that allows the |command| to be configured, depending on the parameter
    // information that has been given by the server.
    async composeConfigureCommand(options, command) {
        const dialogElement = this.#elements.configuration;

        dialogElement.querySelector('h1').innerText = command.command;
        dialogElement.querySelector('p').innerText = command.description;

        const parametersElement = dialogElement.querySelector('ul');
        const parametersGetters = [];

        while (parametersElement.firstChild)
            parametersElement.removeChild(parametersElement.firstChild);

        for (const parameter of command.parameters) {
            parametersGetters.push(
                this.composeCommandParameter(parametersElement, options, parameter));
        }

        const existingIssueElement = dialogElement.querySelector('button:first-of-type');
        const issueElement = document.createElement('button');

        issueElement.innerText = existingIssueElement.innerText;
        issueElement.addEventListener('click', async() => {
            let parameters = {};
            for (const getter of parametersGetters)
                parameters = getter(parameters);

            await this.issueCommand({ command: command.command, ...parameters });

            dialogElement.close();
        });

        existingIssueElement.replaceWith(issueElement);

        const closeElement = dialogElement.querySelector('button:last-of-type');
        closeElement.addEventListener('click', () => {
            dialogElement.close();
        });

        // Show the <dialog> element as a modal, creating a gradient over the background.
        dialogElement.showModal();
    }

    // Composes an individual parameter field for one of the commands, which will be appended to
    // the given |container|. A function will be returned to read the parameter's value.
    composeCommandParameter(container, options, parameter) {
        const listElement = document.createElement('li');
        const labelElement = document.createElement('label');
        let valueElement = document.createElement('input');

        labelElement.innerText = parameter.name;

        switch (parameter.type) {
            case 'boolean':
                valueElement.type = 'checkbox';
                break;

            case 'number':
                valueElement.type = 'number';
                valueElement.value = 0;
                break;

            case 'string':
                valueElement.type = 'text';

                if (options.hasOwnProperty(parameter.name))
                    valueElement.value = options[parameter.name];

                break;
        }

        listElement.appendChild(labelElement);
        listElement.appendChild(valueElement);

        container.appendChild(listElement);

        // Returns a function that builds the options dictionary, through which the server is able
        // to actually execute on the command.
        return (parameters) => {
            switch (parameter.type) {
                case 'boolean':
                    parameters[parameter.name] = !!valueElement.checked;
                    break;

                case 'number':
                    parameters[parameter.name] = parseInt(valueElement.value, 10);
                    break;

                case 'string':
                    parameters[parameter.name] = valueElement.value;
                    break;
            }

            return parameters;
        };
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
