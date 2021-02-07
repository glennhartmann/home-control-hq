// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as ws from 'ws';

// Represents a client connected to the WebSocket control connection. Clients will generally
// identify with a particular room, which allows them to be considered by the full system.
export class Client {
    public readonly clientId: number;
    public readonly clientIp: string;

    private readonly webSocket: ws;

    constructor(clientId: number, clientIp: string, webSocket: ws) {
        this.clientId = clientId;
        this.clientIp = clientIp;

        this.webSocket = webSocket;
    }
}
