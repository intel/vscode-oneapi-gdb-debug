/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */

import { PathLike, PathOrFileDescriptor, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { LoggerAggregator as logger } from "./Logger";

/**
 * Checks if the given `path` exists.
 * @param path Path to look for.
 * @returns Returns `true` if the path exists, `false` otherwise.
 */
export function FileExistsSync(path: PathLike): boolean {
    logger.Info(`Check if given path '${path}' exists`);
    const exists = existsSync(path);

    logger.Info(`Path '${path}'${exists ? "" : " does not"} exists`);
    return exists;
}

/**
 * Writes given `data` to the `file`.
 * @param file Path to the file.
 * @param data Data to write to the given `file`.
 */
export function WriteFileSync(file: PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView): void {
    logger.Info(`Write '${file}' file`);
    writeFileSync(file, data);
    logger.Info(`File '${file}' has been written`);
}

/**
 * Synchronously reads the entire contents of a file.
 * @param path A path to a file.
 * @param encoding File encoding.
 * @returns File contents as `string`.
 */
export function ReadFileSync(path: PathOrFileDescriptor, encoding: BufferEncoding): string {
    logger.Info(`Read '${path}' file`);
    const file = readFileSync(path, encoding);

    logger.Info(`File '${path}' has been read`);
    return file;
}

/**
 * 
 * @param path A path to a file. If a URL is provided, it must use the file: protocol.
 */
export function MkdirSync(path: PathLike): void {
    logger.Info(`Create '${path}' directory`);
    mkdirSync(path);
    logger.Info(`Directory '${path}' has been created`);
}

/**
 * Loads and parses given JSON file.
 */
export function LoadAndParseJsonFile<T>(path: PathOrFileDescriptor): T {
    logger.Info(`Load '${path}' file`);
    const file = JSON.parse(ReadFileSync(path, "utf-8")) as T;

    return file;
}