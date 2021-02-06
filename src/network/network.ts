// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { HttpServer, HttpServerOptions } from './http_server';
import { Logger } from '../base/logger';
import { WebSocketServer, WebSocketServerOptions } from './web_socket_server';

// The delegate that defines interaction of the network stack with the component that owns it.
export interface NetworkDelegate {

}

// Dictionary containing the required options when initializing the network environment.
export interface NetworkOptions {
    // HTTP Server configuration
    http: HttpServerOptions;

    // WebSocket Server configuration
    ws: WebSocketServerOptions;
}

// Driver for networking-related functionality of the smart home control system. Launches HTTP and
// WebSocket servers at the configured ports and provides the ability to interact with them.
export class Network {
    private delegate: NetworkDelegate;
    private logger: Logger;

    private httpServer: HttpServer;
    private wsServer: WebSocketServer;

    constructor(delegate: NetworkDelegate, logger: Logger, options: NetworkOptions) {
        this.delegate = delegate;
        this.logger = logger;

        this.httpServer = new HttpServer(logger, options.http);
        this.wsServer = new WebSocketServer(options.ws);
    }

    listen() {
        this.httpServer.listen();
        this.wsServer.listen();
    }
}
