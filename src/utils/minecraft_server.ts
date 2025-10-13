import { exec } from "child_process";
import { Rcon } from "rcon-client";


export class MinecraftServer {
    static servers: Array<MinecraftServer> = new Array();

    serverName: string;
    startServerExecutable: string;
    emptyServerCheckIntervalMillis: number;
    emptyServerDurationUntilShutdownMillis: number;
    rconHost: string;
    rconPort: number;
    rconPassword: string;
    rconTimeoutMs: number;
    discordServerIds: Array<string>;
    discordMemberIds: Array<string>;

    private intervalId: any | null = null;


    constructor(serverName: string, startServerExecutable: string, emptyServerCheckIntervalMillis: number, emptyServerDurationUntilShutdownMillis: number, rconHost: string, rconPort: number, rconPassword: string, rconTimeoutMs: number, discordServerIds: Array<string>, discordMemberIds: Array<string>) {
        this.serverName = serverName;
        this.startServerExecutable = startServerExecutable;
        this.emptyServerCheckIntervalMillis = emptyServerCheckIntervalMillis;
        this.emptyServerDurationUntilShutdownMillis = emptyServerDurationUntilShutdownMillis;
        this.rconHost = rconHost;
        this.rconPort = rconPort;
        this.rconPassword = rconPassword;
        this.rconTimeoutMs = rconTimeoutMs;
        this.discordServerIds = discordServerIds;
        this.discordMemberIds = discordMemberIds;
    }


    /**
     * @throws error
     */
    async startServer(): Promise<void> {
        if (await this.isServerOnline()) {
            throw Error("Server already running");
        }

        let done = false;
        exec(this.startServerExecutable, (error, stdout, stderr) => {
            if (error) {
                throw error;
            }
            else if (stderr) {
                throw new Error(stderr);
            }
            done = true;
        });

        const intervalId = setInterval(() => {
            if (done) {
                clearInterval(intervalId);
            }
        }, 500);
    }


    async stopServer(): Promise<void> {
        if (!(await this.isServerOnline())) {
            return;
        }
        this.withRcon(async (rcon: Rcon) => {
            await rcon.send("stop");
        });
    }


    async waitForServerEmpty(): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        let counterMillis = 0;
        this.intervalId = setInterval(async () => {
            // End interval checks
            if (!(await this.isServerOnline())) {
                clearInterval(this.intervalId);
                this.intervalId = null;
                return;
            }
            // End interval checks and stop server
            if (counterMillis >= this.emptyServerCheckIntervalMillis) {
                this.stopServer();
                clearInterval(this.intervalId);
                this.intervalId = null;
                return;
            }
            // Reset interval counter
            if (await this.isAnyPlayerOnline()) {
                clearInterval(this.intervalId);
                this.intervalId = null;
                counterMillis = 0;
            }
            // Increment interval counter
            counterMillis += this.emptyServerCheckIntervalMillis;
        }, this.emptyServerCheckIntervalMillis);
    }


    async isServerOnline(): Promise<boolean> {
        try {
            await this.withRcon(async (_: Rcon) => { });
            return true;
        } catch (error) {
            return false;
        }
    }


    async isAnyPlayerOnline(): Promise<boolean> {
        if (!(await this.isServerOnline())) {
            return false;
        }

        return this.withRcon(async (rcon: Rcon) => {
            const listOutput: string = (await rcon.send("list")).trim();
            if (!listOutput.includes(":")) {
                console.error("list output does not contain ':'");
                console.error(listOutput);
                return false;
            }
            return listOutput.split(":")[1].length != 0
        });
    }


    /* Util methods */


    private async withRcon<T>(callback: (rcon: Rcon) => Promise<T>): Promise<T> {
        const rcon = await Rcon.connect({ host: this.rconHost, port: this.rconPort, password: this.rconPassword, timeout: this.rconTimeoutMs });
        try {
            return await callback(rcon);
        } finally {
            try {
                await rcon.end();
            } catch (error) { }
        }
    }
}
