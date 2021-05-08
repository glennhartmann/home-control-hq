// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { PhilipsHueBindings } from './services/philips_hue_bindings.js';

// Drives the entire controller, both connection management and interface management. Used for the
// actual unit interface, but not for the debug pages.
export class Controller {
    #connection;  // ControlConnection instance
    #container;   // HTMLElement for the service container
    #dialogs;     // HTMLDialogElement[] for { error, notConnected, selectRoom }

    // Name of the room this controller is responsible for.
    #room;

    // Array of element bindings that have been created for this controller.
    #bindings;

    constructor(connection, { container, dialogs }) {
        this.#connection = connection;
        this.#container = container;
        this.#dialogs = dialogs;

        // Attach connection listeners:
        connection.addEventListener('connect', Controller.prototype.onConnected.bind(this));
        connection.addEventListener('disconnect', Controller.prototype.onDisconnected.bind(this));

        // Attempt the connection:
        connection.connect();
    }

    // ---------------------------------------------------------------------------------------------
    // Connection listeners
    // ---------------------------------------------------------------------------------------------

    // Called when the control connection has been established, either during device boot or when
    // connection was lost during operation. We assume a new environment each time this happens.
    async onConnected() {
        const { rooms } = await this.#connection.send({ command: 'environment-rooms' });

        // (1) Close the connection dialog, as we are now connected.
        this.#dialogs.notConnected.close();

        // (2) Require the user to select a valid room which this controller is responsible for.
        if (!this.#room || !rooms.includes(this.#room))
            this.#room = await this.selectRoom(rooms);

        // (3) Fetch the list of services that exist for that room.
        const { services } = await this.#connection.send({
            command: 'environment-services',
            room: this.#room,
        });

        // (4) Clear the list of displayed services, and add each of the services to the container
        // after clearing all services that are already being displayed, if any.
        while (this.#container.firstChild)
            this.#container.removeChild(this.#container.firstChild);

        this.#bindings = [];
        for (const service of services)
            await this.initializeService(service);
    }

    onDisconnected() {
        this.#dialogs.notConnected.showModal();
    }

    // ---------------------------------------------------------------------------------------------
    // User Interface helpers
    // ---------------------------------------------------------------------------------------------

    // Displays a fatal error message. The message cannot be discarded without reloading the entire
    // page & controller, and thus should only be used in exceptional circumstances.
    displayFatalError(errorMessage) {
        const message = this.#dialogs.error.querySelector('#error-message');
        const reload = this.#dialogs.error.querySelector('#error-reload-button');

        message.textContent = errorMessage;
        reload.addEventListener('click', () => document.location.reload());

        this.#dialogs.error.show();
    }

    // Renders the given |service| in the controller's container. The service's display will be
    // determined by a custom element specific to the given |service|.
    async initializeService({ label, service, options }) {
        let bindings = null;
        switch (service) {
            case 'Philips Hue':
                bindings = new PhilipsHueBindings(this.#connection, label, options);
                break;

            default:
                this.displayFatalError(`Cannot display unrecognised service: "${service}"`);
                return;
        }

        this.#container.appendChild(bindings.element);
        this.#bindings.push(bindings);
    }

    // Requires the user to select a room from a list of |rooms|. Will display a dialog for the
    // duration of this operation, that cannot be dismissed through other means.
    async selectRoom(rooms) {
        const roomList = this.#dialogs.selectRoom.querySelector('#room-list');
        while (roomList.firstChild)
            roomList.removeChild(roomList.firstChild);

        let roomResolver = null;
        let roomPromise = new Promise(resolve => roomResolver = resolve);

        for (const room of rooms.sort()) {
            const roomElement = document.createElement('li');

            if (room === this.#room || room === 'Kitchen')
                roomElement.classList.add('active');

            roomElement.textContent = room;
            roomElement.addEventListener('click', () => {
                if (!roomResolver)
                    return;

                this.#dialogs.selectRoom.close();

                roomResolver(room);
                roomResolver = null;
            });

            roomList.appendChild(roomElement);
        }

        for (const debugValue of this.#connection.debugValues) {
            const listElement = document.createElement('li');

            listElement.classList.add('debug');
            listElement.textContent = debugValue;

            roomList.appendChild(listElement);
        }

        this.#dialogs.selectRoom.show();
        return await roomPromise;
    }
}
