// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { default as equal } from 'deep-equal';

import { Environment } from './environment';
import { Logger } from './base/logger';
import { NetworkClient, NetworkClientObserver } from './network_client';
import { Service, ServiceBroadcaster, ServiceCommand, ServiceRoutine } from './service';

// Meta information stored by the command dispatcher. Limited to the textual service identifier.
type ServiceCommandMeta = { service: string; };

// Information retained for a command subscription, to power the server's targetted broadcasts.
interface SubscriptionInfo {
    // Set of clients who have subscribed for this particular broadcast.
    clients: Set<NetworkClient>;

    // Name of the command that the subscription is for.
    command: string;

    // Parameters that are key to targetted distribution of broadcasts.
    parameters: Array<any>;
}

// Maximum number of seconds at which service routines are able to execute.
const kMaximumIntervalSeconds = /* one day= */ 86400;

// Manager for the services that exist within the home control system. While the functionality will
// be provided by NPM packages, the manager serves as a registry and mediator.
export class ServiceManager implements ServiceBroadcaster, NetworkClientObserver {
    private logger: Logger;

    private commands: Map<string, ServiceCommand & ServiceCommandMeta> = new Map();
    private services: Map<string, Service>;
    private subscriptions: Array<SubscriptionInfo>;

    constructor(logger: Logger) {
        this.logger = logger;
        this.services = new Map();
        this.subscriptions = [];
    }

    // Adds the given |service| to the manager. It will be initialized immediately after being added
    // which could take an arbitrary amount of time, and might require human intervention.
    async addService(service: Service) {
        const identifier = service.getIdentifier();

        if (!await service.initialize(this)) {
            this.logger.warn(`Unable to initialize ${identifier}, skipping...`);
            return;
        }

        this.services.set(identifier, service);

        // Register each of the control connection commands supported by the service.
        for (const command of service.getCommands()) {
            this.commands.set(command.command, {
                service: service.getIdentifier(),
                ...command,
            });
        }

        // Activate each of the routines that are supported by the service.
        for (const routine of service.getRoutines()) {
            if (routine.intervalSeconds <= 0 || routine.intervalSeconds > kMaximumIntervalSeconds)
                throw new Error(`Routine with out-of-bounds interval specified for ${identifier}.`);

            setTimeout(
                ServiceManager.prototype.executeRoutine.bind(this, routine),
                routine.intervalSeconds * 1000);
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

    // ---------------------------------------------------------------------------------------------
    // Section: Commands
    // ---------------------------------------------------------------------------------------------

    // Dispatches the given |command| with the given |parameters|, if they correctly correspond to
    // one of the service commands registered with this dispatcher. Exceptions will be thrown in
    // case of syntax validation errors, which we are strict about.
    async dispatchCommand(client: NetworkClient, command: string, parameters: any):
            Promise<object | null> {
        const serviceCommand = this.commands.get(command);
        if (!serviceCommand) {
            return command === 'service-commands' ? this.handleServiceCommands(parameters.service)
                                                  : null;
        }

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

        const result = await serviceCommand.handler(...parameterArray);
        if (serviceCommand.subscribe) {
            let subscribed = false;

            // (1) If a subscription already exists, attempt to subscribe the |client| to it.
            for (const subscription of this.subscriptions) {
                if (subscription.command !== command)
                    continue;  // subscription is for a different command

                if (!equal(subscription.parameters, parameterArray))
                    continue;  // different parameters were given for the subscription

                if (subscription.clients.has(client))
                    return result;  // fast-path: the subscription already exists

                subscription.clients.add(client);
                subscribed = true;

                break;
            }

            // (2) Alternatively, create a new subscription for this command, and subscribe |client|
            if (!subscribed) {
                this.subscriptions.push({
                    clients: new Set([ client ]),
                    command: command,
                    parameters: parameterArray,
                });
            }

            // (3) Subscribe to disconnection events from the |client|.
            client.addObserver(this);

            // A new subscription was created, so announce this detail on the debugging logs.
            this.logger.debug(`${client} Subscribed to ${command} broadcasts.`);
        }

        return result;
    }

    // Enables introspection of the commands exposed by a service. Mainly used by the debugging page
    // to quickly and easily give full control over the entire server.
    async handleServiceCommands(service: string): Promise<object> {
        const commands = [];
        for (const command of this.commands.values()) {
            if (command.service !== service)
                continue;  // different service

            commands.push({
                command: command.command,
                description: command.description,
                parameters: command.parameters,
            });
        }

        return { commands };
    }

    // ---------------------------------------------------------------------------------------------
    // Section: Routines
    // ---------------------------------------------------------------------------------------------

    // Executes the given |routine| and schedules it to be executed again after the interval that
    // has been requested by the service. This will account for the function's execution time.
    async executeRoutine(routine: ServiceRoutine) {
        try {
            await routine.callbackFn();
        } catch (exception) {
            this.logger.error(`Exception when running routine: ${routine.description}`, exception);
        }

        setTimeout(
            ServiceManager.prototype.executeRoutine.bind(this, routine),
            routine.intervalSeconds * 1000);
    }

    // ---------------------------------------------------------------------------------------------
    // Section: Message Broadcasting
    // ---------------------------------------------------------------------------------------------

    // Distributes the given |message| to all clients that listen to the given |command| with the
    // given |parameters|, to enable targetted updates to relevant clients.
    async distribute(command: string, parameters: Array<any>, message: object): Promise<void> {
        const promii = [];

        for (const subscription of this.subscriptions) {
            if (subscription.command !== command)
                continue;  // distribution for a different command

            if (!equal(subscription.parameters, parameters))
                continue;  // distribution for a different parameter context

            for (const client of subscription.clients)
                promii.push(client.send({ command, ...message }));
        }

        await Promise.all(promii);
    }

    // Called when the |client| has disconnected from the network. They will cease to receive any
    // broadcasts for commands they have been subscribed to.
    onClientDisconnected(client: NetworkClient): void {
        for (const subscription of this.subscriptions)
            subscription.clients.delete(client);
    }
}
