// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as ws from 'ws';

// Interface that must be supported by anything that wants to observe the network.
export interface NetworkClientObserver {
    // Called when a client has been disconnected. They should no longer receive updates.
    onClientDisconnected: (client: NetworkClient) => void;
}

// Represents a client connected to the network. This object provides the ability to observe the
// client's connection events, as well as the ability to send messages directly to the client.
export class NetworkClient {
    private ip: string;
    private observers: Set<NetworkClientObserver>;
    private webSocket: ws;

    constructor(webSocket: ws, ip: string) {
        this.ip = ip;

        this.observers = new Set();
        this.webSocket = webSocket;
        this.webSocket.on('close', () => {
            for (const client of this.observers)
                client.onClientDisconnected(this);
        });
    }

    // ---------------------------------------------------------------------------------------------

    // Sends the given |message| to this client in JSON format. At some point we might want to
    // update this method with the ability to acknowledge receipt, but that point is not today.
    async send(message: object) {
        this.webSocket.send(JSON.stringify(message));
    }

    // ---------------------------------------------------------------------------------------------

    // Adds the given |observer| to the list of observers. Safe to be called multiple times.
    addObserver(observer: NetworkClientObserver): void {
        this.observers.add(observer);
    }

    // Removes the given |observer| from the list of observers.
    deleteObserver(observer: NetworkClientObserver): void {
        this.observers.delete(observer);
    }

    // ---------------------------------------------------------------------------------------------

    toString() { return `[Client:${this.ip}]`; }
}
