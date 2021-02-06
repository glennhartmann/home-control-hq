// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Database } from './base/database';
import { Logger } from './base/logger';
import { Network, NetworkDelegate, NetworkOptions } from './network/network';

// Options available to the server infrastructure.
interface ServerOptions {
    // Qualified path to the JSON file in which state will be stored.
    database: string;

    // Whether output for debugging should be enabled.
    debug?: boolean;

    // Options specific to the network configuration for the system.
    network: NetworkOptions;
}

// Main runtime of the server. Owns the network stack, services infrastructure and provides the
// ability to communicate between them.
export class Server implements NetworkDelegate {
    private options: ServerOptions;

    private database: Database;
    private logger: Logger;

    private network: Network;

    constructor(options: ServerOptions) {
        this.options = options;

        const logger = new Logger(options.debug);

        this.database = new Database(logger, options.database);
        this.logger = logger;

        this.network = new Network(this, logger, options.network);
    }

    // Initializes the server, component by component.
    async initialize() {
        this.network.listen();
    }

    // ---------------------------------------------------------------------------------------------
    // NetworkDelegate interface:
    // ---------------------------------------------------------------------------------------------
}
