// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Client } from './network/client';
import { Database } from './base/database';
import { Environment } from './environment/environment';
import { Logger } from './base/logger';
import { Network, NetworkDelegate, NetworkOptions } from './network/network';
import { ServiceDelegate, ServiceManager } from './services/service_manager';
import { Service } from './services/service';

// Options available to the server infrastructure.
interface ServerOptions {
    // Qualified path to the JSON file in which state will be stored.
    database: string;

    // Whether output for debugging should be enabled.
    debug?: boolean;

    // Qualified path to the JSON file in which environment configuration is stored.
    environment: string;

    // Options specific to the network configuration for the system.
    network: NetworkOptions;
}

// Main runtime of the server. Owns the network stack, services infrastructure and provides the
// ability to communicate between them.
export class Server implements NetworkDelegate, ServiceDelegate {
    private options: ServerOptions;

    public database: Database;
    public logger: Logger;

    private environment: Environment;
    private network: Network;
    private services: ServiceManager;

    constructor(options: ServerOptions) {
        this.options = options;

        const logger = new Logger(options.debug);

        this.database = new Database(logger, options.database);
        this.logger = logger;

        this.environment = Environment.empty();
        this.network = new Network(this, logger, options.network);
        this.services = new ServiceManager(this, this.database, logger);
    }

    // Initializes the server, component by component.
    async initialize(services: Array<Service>) {
        for (const service of services)
            await this.services.addService(service);

        if (!await this.reloadEnvironment())
            throw new Error(`Unable to load the home configuration, aborting.`);

        this.network.listen();
    }

    // Asynchronously reloads the environment configuration for the server. The existing environment
    // will only be overridden when successful, otherwise the request will be ignored.
    async reloadEnvironment() {
        const environment = await Environment.fromFile(this.logger, this.options.environment);
        if (!environment)
            return false;

        if (!await this.services.validateEnvironment(environment))
            return false;

        this.environment = environment;
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // NetworkDelegate interface:
    // ---------------------------------------------------------------------------------------------

    // Called when the given |command| has been received from the |client|.
    async onNetworkCommand(client: Client, command: string, params: any): Promise<object> {
        switch (command) {
            case 'hello':
                return { ip: client.clientIp };

            // Temporary commands to make the debug page somewhat work.
            case 'environment-room-list':
                return { rooms: [ ...this.environment.getRoomNames() ].sort() };

            case 'environment-service-list':
                return { services: [ ...this.environment.getRoomServices(params.room) ] };

            default:
                this.logger.warn(`Unrecognised command from ${client.clientIp}: ${command}...`);
                break;
        }

        return {};
    }

    // ---------------------------------------------------------------------------------------------
    // ServiceDelegate interface:
    // ---------------------------------------------------------------------------------------------

    // ...
}
