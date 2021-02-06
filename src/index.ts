// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import path from 'path';

import { Logger } from './base/logger';
import { Network, NetworkDelegate } from './network/network';

class Runtime implements NetworkDelegate {
    private logger: Logger;
    private network: Network;

    constructor() {
        this.logger = new Logger();
        this.network = new Network(this, this.logger, {
            http: {
                hostname: '0.0.0.0',
                port: 8001,
                public: path.resolve(__dirname, '..', 'public'),
            },
            ws: {}
        });

        this.network.listen();
    }
}

const runtime = new Runtime();
