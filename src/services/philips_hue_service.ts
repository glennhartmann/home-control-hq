// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Connection } from './philips_hue/connection';
import { Interface } from './philips_hue/interface';
import { Server } from '../server';
import { Service, ServiceBroadcaster, ServiceCommand, ServiceRoutine } from '../service';

// Implements the Philips Hue service, which provides the ability to interact with Philips Hue and
// thus the ability to control lights and scenes in a house.
export class PhilipsHueService implements Service {
    private broadcast?: ServiceBroadcaster;
    private connection: Connection;
    private interface: Interface;

    constructor(server: Server) {
        this.connection = new Connection(server.database, server.logger);
        this.interface = new Interface(this.connection, server.database, server.logger);
    }

    // Returns the identifier that is unique to this service.
    getIdentifier(): string { return 'Philips Hue'; }

    // Returns an array of the commands supported by the Philips Hue service. Routing and validation
    // will be done centrally by the command dispatcher.
    getCommands(): Array<ServiceCommand> {
        return [
            {
                command: 'philips-hue-power',
                description: 'Toggle power to the lights in a Philips Hue light group',
                handler: PhilipsHueService.prototype.handlePowerCommand.bind(this),
                parameters: [
                    { name: 'group', type: 'string' },
                    { name: 'on', type: 'boolean' },
                ]
            },
            {
                command: 'philips-hue-brightness',
                description: 'Change the brightness of a Philips Hue light group (0-100%)',
                handler: PhilipsHueService.prototype.handleBrightnessCommand.bind(this),
                parameters: [
                    { name: 'group', type: 'string' },
                    { name: 'brightness', type: 'number' },
                ]
            },
            {
                command: 'philips-hue-colour',
                description: 'Change the colour of a Philips Hue light group (RRGGBB)',
                handler: PhilipsHueService.prototype.handleColourCommand.bind(this),
                parameters: [
                    { name: 'group', type: 'string' },
                    { name: 'colour', type: 'string' },
                ]
            },
            {
                command: 'philips-hue-scene',
                description: 'Change the scene applied to a Philips Hue light group',
                handler: PhilipsHueService.prototype.handleSceneCommand.bind(this),
                parameters: [
                    { name: 'group', type: 'string' },
                    { name: 'scene', type: 'string' },
                ]
            },
            {
                command: 'philips-hue-state',
                description: 'Retrieve the state of Philips Hue lights in a given group',
                handler: PhilipsHueService.prototype.handleStateCommand.bind(this),
                parameters: [
                    { name: 'group', type: 'string' },
                ],

                // Controllers who request state for a particular group will receive updates for
                // that same group for the lifetime of the controller connection.
                subscribe: true,
            },
        ];
    }

    // Returns an array of routines that Philips Hue depends on. We periodically update status with
    // the Philips Hue bridge, which does not allow us to subscribe to events.
    getRoutines(): Array<ServiceRoutine> {
        return [
            {
                callbackFn: PhilipsHueService.prototype.updateState.bind(this),
                description: 'Synchronize state with the Philips Hue bridge',
                intervalSeconds: /* five minutes= */ 60,
            }
        ];
    }

    // Initializes the Philips Hue service. This means that we ensure that a connection with the
    // Philips Hue Hub can be established, and initial light configuration can be retrieved.
    async initialize(broadcast: ServiceBroadcaster): Promise<boolean> {
        this.broadcast = broadcast;

        if (!await this.connection.initialize())
            return false;

        await this.interface.synchronize();

        return true;
    }

    // Validates whether the given |options| are valid for use with the Philips Hue service.
    async validate(options: object): Promise<boolean> {
        // TODO: This should be more like "connect", so that the appropriate service -> display
        // signals can be propagated as well.
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // Service command handlers
    // ---------------------------------------------------------------------------------------------

    // Change the brightness of a Philips Hue light group.
    async handleBrightnessCommand(group: string, brightness: number): Promise<object> {
        await this.interface.update(group, {
            brightness,
        });

        return { /* no data */ };
    }

    // Change the colour of a Philips Hue light group.
    async handleColourCommand(group: string, colour: string): Promise<object> {
        if (!/^[0-9A-F]{6}$/i.test(colour))
            throw new Error(`Colour should be specified as RRGGBB in hexadecimal format.`);

        const r = parseInt(colour.substring(0, 2), 16);
        const g = parseInt(colour.substring(2, 4), 16);
        const b = parseInt(colour.substring(4, 6), 16);

        await this.interface.update(group, {
            colour: [ r, g, b ]
        });

        return { /* no data */ };
    }

    // Toggle power to the lights in a Philips Hue light group.
    async handlePowerCommand(group: string, on: boolean): Promise<object> {
        await this.interface.update(group, {
            on
        });

        return { /* no data */ };
    }

    // Change the scene applied to a Philips Hue light group.
    async handleSceneCommand(group: string, scene: string): Promise<object> {
        await this.interface.update(group, {
            scene
        });

        return { /* no data */ };
    }

    // Retrieve the state of Philips Hue lights in a given group. Note that any client that invokes
    // this command will automatically get subscribed to state updates for the given |group|.
    async handleStateCommand(group: string): Promise<object> {
        return {
            state: this.interface.composeState(group),
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Routines
    // ---------------------------------------------------------------------------------------------

    // Synchronizes state with the Philips Hue bridge. This will be called periodically, and changes
    // will be issued to subscribed home control displays through a broadcast.
    async updateState(): Promise<boolean> {
        const updates = await this.interface.synchronize();

        for (const [ group, state ] of updates)
            this.broadcast?.distribute('philips-hue-state', [ group ], { group, state });

        return true;
    }
}
