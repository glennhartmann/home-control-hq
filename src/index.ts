// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import path from 'path';

import { Server } from './server';

// Directory from which the smart home frontend should be served.
const kPublicDirectory = path.resolve(__dirname, '..', 'public');

// Initialize the actual server environment. Initialization will finish by listening to incoming
// HTTP and WebSocket connections, which will keep the system operational indefinitely.
new Server({
    debug: true,
    network: {
        http: { hostname: '0.0.0.0', port: 8001, public: kPublicDirectory },
        ws: { }
    }

}).initialize();
