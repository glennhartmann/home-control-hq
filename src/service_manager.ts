// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Database } from './base/database';
import { Environment } from './environment';
import { Logger } from './base/logger';
import { Service, ServiceCommand } from './service';

// Meta information stored by the command dispatcher. Limited to the textual service identifier.
type ServiceCommandMeta = { service: string; };

// Manager for the services that exist within the home control system. While the functionality will
// be provided by NPM packages, the manager serves as a registry and mediator.
export class ServiceManager {
    private database: Database;
    private logger: Logger;

    private commands: Map<string, ServiceCommand & ServiceCommandMeta> = new Map();
    private services: Map<string, Service>;

    constructor(database: Database, logger: Logger) {
        this.database = database;
        this.logger = logger;

        // TODO: Register internal commands in |this.commands|.
        this.services = new Map();
    }

    // Adds the given |service| to the manager. It will be initialized immediately after being added
    // which could take an arbitrary amount of time, and might require human intervention.
    async addService(service: Service) {
        const identifier = service.getIdentifier();

        if (!await service.initialize()) {
            this.logger.warn(`Unable to initialize ${identifier}, skipping...`);
            return;
        }

        this.services.set(identifier, service);

        for (const command of service.getCommands()) {
            this.commands.set(command.command, {
                service: service.getIdentifier(),
                ...command,
            });
        }
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

    // Dispatches the given |command| with the given |parameters|, if they correctly correspond to
    // one of the service commands registered with this dispatcher. Exceptions will be thrown in
    // case of syntax validation errors, which we are strict about.
    async dispatchCommand(command: string, parameters: any): Promise<object | null> {
        const serviceCommand = this.commands.get(command);
        if (!serviceCommand)
            return null;

        const parameterArray: Array<any> = [];
        for (const description of serviceCommand.parameters) {
            if (!parameters.hasOwnProperty(description.name)) {
                if (!parameters.optional)
                    throw new Error(`Missing parameter for "${command}": ${description.name}`);

                break;
            }

            const value = parameters[description.name];
            switch (description.type) {
                case 'boolean':
                case 'number':
                case 'string':
                    if (typeof value !== description.type) {
                        throw new Error(
                            `Expected "${description.name}" to be given as a ${description.type},` +
                            ` but got a ${typeof value} instead.`);
                    }

                    parameterArray.push(value);
                    break;

                default:
                    throw new Error(`Invalid parameter type defined for "${command}"...`);
            }
        }

        return await serviceCommand.handler(...parameterArray);
    }
}
