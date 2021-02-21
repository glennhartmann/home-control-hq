// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import '../elements/hq_header.js';

// Provides and manages the user interface for the Home Control HQ system. Configuration is obtained
// from the server, and then represented through a series of custom elements.
export class ControlInterface {
    #container;

    #header;

    constructor({ container }) {
        this.#container = container;

        this.#header = this.createHeaderElement();
        this.#container.appendChild(this.#header);
    }

    // ---------------------------------------------------------------------------------------------
    // Helper functions for creating the individual elements part of the interface.
    // ---------------------------------------------------------------------------------------------

    createHeaderElement() {
        const element = document.createElement('hq-header');

        // TODO: Inherit configuration from the server
        element.setAttribute('clock', '23:48');
        element.setAttribute('refresh', '');
        element.setAttribute('temperature', 21);

        return element;
    }
}
