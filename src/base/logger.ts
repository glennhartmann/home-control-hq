// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import colors from 'colors/safe';

// Type definition for one of the colour transformation functions in `colors`.
type ColourFunction = (message: string) => string;

// Interface that enables the system to output messages to the console. Messages of different
// severities will be displayed in different colours to reflect that.
export class Logger {
    private debugEnabled: boolean;

    constructor(debugEnabled?: boolean) {
        this.debugEnabled = !!debugEnabled;
    }

    // Outputs the given |message| as something that requires manual intervention.
    action(message: string, ...optionalParams: any[]) {
        this.output(message, colors.green, optionalParams);
    }

    // Outputs the given |message| as a debug message to the console.
    debug(message: string, ...optionalParams: any[]) {
        if (this.debugEnabled)
            this.output(message, colors.grey, optionalParams);
    }

    // Outputs the given |message| as an error message to the console.
    error(message: string, ...optionalParams: any[]) {
        this.output(message, colors.red, optionalParams);
    }

    // Outputs the given |message| as an informational message to the console.
    info(message: string, ...optionalParams: any[]) {
        this.output(message, colors.white, optionalParams);
    }

    // Outputs the given |message| as a warning message to the console.
    warn(message: string, ...optionalParams: any[]) {
        this.output(message, colors.yellow, optionalParams);
    }

    // ---------------------------------------------------------------------------------------------

    // Actually outputs the given |message| to the console.
    private output(message: string, colourFn: ColourFunction, optionalParams: any[]) {
        const time = (new Date).toLocaleTimeString('en-US', { hour12: false });

        console.log(`[${time}] ${colourFn(message)}`, ...optionalParams);
    }
}
