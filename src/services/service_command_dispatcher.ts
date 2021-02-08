// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Service, ServiceCommand } from './service';

// Meta information stored by the command dispatcher. Limited to the textual service identifier.
type ServiceCommandMeta = { service: string; };

// Responsible for dispatching commands to services which have indicated to support them. A series
// of meta commands are available to be able to understand the supported commands and their syntax.
export class ServiceCommandDispatcher {
    private commands: Map<string, ServiceCommand & ServiceCommandMeta> = new Map();

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

    // Registers the commands supported by the given |service| with the dispatcher. The data will be
    // cached locally, and will thus not be requested again.
    registerServiceCommands(service: Service) {
        for (const command of service.getCommands()) {
            this.commands.set(command.command, {
                service: service.getIdentifier(),
                ...command,
            });
        }
    }
}
