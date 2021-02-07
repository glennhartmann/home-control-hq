// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Server, ServerOptions } from './server';
import { Logger } from '../base/logger';

// The delegate that defines interaction of the network stack with the component that owns it.
export interface NetworkDelegate {

}

// Dictionary containing the required options when initializing the network environment.
export type NetworkOptions = ServerOptions;

// Driver for networking-related functionality of the smart home control system. Launches HTTP and
// WebSocket servers at the configured ports and provides the ability to interact with them.
export class Network {
    private delegate: NetworkDelegate;
    private logger: Logger;

    private server: Server;

    constructor(delegate: NetworkDelegate, logger: Logger, options: NetworkOptions) {
        this.delegate = delegate;
        this.logger = logger;

        this.server = new Server(logger, options);
    }

    listen() {
        this.server.listen();
    }
}
