import { Client, ActivityType, EmbedBuilder, MessageFlags, GatewayIntentBits } from "discord.js";
import { readdirSync } from "fs";
import "dotenv/config";

import servers from "../servers.json";
import { MinecraftServer } from "./utils/minecraft_server";
import logger from "./utils/logging";


const commands = new Map();
readdirSync("./src/commands").filter(file => file.endsWith(".ts")).forEach(fileName => {
    const commandName = fileName.split(".ts")[0];
    const command = require(`./commands/${commandName}`);
    commands.set(commandName, command);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ]
});


client.on("clientReady", async c => {
    logger.info(`Logged in as ${c.user.tag}`);
    c.user.setActivity({
        name: "/help",
        type: ActivityType.Watching
    });
    const serverNames: Array<string> = Array();
    servers.forEach(async serverSettings => {
        if (serverNames.includes(serverSettings.server_name)) {
            throw new Error("Server name must be unique");
        }
        serverNames.push(serverSettings.server_name);
        // Server will add itself to it's static "servers" variable automatically
        const server = new MinecraftServer(
            serverSettings.server_name,
            serverSettings.start_server_executable,
            serverSettings.empty_server_check_interval_millis,
            serverSettings.empty_server_duration_until_shutdown_millis,
            serverSettings.rcon_host,
            serverSettings.rcon_port,
            serverSettings.rcon_password,
            serverSettings.rcon_timeout_ms,
            serverSettings.discord_server_ids,
            serverSettings.discord_member_ids,
        );
        logger.info(`[${server.serverName}] Checking if server is online to start wait for server empty listener`)
        if (await server.isServerOnline(0, 1)) {
            await server.waitForServerEmpty(async () => { });
        }
    });
});


client.on("shardResume", (_) => {
    if (!client.user) return;
    client.user.setActivity({
        name: "/help",
        type: ActivityType.Watching
    });
});


client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) return;

    const command = commands.get(interaction.commandName);
    if (command) {
        try {
            await command.execute(client, interaction);
        }
        catch (error) {
            const timestamp = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
            logger.error(`[${timestamp}] Catched error`);
            logger.error(`Executer: ${interaction.user.tag}`);
            logger.error(`Command: ${interaction.commandName}`);
            logger.error(`Options: ${interaction.options.data}`);
            logger.error(error);
            logger.error("End of error");

            const responseEmbed = new EmbedBuilder()
                .setColor(0xfa4b4b)
                .setTitle("❗Error❗")
                .setDescription("An unexpected error occured while executing that command.\n**Please contact an admin or dev so it can be fixed!**");
            try {
                if (interaction.replied) {
                    await interaction.editReply({ embeds: [responseEmbed] });
                }
                else {
                    await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
                }
            } catch (error) {
                logger.error(`Failed to send error message to user: ${error}`)
            }
        }
    }
});


client.login(process.env.TOKEN);
