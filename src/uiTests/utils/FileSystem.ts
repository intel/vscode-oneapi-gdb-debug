/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { existsSync, mkdirSync, PathLike, PathOrFileDescriptor, readFileSync, rmSync, writeFileSync } from "fs";
import { LoggerAggregator as logger } from "./Logger";
import { FsOptions } from "./Types";
import { NodeSSH } from "node-ssh";

export abstract class FileSystem {
    private static sshClient: NodeSSH | undefined;

    public static Init(sshClient: NodeSSH) {
        if (!FileSystem.sshClient) {
            FileSystem.sshClient = sshClient;
        }
    }

    /**
     * Checks if the given `path` exists.
     * @param path Path to look for.
     * @returns Returns `true` if the path exists, `false` otherwise.
     */
    static async FileExistsAsync(path: PathLike, options: FsOptions): Promise<boolean> {
        logger.Info(`Check if given path '${path}' exists`);
        return await FileSystem.Exec(async ssh => {
            const response = await ssh.execCommand(`test -f ${path}`);

            return response.code === 0;
        }, async() => {
            return existsSync(path);
        }, options);
    }

    /**
     * Writes given `data` to the `file`.
     * @param file Path to the file.
     * @param data Data to write to the given `file`.
     */
    static async WriteFileAsync(file: PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView, options: FsOptions): Promise<void> {
        logger.Info(`Write '${file}' file`);
        await FileSystem.Exec(async ssh => {
            await ssh.execCommand(`echo \'${data}\' > ${file}`);
        }, async() => {
            writeFileSync(file, data);
        }, options);
        logger.Info(`File '${file}' has been written`);
    }

    /**
     * Synchronously reads the entire contents of a file.
     * @param path A path to a file.
     * @param encoding File encoding.
     * @returns File contents as `string`.
     */
    static async ReadFileAsync(path: PathOrFileDescriptor, encoding: BufferEncoding, options: FsOptions): Promise<string> {
        logger.Info(`Read '${path}' file`);
        return await FileSystem.Exec(async ssh => {
            const response = await ssh.execCommand(`cat ${path}`, {
                onStdout: buffer => buffer.toString(encoding)
            });

            return response.stdout;
        }, async() => {
            const file = readFileSync(path, encoding);

            return file;
        }, options);
    }

    /**
     * 
     * @param path A path to a file. If a URL is provided, it must use the file: protocol.
     */
    static async MkdirAsync(path: PathLike, options: FsOptions): Promise<void> {
        logger.Info(`Create '${path}' directory`);
        await FileSystem.Exec(async(ssh) => {
            await ssh.execCommand(`mkdir ${path}`);
        }, async() => {
            mkdirSync(path);
        }, options);
        logger.Info(`Directory '${path}' has been created`);
    }

    /**
     * Loads and parses given JSON file.
     */
    static async LoadAndParseJsonFile<T>(path: PathOrFileDescriptor, options: FsOptions): Promise<T> {
        logger.Info(`Load '${path}' file`);
        const file = await FileSystem.ReadFileAsync(path, "utf-8", options);

        return JSON.parse(file) as T;
    }

    /**
     * Removes file or dir at given path.
     * @param path Path to a file or dir to remove.
     */
    static async RmAsync(path: string, options: FsOptions): Promise<void> {
        logger.Info(`Remove '${path}' directory`);
        await FileSystem.Exec(async(ssh) => {
            await ssh.execCommand(`rm -rf ${path}`);
        }, async() => {
            rmSync(path, { recursive: true, force: true });
        }, options);
        logger.Info(`Directory '${path}' has been removed`);
    }

    private static async Exec<T>(remote: (client: NodeSSH) => Promise<T>, local: () => Promise<T>, options: FsOptions): Promise<T> {
        if (options?.remotePath) {
            if (!FileSystem.sshClient) { throw new Error("remotePath was set to true but sshClient is undefined!"); }
            return await remote(FileSystem.sshClient);
        } else {
            return await local();
        }
    }
}