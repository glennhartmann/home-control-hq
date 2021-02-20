// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Timeout, in milliseconds, after which a reconnection attempt will be made.
const kReconnectionTimeoutMs = 10000;

// Generates a message ID, as each send() operation will be acknowledged by the hub and thus need a
// reasonably unique identifier to specifically refer to it.
function generateMessageId() {
    const values = new Uint32Array(8);
    window.crypto.getRandomValues(values);

    let messageId = '';
    for (let i = 0; i < values.length; ++i)
        messageId += (i < 2 || i > 5 ? '' : '-') + values[i].toString(16).slice(-4);

    return messageId;
}

// The control connection will always be established while the touch control is running, and is the
// bidirectional channel over which commands will be issued, and we will receive updates from hub.
//
// The connection is an event target, providing three events:
//
//   * connect         When connection with the hub has been established.
//   * disconnect      When connection with the hub has been lost.
//   * message         When a message has been received from the hub.
//
// In addition, a send() method is available through which messages can be send to the hub. The
// contents of such messages should be an object, which will be serialized as JSON.
export class ControlConnection extends EventTarget {
    static STATE_DISCONNECTED = 0;
    static STATE_CONNECTING = 1;
    static STATE_CONNECTED = 2;

    #socket;
    #state = ControlConnection.STATE_DISCONNECTED;
    #responses = new Map();

    // Establishes a connection to the WebSocket server. The WebSocket instance will be returned
    // when the connection has been established, or NULL will be returned when that fails.
    async connect() {
        if (this.#state !== ControlConnection.STATE_DISCONNECTED)
            throw new Error('The control connection is not in a disconnected state.');

        // Resolve all pending message promises, as we won't be getting responses anymore.
        for (const pendingPromise of this.#responses.values())
            pendingPromise(null /* no response */);

        this.#state = ControlConnection.STATE_CONNECTING;
        this.#responses = new Map();

        this.#socket = new WebSocket(`ws://${window.location.host}/control`);
        this.#socket.addEventListener('open', ControlConnection.prototype.onOpen.bind(this));
        this.#socket.addEventListener('error', ControlConnection.prototype.onError.bind(this));
        this.#socket.addEventListener('message', ControlConnection.prototype.onMessage.bind(this));
        this.#socket.addEventListener('close', ControlConnection.prototype.onClose.bind(this));
    }

    // Sends the given |message| over the control connection. Invalid when the connection is not
    // currently established, in which case an exception will be thrown. The returned promise will
    // be settled when an acknowledgement or response has been received from the hub.
    async send(message) {
        if (this.#state !== ControlConnection.STATE_CONNECTED)
            throw new Error('Messages can only be send when there is an established connection.');

        if (typeof message !== 'object' || !message.hasOwnProperty('command'))
            throw new Error('Messages must be objects sending a particular command.');

        return this.sendInternal(message);
    }

    // Actually sends the given |message|, without doing additional validation checks. A unique
    // message Id will be associated to the message.
    async sendInternal(message) {
        message.messageId = generateMessageId();

        this.#socket.send(JSON.stringify(message));

        return new Promise(resolve =>
            this.#responses.set(message.messageId, resolve));
    }

    // Called when a connection has been established. We send a "hello" message to which the hub
    // will respond with some basic information about the current environment.
    onOpen() {
        this.sendInternal({ command: 'hello' }).then(() => {
            if (this.#state !== ControlConnection.STATE_CONNECTING)
                return;  // unexpected state

            this.#state = ControlConnection.STATE_CONNECTED;
            this.dispatchEvent(new CustomEvent('connect'));
        });
    }

    // Called when an error happens on the WebSocket connection. Close it.
    onError(event) { this.#socket.close(); }

    // Called when a message has been received from the control connection. It will be forwarded
    // as-is while the connection is in an established mode.
    onMessage(event) {
        let message = null;

        try {
            message = JSON.parse(event.data);
        } catch {
            console.error('Invalid message received from the WebSocket connection, ignoring.');
            return;
        }

        // (1) If the |message| has a `messageId` set, then there should be a promise resolver
        // waiting to hear back from it. It's an acknowledgement.
        if (message.hasOwnProperty('messageId')) {
            const resolve = this.#responses.get(message.messageId);
            if (resolve)
                resolve(message);

            return;
        }

        // (2) Otherwise it's a message that we received from the hub. Something else needs to be
        // done, so dispatch this as a regular message event.
        this.dispatchEvent(new CustomEvent('message', { detail: message }));
    }

    // Called when the connection has been closed, for any reason. The "disconnected" event will be
    // dispatched, and reconnection attempts will start after a brief delay.
    onClose() {
        if (this.#state === ControlConnection.STATE_DISCONNECTED)
            return;

        if (this.#state === ControlConnection.STATE_CONNECTED)
            this.dispatchEvent(new CustomEvent('disconnect'));

        this.#state = ControlConnection.STATE_DISCONNECTED;

        // Automatically attempt to reconnect to the hub after a defined number of milliseconds.
        setTimeout(ControlConnection.prototype.connect.bind(this), kReconnectionTimeoutMs);
    }
}
