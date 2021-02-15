// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import express, { NextFunction, Request, Response } from 'express';
import expressWs, { Application } from 'express-ws';
import * as ws from 'ws';

import { Logger } from './base/logger';
import { NetworkClient } from './network_client';

// The delegate that defines interaction of the network stack with the component that owns it.
export interface NetworkDelegate {
    // Called when the given |message| has been received from one of the clients.
    onNetworkCommand: (client: NetworkClient, command: string, params: object) => Promise<object | null>;

    // Requests the server's environment configuration to be reloaded.
    reloadEnvironment: () => Promise<boolean>;
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

    private server: Application;

    constructor(delegate: NetworkDelegate, logger: Logger, options: NetworkOptions) {
        this.delegate = delegate;
        this.logger = logger;
        this.options = options;

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
        const client = new NetworkClient(webSocket, request.ip);

        webSocket.on('open', () =>
            this.logger.info(`${client} Connection has been opened by ${request.ip}.`));

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
                this.logger.error(`${client} Received an message with invalid syntax:`, exception);

                webSocket.close();
                return;
            }

            let response: object | null = {};
            try {
                response = await this.handleInternalCommand(request, command!) ??
                           await this.delegate.onNetworkCommand(client, command!, parameters);

                if (response === null)
                    throw new Error(`${client} Received an invalid command: ${command}`);

            } catch (exception) {
                this.logger.warn(`${client} Unable to respond to a command message:`, exception);

                // Respond with the error message that was included in the exception.
                response = { error: exception.message };
            }

            webSocket.send(JSON.stringify({
                ...response,
                messageId,
            }));
        });

        webSocket.on('close', () =>
            this.logger.info(`${client} Connection has been closed.`));
    }

    // ---------------------------------------------------------------------------------------------

    // Manages commands internal to the server, which are not related with either the environment or
    // one of the services registered with the server.
    async handleInternalCommand(request: Request, command: string): Promise<object | null> {
        switch (command) {
            case 'hello':
                return { ip: request.ip };

            case 'reload-environment':
                return { success: await this.delegate.reloadEnvironment() };
        }

        return null;
    }

    // ---------------------------------------------------------------------------------------------

    listen() {
        const { hostname, port } = this.options;

        this.server.listen(port, hostname, () =>
            this.logger.info(`The server is now listening on ${hostname}:${port}...`));
    }
}
