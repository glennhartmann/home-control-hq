// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Contains the signals that the Web content can send to the embedded browser, communicated through
// the document's title. No information will be relayed back about the signal's success.
export class Signal {
    // Launches the Settings app installed on the system.
    static launchSettings() {
        document.title = 'launch-settings';
    }

    // Restarts the entire browser process.
    static restartBrowser() {
        document.title = 'restart';
    }
}
