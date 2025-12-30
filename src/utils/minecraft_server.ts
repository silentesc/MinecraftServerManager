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
                logger.info(`[${this.serverName}] started with stdout: ${stdout}`);
            }
            if (stderr) {
                logger.warn(`[${this.serverName}] started with stderr: ${stderr}`);
            }
        } catch (error) {
            logger.error(`[${this.serverName}] Starting threw an error: ${getErrorMessage(error)}`);
            throw error;
        }

        logger.info(`[${this.serverName}] Server start process has been executed`);
    }


    async stopServer(): Promise<void> {
        if (!(await this.isServerOnline())) {
            logger.warn(`[${this.serverName}] Not stopping server because it's not online`)
            return;
        }
        await this.rconManager.withRcon(async (rcon: Rcon) => {
            logger.info(`[${this.serverName}] Stopping server`);
            await rcon.send("stop");
        });
    }


    async waitForServerEmpty(callback: () => Promise<void>): Promise<void> {
        logger.info(`[${this.serverName}] Starting server empty listener with ${roundTo(this.emptyServerDurationUntilShutdownMillis / 60000, 2)} minutes`);
        if (this.intervalId) {
            logger.warn(`[${this.serverName}] Another server empty listener already running. Clearing old one and using this new one instead.`)
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        let counterMillis = 0;
        let isRunning = false;
        this.intervalId = setInterval(async () => {
            if (isRunning) return;
            isRunning = true;
            try {
                logger.trace(`[${this.serverName}] Checking for empty server`);
                // End interval checks
                if (!(await this.isServerOnline())) {
                    logger.warn(`[${this.serverName}] Unexpectedly not online anymore, stopping wait for server empty job`);
                    clearInterval(this.intervalId);
                    this.intervalId = null;
                    return;
                }
                // End interval checks and stop server
                if (counterMillis >= this.emptyServerDurationUntilShutdownMillis) {
                    logger.info(`[${this.serverName}] Nobody was online for ${roundTo(this.emptyServerDurationUntilShutdownMillis / 60000, 2)} minutes, stopping...`);
                    await this.stopServer();
                    await callback();
                    clearInterval(this.intervalId);
                    this.intervalId = null;
                    return;
                }
                // Reset interval counter
                if (await this.isAnyPlayerOnline()) {
                    logger.trace(`[${this.serverName}] Has online players`);
                    counterMillis = 0;
                    return;
                }
                // Increment interval counter
                counterMillis += this.emptyServerCheckIntervalMillis;
                logger.trace(`[${this.serverName}] Has no online players, reached ${roundTo(counterMillis / 60000, 2)}/${roundTo(this.emptyServerDurationUntilShutdownMillis / 60000, 2)} minutes`);
            } finally {
                isRunning = false;
            }
        }, this.emptyServerCheckIntervalMillis);
    }


    async isServerOnline(retrySleepSecs: number = 10, maxRetries: number = 6): Promise<boolean> {
        if (!this.rconManager.getIsAuthenticated()) {
            const connected = await this.rconManager.connect(retrySleepSecs, maxRetries);
            if (!connected) {
                return false;
            }
        }
        try {
            await this.rconManager.withRcon(async (rcon: Rcon) => await rcon.send("list"), retrySleepSecs, maxRetries);
            return true;
        } catch (error) {
            return false;
        }
    }


    async isAnyPlayerOnline(retrySleepSecs: number = 10, maxRetries: number = 6): Promise<boolean> {
        if (!(await this.isServerOnline(retrySleepSecs, maxRetries))) {
            return false;
        }

        return this.rconManager.withRcon(async (rcon: Rcon) => {
            const listOutput: string = (await rcon.send("list")).trim();
            if (!listOutput.includes(":")) {
                logger.error(`[${this.serverName}] list output does not contain ':'`);
                logger.error(listOutput);
                return false;
            }
            return listOutput.split(":")[1].length != 0
        }, retrySleepSecs, maxRetries);
    }
}
