// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import path from 'path';

import { PhilipsHueService } from './services/philips_hue_service';
import { Server } from './server';

// JSON file in which the server's configuration is stored.
const kEnvironmentPath = path.resolve(__dirname, '..', 'home-configuration.json');

// Directory from which the smart home frontend should be served.
const kPublicDirectory = path.resolve(__dirname, '..', 'public');

// JSON file in which the server's state will be written.
const kStateDatabase = path.resolve(__dirname, '..', 'home-state.json');

// Initialize the actual server environment. Initialization will finish by listening to incoming
// HTTP and WebSocket connections, which will keep the system operational indefinitely.
const server = new Server({
    database: kStateDatabase,
    debug: true,

    environment: kEnvironmentPath,
    network: {
        http: { hostname: '0.0.0.0', port: 8001, public: kPublicDirectory },
        ws: { }
    },

});

server.initialize([
    new PhilipsHueService(server),
]);
