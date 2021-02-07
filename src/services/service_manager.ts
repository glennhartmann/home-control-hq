// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Database } from '../base/database';
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

    // Adds the given |service| to the manager. It will be initialized immediately after being added
    // which could take an arbitrary amount of time, and might require human intervention.
    async addService(service: Service) {
        // TODO: Implement this.
    }
}
