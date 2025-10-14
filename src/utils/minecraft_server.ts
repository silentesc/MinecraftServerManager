import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Rcon } from "rcon-client";
import { exec } from "child_process";
import { promisify } from "util";
import logger from "./logging";
import { RconManager } from "./rcon_manager";
import { getErrorMessage } from "./utils";
const execAsync = promisify(exec);


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


    async startServer(): Promise<void> {
        if (await this.isServerOnline()) {
            throw Error("Server already running");
        }

        try {
            const { stderr } = await execAsync(this.startServerExecutable);
            if (stderr) {
                logger.error(`Starting ${this.serverName} threw an stderr: ${stderr}`);
                throw new Error(stderr);
            }
        } catch (error) {
            logger.error(`Starting ${this.serverName} threw an error: ${getErrorMessage(error)}`);
            throw error;
        }

        logger.info(`Server start process for ${this.serverName} has been executed`);
    }


    async stopServer(): Promise<void> {
        if (!(await this.isServerOnline())) {
            logger.debug(`Not stopping server ${this.serverName} because it's not online`)
            return;
        }
        await this.rconManager.withRcon(async (rcon: Rcon) => {
            logger.info(`Stopping server ${this.serverName}`);
            clearInterval(this.intervalId);
            this.intervalId = null;
            await rcon.send("stop");
        });
    }


    async waitForServerEmpty(interaction: ChatInputCommandInteraction): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        let counterMillis = 0;
        this.intervalId = setInterval(async () => {
            // End interval checks
            if (!(await this.isServerOnline())) {
                logger.debug(`${this.serverName} not online, stopping wait for server empty job`);
                clearInterval(this.intervalId);
                this.intervalId = null;
                return;
            }
            // End interval checks and stop server
            if (counterMillis >= this.emptyServerDurationUntilShutdownMillis) {
                logger.info(`Nobody was online for ${this.emptyServerDurationUntilShutdownMillis / 60000} minutes, stopping server ${this.serverName}`);
                this.stopServer();
                clearInterval(this.intervalId);
                this.intervalId = null;
                await this.sendInteractionFollowUp(interaction, "Server automatically stopped", `Nobody was online for ${this.emptyServerDurationUntilShutdownMillis / 60000} minutes`)
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
        if (!this.rconManager.getIsConnected()) {
            try {
                await this.rconManager.connect(1, 1);
            } catch (error) {
                logger.trace("[isServerOnline] false");
                return false;
            }
        }
        try {
            await this.rconManager.withRcon(async (rcon: Rcon) => await rcon.send("list"));
            logger.trace("[isServerOnline] true");
            return true;
        } catch (error) {
            logger.trace("[isServerOnline] false");
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
                logger.error("list output does not contain ':'");
                logger.error(listOutput);
                return false;
            }
            return listOutput.split(":")[1].length != 0
        });
    }


    private async sendInteractionFollowUp(interaction: ChatInputCommandInteraction, title: string, description: string): Promise<void> {
        const responseEmbed = new EmbedBuilder();
        responseEmbed.setColor(0xfa4b4b).setTitle(title).setDescription(description).setTimestamp(new Date());
        await interaction.followUp({ embeds: [responseEmbed] });
        return;
    }
}
