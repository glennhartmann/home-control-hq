// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { promises as fs } from 'fs';

import { Logger } from '../base/logger';

// Dictionary definition for the immutable description of a service.
interface EnvironmentService {
    // Label of the service, potentially displayed in the user interface.
    label: string;

    // Identifier of the service that is being described.
    service: string;

    // Object with any settings or contents describing interaction with the service.
    options: object;
}

// Dictionary definition for the immutable description of a room.
type EnvironmentRoom = Record<string, Array<EnvironmentService>>;

// Represents the environment (i.e. rooms) that the server controls. Initialized from a static
// configuration file, and immutable thereafter.
export class Environment {
    // Returns an empty environment that contains no configuration of any sort.
    static empty() { return new Environment(/* configuration= */ {}); }

    // Initializes the environment configuration based on the given |filename|. Errors will result
    // in a log message being shown and NULL being returned.
    static async fromFile(logger: Logger, filename: string) {
        let instance: Environment | null = null;

        try {
            const text = await fs.readFile(filename, 'utf8');
            const configuration = JSON.parse(text);

            instance = new Environment(configuration);

        } catch (exception) {
            logger.error('Unable to load environment configuration:', exception);
        }

        return instance;
    }

    // Array of the rooms & services therein described in the configuration.
    private rooms: EnvironmentRoom = {};

    private constructor(configuration: object) {
        if (typeof configuration !== 'object')
            throw new Error(`Expected the configuration to be an object keyed by room names.`);

        for (const [ roomName, roomServices ] of Object.entries(configuration)) {
            const services: Array<EnvironmentService> = [];

            if (!Array.isArray(roomServices))
                throw new Error(`Invalid configuration specified for room "${roomName}".`);

            for (const serviceConfiguration of roomServices) {
                if (typeof serviceConfiguration !== 'object')
                    throw new Error(`Configuration for room "${roomName}" must be an object.`);

                if (typeof serviceConfiguration.label !== 'string')
                    throw new Error(`Textual "label" must be given for room "${roomName}".`);

                if (typeof serviceConfiguration.service !== 'string')
                    throw new Error(`Textual "service" must be given in room "${roomName}".`);

                services.push({
                    label: serviceConfiguration.label,
                    service: serviceConfiguration.service,
                    options: serviceConfiguration.options || {},
                });
            }

            this.rooms[roomName] = services;
        }
    }

    getRooms() { return Object.entries(this.rooms); }
    getRoomNames() { return Object.keys(this.rooms); }
    getRoomServices(name: string) { return this.rooms[name]; }
}
