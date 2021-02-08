// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import express, { NextFunction, Request, Response } from 'express';
import expressWs, { Application } from 'express-ws';
import * as ws from 'ws';

import { Client } from './client';
import { Logger } from '../base/logger';

// The delegate that defines interaction of the network stack with the component that owns it.
export interface NetworkDelegate {
    // Called when the given |message| has been received from the |client|.
    onNetworkCommand: (client: Client, command: string, params: object) => Promise<object>;
}

// Dictionary containing the required options when initializing the network environment.
export interface NetworkOptions {
    // Hostname on which the HTTP server should listen.
    hostname: string;

    // Port number on which the HTTP server should listen.
    port: number;

    // Qualified path to the `public` directory for static files.
    public?: string;
}

// Provides the HTTP server, backed by ExpressJS, through which the frontend of the smart home
// system will be served to the devices. HTTPS is not used because, well, it's local, and if someone
// has access to our network then they're welcome to the light switches too :)
//
// The HTTP server further exposes a `/control` endpoint, which can be connected to through the
// WebSockets protocol for long-lived bidirectional communication with the clients.
//
// The Network interface provides the ability to broadcast messages, optionally filtered for clients
// interested in a particular room, and communicates with the rest of the server through the
// delegate interface, for example to propagate command messages.
export class Network {
    private delegate: NetworkDelegate;
    private logger: Logger;
    private options: NetworkOptions;

    private clientId: number;
    private clients: Set<Client>;
    private server: Application;

    constructor(delegate: NetworkDelegate, logger: Logger, options: NetworkOptions) {
        this.delegate = delegate;
        this.logger = logger;
        this.options = options;

        this.clientId = 1;
        this.clients = new Set();

        this.server = expressWs(express()).app;

        this.server.use(Network.prototype.onNetworkRequest.bind(this));
        this.server.ws('/control', Network.prototype.onNetworkConnection.bind(this));

        if (options.public)
            this.server.use(express.static(options.public));
    }

    // ---------------------------------------------------------------------------------------------
    // Interface for listening to incoming requests
    // ---------------------------------------------------------------------------------------------

    // Called when any network request has been issued to the server.
    onNetworkRequest(request: Request, response: Response, next: NextFunction) {
        this.logger.debug(`Network request from ${request.ip}: ${request.path}`);
        next();
    }

    // Called when a WebSocket connection with the `/control` endpoint has been initiated. Events
    // will be displayed in the console, and messages will be routed to the networking delegate.
    onNetworkConnection(webSocket: ws, request: Request, next: NextFunction) {
        const client = new Client(this.clientId++, request.ip, webSocket);
        const prefix = `[WS:${client.clientId}]`;

        webSocket.on('close', () =>
            this.logger.info(`${prefix} Connection has been closed.`));

        webSocket.on('open', () =>
            this.logger.info(`${prefix} Connection has been opened by ${request.ip}.`));

        webSocket.on('message', async messageData => {
            let command: string | undefined;
            let messageId: string | undefined;
            let parameters: object;

            try {
                const message = JSON.parse(messageData.toString('utf8'));
                if (typeof message !== 'object')
                    throw new Error('Messages must be formatted as a valid JSON object.');

                if (!message.hasOwnProperty('command') || typeof message.command !== 'string')
                    throw new Error('Messages are required to have a textual command.');

                if (!message.hasOwnProperty('messageId') || typeof message.messageId !== 'string')
                    throw new Error('Messages are required to have been assigned a unique Id.');

                ({ command, messageId, ...parameters } = message);

            } catch (exception) {
                this.logger.error(`${prefix} Received an invalid message:`, exception);

                webSocket.close();
                return;
            }

            try {
                const response = {
                    ...await this.delegate.onNetworkCommand(client, command!, parameters),
                    messageId,
                };

                webSocket.send(JSON.stringify(response));

            } catch (exception) {
                this.logger.warn(`${prefix} Unable to respond to a command message:`, exception);

                webSocket.send(JSON.stringify({
                    error: exception.message,
                    messageId,
                }));
            }
        });

        this.clients.add(client);
    }

    // ---------------------------------------------------------------------------------------------

    listen() {
        const { hostname, port } = this.options;

        this.server.listen(port, hostname, () =>
            this.logger.info(`The server is now listening on ${hostname}:${port}...`));
    }
}
