import { exec } from "child_process";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Rcon } from "rcon-client";
import logger from "./logging";
import { RconManager } from "./rcon_manager";


export class MinecraftServer {
    static servers: Array<MinecraftServer> = new Array();

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
    }


    /**
     * @throws error
     */
    async startServer(): Promise<void> {
        logger.trace(`[startServer] Starting server ${this.serverName}`);
        if (await this.isServerOnline()) {
            logger.trace(`${this.serverName} already online`);
            throw Error("[startServer] Server already running");
        }

        let done = false;
        exec(this.startServerExecutable, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Starting ${this.serverName} threw an error: ${error}`);
                throw error;
            }
            else if (stderr) {
                logger.error(`Starting ${this.serverName} threw an stderr: ${stderr}`);
                throw new Error(stderr);
            }
            logger.trace(`[startServer] Starting ${this.serverName} threw no errors`);
            done = true;
        });

        const intervalId = setInterval(() => {
            logger.trace(`[startServer] Checking for started server ${this.serverName}`);
            if (done) {
                logger.trace(`[startServer] ${this.serverName} done`);
                clearInterval(intervalId);
                return;
            }
        }, 500);
    }


    async stopServer(): Promise<void> {
        logger.trace(`[stopServer] Stopping server ${this.serverName}`);
        if (!(await this.isServerOnline())) {
            logger.trace(`[stopServer] ${this.serverName} not online, returning`);
            return;
        }
        this.rconManager.withRcon(async (rcon: Rcon) => {
            logger.trace(`[stopServer] Sending stop signal to ${this.serverName}`);
            await rcon.send("stop");
        });
    }


    async waitForServerEmpty(interaction: ChatInputCommandInteraction): Promise<void> {
        logger.trace(`[waitForServerEmpty] Wait for server empty for ${this.serverName}`);
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        let counterMillis = 0;
        this.intervalId = setInterval(async () => {
            logger.trace(`[waitForServerEmpty] Check for server empty for ${this.serverName}`);
            // End interval checks
            if (!(await this.isServerOnline())) {
                logger.trace(`[waitForServerEmpty] Server ${this.serverName} not online, stopping wait`);
                clearInterval(this.intervalId);
                this.intervalId = null;
                return;
            }
            // End interval checks and stop server
            if (counterMillis >= this.emptyServerCheckIntervalMillis) {
                logger.trace(`[waitForServerEmpty] No players are on server ${this.serverName} for ${this.emptyServerDurationUntilShutdownMillis / 60000} minutes, stopping server`);
                this.stopServer();
                clearInterval(this.intervalId);
                this.intervalId = null;
                await this.sendInteractionFollowUp(interaction, "Server automatically stopped", `Nobody was online for ${this.emptyServerDurationUntilShutdownMillis / 60000} minutes`)
                return;
            }
            // Reset interval counter
            if (await this.isAnyPlayerOnline()) {
                logger.trace(`[waitForServerEmpty] Players are online on ${this.serverName}, resetting counter`);
                clearInterval(this.intervalId);
                this.intervalId = null;
                counterMillis = 0;
            }
            // Increment interval counter
            counterMillis += this.emptyServerCheckIntervalMillis;
        }, this.emptyServerCheckIntervalMillis);
    }


    async isServerOnline(): Promise<boolean> {
        if (this.rconManager.getIsConnected()) {
            logger.trace("[isServerOnline] true (rcon connected)");
            return true;
        }
        try {
            logger.trace("[isServerOnline] rcon not connected, trying to connect");
            await this.rconManager.connect(1, 1);
            logger.trace("[isServerOnline] true (connected successfully)");
            return true;
        } catch (error) {
            logger.trace("[isServerOnline] false");
            return false;
        }
    }


    async isAnyPlayerOnline(): Promise<boolean> {
        logger.trace(`[isAnyPlayerOnline] check for any player online for ${this.serverName}`);
        if (!(await this.isServerOnline())) {
            logger.trace(`[isAnyPlayerOnline] ${this.serverName} false, server not online`);
            return false;
        }

        return this.rconManager.withRcon(async (rcon: Rcon) => {
            const listOutput: string = (await rcon.send("list")).trim();
            if (!listOutput.includes(":")) {
                logger.error("list output does not contain ':'");
                logger.error(listOutput);
                return false;
            }
            logger.trace(`[isAnyPlayerOnline] ${listOutput.split(":")[1].length != 0} players are online`)
            return listOutput.split(":")[1].length != 0
        });
    }


    /* Util methods */


    private async sendInteractionFollowUp(interaction: ChatInputCommandInteraction, title: string, description: string): Promise<void> {
        const responseEmbed = new EmbedBuilder();
        responseEmbed.setColor(0xfa4b4b).setTitle(title).setDescription(description).setTimestamp(new Date());
        await interaction.followUp({ embeds: [responseEmbed] });
        return;
    }
}
