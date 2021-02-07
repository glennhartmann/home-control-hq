// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { v3 as hue } from 'node-hue-api';
import Api from 'node-hue-api/lib/api/Api';

import { Database } from '../../base/database';
import { Logger } from '../../base/logger';

// Identifiers that will be shared with the Philips Hue hub.
const kIdentifierApp = 'home-control-hq';
const kIdentifierDevice = 'home-control-hq-server';

// Maximum number of milliseconds to wait when discovering the Philips Hue bridge.
const kDiscoveryTimeoutMs = 20000;

// Number of milliseconds to wait for the user to click on the Link button.
const kLinkTimeoutMs = 10000;

// Identifiers used for the persistent storage keys in the StorageManager.
const kStorageKeyClientKey = 'philips-hue-client-key';
const kStorageKeyUser = 'philips-hue-user';

// Encapsulates the connection with the Philips Hue bridge, over which commands can be communicated
// to either learn about the available lights, or make changes to the lights.
export class Connection {
    private connection?: Api;
    private database: Database;
    private logger: Logger;

    constructor(database: Database, logger: Logger) {
        this.database = database;
        this.logger = logger;
    }

    // Initializes the connection with the Philips Hue bridge. Bridges will be discovered using UPNP
    // after which a connection will be attempted. Currently we only support a single bridge.
    async initialize(): Promise<boolean> {
        const bridge = await this.discoverBridge();
        if (!bridge) {
            this.logger.error('Unable to discover the Philips Hue bridge on the local network.');
            return false;
        }

        // When prior credentials are known, attempt to reestablish the connection.
        if (this.database.has(kStorageKeyUser)) {
            const username = this.database.get(kStorageKeyUser);

            if (await this.establishConnection(bridge, username))
                return true;

            this.logger.warn('The stored Philips Hue bridge credentials have been rejected.');
        }

        // Alternatively, create a new user to obtain fresh credentials. Once this is done, the
        // connection has to be established in order to validate them.
        const user = await this.createUser(bridge);
        if (!user) {
            this.logger.error('Unable to create new credentials with the Philips Hue bridge.');
            return false;
        }

        if (!await this.establishConnection(bridge, user.username)) {
            this.logger.error('Unable to verify the new credentials with the Philips Hue bridge.');
            return false;
        }

        this.logger.info('The connection with the Philips Hue bridge has been established.');

        await this.database.set(kStorageKeyClientKey, user.clientKey);
        await this.database.set(kStorageKeyUser, user.username);

        return true;
    }

    // Discovers the Philips Hue bridge on the local network. Philips' nUPNP mechanism will be used
    // first, as it's significantly faster (~.5s vs. ~8s), but a fallback to UPNP is available too.
    async discoverBridge(): Promise<string | null> {
        const nupupResults = await hue.discovery.nupnpSearch();
        if (nupupResults.length >= 1)
            return nupupResults[0].ipaddress;

        const upnpResults = await hue.discovery.upnpSearch(kDiscoveryTimeoutMs);
        if (upnpResults.length >= 1)
            return upnpResults[0].ipaddress;

        return null;
    }

    // Establishes a connection with the bridge using the given |username|. Returns whether the
    // connection could be established, indicating that this object is ready for use.
    async establishConnection(bridge: string, username: string): Promise<boolean> {
        try {
            this.connection = await hue.api.createLocal(bridge).connect(username);
            return true;

        } catch (exception) {
            this.logger.debug('Unable to connect with the Philips Hue bridge:', exception);
        }

        return false;
    }

    // Creates a new user on the given |bridge|. This requires manual intervention by the user, as
    // the physical Link button on the bridge has to be pressed.
    async createUser(bridge: string): Promise<{ clientKey: string, username: string } | null> {
        const unauthenticatedApi = await hue.api.createLocal(bridge).connect();
        for (let attempt = 1; attempt <= 5; ++attempt) {
            this.logger.action(
                `Please press the Philips Hue bridge's Link button (attempt ${attempt}/5)...`);

            await new Promise(resolve => setTimeout(resolve, kLinkTimeoutMs));
            try {
                return await unauthenticatedApi.users.createUser(kIdentifierApp, kIdentifierDevice);
            } catch {
                // Nobody pressed the button. No point in displaying the exception.
            }
        }

        return null;
    }
}
