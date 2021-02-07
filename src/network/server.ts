// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import express from 'express';
import expressWs, { Application } from 'express-ws';
import * as ws from 'ws';

import { Logger } from '../base/logger';

// Options that must be configured when initializing the HTTP Server.
export interface ServerOptions {
    // Hostname on which the HTTP server should listen.
    hostname: string;

    // Port number on which the HTTP server should listen.
    port: number;

    // Qualified path to the `public` directory for static files.
    public?: string;
};

// Provides the HTTP server, backed by ExpressJS, through which the frontend of the smart home
// system will be served to the devices. HTTPS is not used because, well, it's local, and if someone
// has access to our network then they're welcome to the light switches too :)
//
// The HTTP server further exposes a /control endpoint, which can be connected to through the
// WebSockets protocol for long-lived bidirectional communication with the clients.
export class Server {
    private logger: Logger;
    private options: ServerOptions;

    private server: Application;

    constructor(logger: Logger, options: ServerOptions) {
        this.logger = logger;
        this.options = options;

        this.server = expressWs(express()).app;

        this.server.use(Server.prototype.onRequest.bind(this));
        this.server.ws('/control', Server.prototype.onWebSocketConnection.bind(this));

        if (options.public)
            this.server.use(express.static(options.public));
    }

    // Called when any network request has been issued to the server. Responsible for logging this
    // to the console, so that the server (when in debug mode) can recognise this.
    onRequest(request: express.Request, response: express.Response, next: express.NextFunction) {
        this.logger.debug(`Network request from ${request.ip}: ${request.path}`);
        next();
    }

    // Called when the `/control` WebSocket endpoint has been called, and a connection has been
    // initiated. The WebSocket is fully operational.
    onWebSocketConnection(webSocket: ws, request: express.Request, next: express.NextFunction) {
        this.logger.debug(`WebSocket connection initiated by ${request.ip}.`);
    }

    listen() {
        const { hostname, port } = this.options;

        this.server.listen(port, hostname, () => {
            this.logger.info(`The HTTP server is now listening on ${hostname}:${port}...`);
        });
    }
}
