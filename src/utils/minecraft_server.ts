import { Rcon } from "rcon-client";
import { exec } from "child_process";
import { promisify } from "util";
import logger from "./logging";
import { RconManager } from "./rcon_manager";
import { getErrorMessage, roundTo } from "./utils";
const execAsync = promisify(exec);


export class MinecraftServer {
    private static servers: Array<MinecraftServer> = new Array();

    // Config variables
    serverName: string;
    startServerExecutable: string;
    emptyServerCheckIntervalMillis: number;
    emptyServerDurationUntilShutdownMillis: number;
    discordServerIds: Array<string>;
    discordMemberIds: Array<string>;

    // Util variables (for public use)
    isStarting: boolean = false;
    // Util variables (for class itself)
    private intervalId: any | null = null;
    private rconManager: RconManager;


    constructor(serverName: string, startServerExecutable: string, emptyServerCheckIntervalMillis: number, emptyServerDurationUntilShutdownMillis: number, rconHost: string, rconPort: number, rconPassword: string, rconTimeoutMs: number, discordServerIds: Array<string>, discordMemberIds: Array<string>) {
        this.serverName = serverName;
        this.startServerExecutable = startServerExecutable;
        this.emptyServerCheckIntervalMillis = emptyServerCheckIntervalMillis;
        this.emptyServerDurationUntilShutdownMillis = emptyServerDurationUntilShutdownMillis;
        this.discordServerIds = discordServerIds;
        this.discordMemberIds = discordMemberIds;

        this.rconManager = new RconManager(rconHost, rconPort, rconPassword, rconTimeoutMs);

        MinecraftServer.servers.push(this);
    }

    static getServers(): Array<MinecraftServer> {
        return MinecraftServer.servers;
    }


    async startServer(): Promise<void> {
        if (await this.isServerOnline()) {
            throw new Error("Server already running");
        }

        try {
            const { stdout, stderr } = await execAsync(this.startServerExecutable);
            if (stdout) {
                logger.info(`${this.serverName} started with stdout: ${stdout}`);
            }
            if (stderr) {
                logger.warn(`${this.serverName} started with stderr: ${stderr}`);
            }
        } catch (error) {
            logger.error(`Starting ${this.serverName} threw an error: ${getErrorMessage(error)}`);
            throw error;
        }

        logger.info(`Server start process for ${this.serverName} has been executed`);
    }


    async stopServer(): Promise<void> {
        if (!(await this.isServerOnline())) {
            logger.warn(`Not stopping server ${this.serverName} because it's not online`)
            return;
        }
        await this.rconManager.withRcon(async (rcon: Rcon) => {
            logger.info(`Stopping server ${this.serverName}`);
            await rcon.send("stop");
        });
    }


    async waitForServerEmpty(callback: () => Promise<void>): Promise<void> {
        logger.info(`Starting server empty listener for ${this.serverName} with ${roundTo(this.emptyServerDurationUntilShutdownMillis / 60000, 2)} minutes`);
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        let counterMillis = 0;
        let isRunning = false;
        this.intervalId = setInterval(async () => {
            if (isRunning) return;
            isRunning = true;
            try {
                logger.trace(`Checking ${this.serverName} for empty server`);
                // End interval checks
                if (!(await this.isServerOnline())) {
                    logger.warn(`${this.serverName} is unexpectedly not online anymore, stopping wait for server empty job`);
                    clearInterval(this.intervalId);
                    this.intervalId = null;
                    return;
                }
                // End interval checks and stop server
                if (counterMillis >= this.emptyServerDurationUntilShutdownMillis) {
                    logger.info(`Nobody was online for ${roundTo(this.emptyServerDurationUntilShutdownMillis / 60000, 2)} minutes, stopping server ${this.serverName}`);
                    await this.stopServer();
                    await callback();
                    clearInterval(this.intervalId);
                    this.intervalId = null;
                    return;
                }
                // Reset interval counter
                if (await this.isAnyPlayerOnline()) {
                    logger.trace(`${this.serverName} has online players`);
                    counterMillis = 0;
                    return;
                }
                // Increment interval counter
                counterMillis += this.emptyServerCheckIntervalMillis;
                logger.trace(`${this.serverName} has no online players, reached ${roundTo(counterMillis / 60000, 2)}/${roundTo(this.emptyServerDurationUntilShutdownMillis / 60000, 2)} minutes`);
            } finally {
                isRunning = false;
            }
        }, this.emptyServerCheckIntervalMillis);
    }


    async isServerOnline(): Promise<boolean> {
        if (!this.rconManager.getIsConnected()) {
            const connected = await this.rconManager.connect();
            if (!connected) {
                return false;
            }
        }
        try {
            await this.rconManager.withRcon(async (rcon: Rcon) => await rcon.send("list"));
            return true;
        } catch (error) {
            return false;
        }
    }


    async isAnyPlayerOnline(): Promise<boolean> {
        if (!(await this.isServerOnline())) {
            return false;
        }

        return this.rconManager.withRcon(async (rcon: Rcon) => {
            const listOutput: string = (await rcon.send("list")).trim();
            if (!listOutput.includes(":")) {
                logger.error(`${this.serverName} list output does not contain ':'`);
                logger.error(listOutput);
                return false;
            }
            return listOutput.split(":")[1].length != 0
        });
    }
}
