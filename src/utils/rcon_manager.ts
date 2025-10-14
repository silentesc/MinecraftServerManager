import { Rcon } from "rcon-client"
import logger from "./logging";
import { getErrorMessage, sleep } from "./utils";

export class RconManager {
    private rcon: Rcon;
    private isConnected: boolean;


    constructor(host: string, port: number, password: string, timeoutMs: number) {
        this.isConnected = false;
        this.rcon = new Rcon({ host, port, password, timeout: timeoutMs });
        this.setupRconEvents();
    }


    async withRcon<T>(callback: (rcon: Rcon) => Promise<T>): Promise<T> {
        if (!this.getIsConnected()) {
            throw Error("Rcon not connected");
        }
        try {
            return await callback(this.rcon);
        } catch (error) {
            logger.debug(`RCON operation failed: ${getErrorMessage(error)}`);
            throw error;
        }
    }


    async connect(tryCount: number = 1, maxTries: number = 3): Promise<void> {
        if (this.getIsConnected()) {
            logger.debug(`Ignoring connect method for ${this.rcon.config.host}:${this.rcon.config.port} since it's already connected`);
            return;
        }
        if (tryCount > maxTries) {
            logger.warn("Rcon max connecting tries exceeded.");
            this.setIsConnected(false);
            try {
                await this.rcon.end();
            } catch (error) { }
            return
        }
        try {
            await this.rcon.connect();
            logger.info(`Rcon connected to ${this.rcon.config.host}:${this.rcon.config.port} on try ${tryCount}`);
        } catch (error) {
            logger.warn(`Rcon failed to connect to ${this.rcon.config.host}:${this.rcon.config.port} on try ${tryCount} with error: ${getErrorMessage(error)}`);
            const retryInSeconds = tryCount * 1000;
            await sleep(retryInSeconds);
            await this.connect(++tryCount, maxTries);
        }
    }


    private setupRconEvents(): void {
        this.rcon.on("authenticated", () => {
            logger.debug(`Rcon for ${this.rcon.config.host}:${this.rcon.config.port} authenticated`);
        });
        this.rcon.on("connect", () => {
            this.setIsConnected(true);
            logger.debug(`Rcon for ${this.rcon.config.host}:${this.rcon.config.port} connected`);
        });
        this.rcon.on("end", async () => {
            this.setIsConnected(false);
            logger.debug(`Rcon for ${this.rcon.config.host}:${this.rcon.config.port} ended`);
        });
        this.rcon.on("error", async (error) => {
            this.setIsConnected(false);
            logger.error(`Rcon for ${this.rcon.config.host}:${this.rcon.config.port} threw an error, trying to reconnect in 3 seconds...\n${getErrorMessage(error)}`);
            try {
                await this.rcon.end();
            } catch (error) { }
            await sleep(3000);
            await this.connect();
        });
    }


    getIsConnected(): boolean {
        return this.isConnected;
    }


    private setIsConnected(isConnected: boolean): void {
        this.isConnected = isConnected;
    }
}
