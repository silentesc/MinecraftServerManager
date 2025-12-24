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


    async withRcon<T>(callback: (rcon: Rcon) => Promise<T>, retrySleepSecs: number = 10, maxRetries: number = 6): Promise<T> {
        if (!this.getIsConnected()) {
            throw new Error(`[${this.rcon.config.host}:${this.rcon.config.port}] Rcon not connected`);
        }

        let tryCount = 1;
        while (true) {
            try {
                let t: T = await callback(this.rcon);
                if (tryCount > 1) {
                    logger.info(`[${this.rcon.config.host}:${this.rcon.config.port}] Previously failed RCON operation succeed on try ${tryCount}/${maxRetries}`);
                }
                return t;
            } catch (error) {
                logger.error(`[${this.rcon.config.host}:${this.rcon.config.port}] RCON operation failed on try ${tryCount}/${maxRetries}: ${getErrorMessage(error)}`);
                if (tryCount >= maxRetries) {
                    throw error;
                }
                await sleep(retrySleepSecs * 1000);
                tryCount++;
            }
        }
    }


    /**
     * 
     * @param tryCount 
     * @param maxRetries 
     * @returns boolean: true if connected
     */
    async connect(retrySleepSecs: number = 10, maxRetries: number = 6): Promise<boolean> {
        if (this.getIsConnected()) {
            logger.debug(`[${this.rcon.config.host}:${this.rcon.config.port}] Ignoring trying to connect since it's already connected`);
            return true;
        }

        let tryCount = 1;
        while (true) {
            try {
                await this.rcon.connect();
                if (tryCount > 1) {
                    logger.info(`[${this.rcon.config.host}:${this.rcon.config.port}] Previously failed connect attempt succeed on try ${tryCount}/${maxRetries}`);
                }
                return true;
            } catch (error) {
                let errorMessage: String = getErrorMessage(error);
                // If conn refused then it's definately closed
                if (errorMessage.includes("ECONNREFUSED")) {
                    logger.error(`[${this.rcon.config.host}:${this.rcon.config.port}] Rcon failed to connect due to refused connection`);
                    return false;
                }
                // Else retry
                logger.error(`[${this.rcon.config.host}:${this.rcon.config.port}] Rcon failed to connect on try ${tryCount}/${maxRetries} with error: ${errorMessage}`);
                if (tryCount >= maxRetries) {
                    logger.error(`[${this.rcon.config.host}:${this.rcon.config.port}] Rcon max connecting tries exceeded.`);
                    this.setIsConnected(false);
                    try {
                        await this.rcon.end();
                    } catch (error) { }
                    return false;
                }
                await sleep(retrySleepSecs * 1000);
                tryCount++;
            }
        }
    }


    private setupRconEvents(): void {
        this.rcon.on("authenticated", () => {
            logger.debug(`[${this.rcon.config.host}:${this.rcon.config.port}] Rcon authenticated`);
        });
        this.rcon.on("connect", () => {
            this.setIsConnected(true);
            logger.debug(`[${this.rcon.config.host}:${this.rcon.config.port}] Rcon connected`);
        });
        this.rcon.on("end", async () => {
            this.setIsConnected(false);
            logger.warn(`[${this.rcon.config.host}:${this.rcon.config.port}] Rcon ended`);
        });
        this.rcon.on("error", async (error) => {
            let reconnectSecs = 10;
            this.setIsConnected(false);
            logger.error(`[${this.rcon.config.host}:${this.rcon.config.port}] Rcon threw an error, trying to reconnect in ${reconnectSecs} seconds...\n${getErrorMessage(error)}`);
            try {
                await this.rcon.end();
            } catch (error) { }
            await sleep(reconnectSecs * 1000);
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
