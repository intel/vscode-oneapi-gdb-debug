/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { readdirSync } from "fs";
import { join } from "path";

const tests: (()=>void)[] = [];

readdirSync(__dirname)
    .filter(file => file !== "index.js")
    .forEach(file => {
        const fullName = join(__dirname, file);

        if (file.toLowerCase().endsWith(".js")) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            tests.push(require(fullName).default);
        }
    });
export { tests };