// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Database } from '../base/database';
import { Environment } from '../environment/environment';
import { Logger } from '../base/logger';
import { Service } from './service';

// The delegate that defines how services can interact with the server.
export interface ServiceDelegate {

}

// Manager for the services that exist within the home control system. While the functionality will
// be provided by NPM packages, the manager serves as a registry and mediator.
export class ServiceManager {
    private delegate: ServiceDelegate;

    private database: Database;
    private logger: Logger;
    private services: Map<string, Service>;

    constructor(delegate: ServiceDelegate, database: Database, logger: Logger) {
        this.delegate = delegate;

        this.database = database;
        this.logger = logger;
        this.services = new Map();
    }

    // TODO: Remove this once a Client can connect to one or more services.
    getService(name: string) { return this.services.get(name); }

    // Adds the given |service| to the manager. It will be initialized immediately after being added
    // which could take an arbitrary amount of time, and might require human intervention.
    async addService(service: Service) {
        const identifier = service.getIdentifier();

        if (!await service.initialize()) {
            this.logger.warn(`Unable to initialize ${identifier}, skipping...`);
            return;
        }

        this.services.set(identifier, service);
    }

    // Validates the given |environment| against the known information of the service manager.
    // Issues generally are considered fatal, refusing the environment to be loaded.
    async validateEnvironment(environment: Environment): Promise<boolean> {
        for (const [ room, services ] of environment.getRooms()) {
            for (const { service, options } of services) {
                const instance = this.services.get(service);
                if (!instance) {
                    this.logger.error(`Unknown service in room "${room}": ${service}`);
                    return false;
                }

                // The `validate` call is expected to raise an error message when one happens.
                if (!await instance.validate(options))
                    return false;
            }
        }

        return true;
    }
}
