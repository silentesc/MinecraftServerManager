import { exec } from "child_process";
import { Rcon } from "rcon-client";


export class MinecraftServer {
    rconHost: string;
    rconPort: number;
    rconPassword: string;
    rconTimeoutMs: number;
    startServerExecutable: string;


    constructor(rconHost: string, rconPort: number, rconPassword: string, rconTimeoutMs: number, startServerExecutable: string) {
        this.rconHost = rconHost;
        this.rconPort = rconPort;
        this.rconPassword = rconPassword;
        this.rconTimeoutMs = rconTimeoutMs;
        this.startServerExecutable = startServerExecutable;
    }


    async startServer(): Promise<void> {
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
        if (!this.isServerOnline()) {
            return;
        }
        this.withRcon(async (rcon: Rcon) => {
            await rcon.send("stop");
        });
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
        if (!this.isServerOnline()) {
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
