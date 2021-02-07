// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Connection } from './philips_hue/connection';
import { LightUpdate } from './philips_hue/light_group';
import { Manager } from './philips_hue/manager';
import { Server } from '../server';
import { Service } from './service';

// Implements the Philips Hue service, which provides the ability to interact with Philips Hue and
// thus the ability to control lights and scenes in a house.
export class PhilipsHueService implements Service {
    private connection: Connection;
    private manager: Manager;

    constructor(server: Server) {
        this.connection = new Connection(server.database, server.logger);
        this.manager = new Manager(this.connection, server.logger);
    }

    // Returns the identifier that is unique to this service.
    getIdentifier() { return 'Philips Hue'; }

    // Initializes the Philips Hue service. This means that we ensure that a connection with the
    // Philips Hue Hub can be established, and initial light configuration can be retrieved.
    async initialize(): Promise<boolean> {
        if (!await this.connection.initialize())
            return false;

        await this.manager.update();

        return true;
    }

    // Validates whether the given |options| are valid for use with the Philips Hue service.
    async validate(options: object): Promise<boolean> {
        // TODO: This should be more like "connect", so that the appropriate service -> display
        // signals can be propagated as well.
        return true;
    }

    // Called when the given |command| has been issued for a Philips Hue service.
    async issueCommand(command: string, params: any) {
        const group = this.manager.getGroup(params.options.room);
        if (!group)
            return;

        let update: LightUpdate | undefined;
        switch (command) {
            case 'philips-hue-on':
                update = { on: true };
                break;
            case 'philips-hue-off':
                update = { on: false };
                break;
            case 'philips-hue-brightness':
                update = { on: true, brightness: params.brightness };
                break;
        }

        if (update)
            group.update(this.connection, update);
    }
}
