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
    servers.forEach(server => {
        if (serverNames.includes(server.server_name)) {
            throw new Error("Server name must be unique");
        }
        serverNames.push(server.server_name);
        MinecraftServer.servers.push(
            new MinecraftServer(
                server.server_name,
                server.start_server_executable,
                server.empty_server_check_interval_millis,
                server.empty_server_duration_until_shutdown_millis,
                server.rcon_host,
                server.rcon_port,
                server.rcon_password,
                server.rcon_timeout_ms,
                server.discord_server_ids,
                server.discord_member_ids,
            )
        );
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
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
        }
    }
});


client.login(process.env.TOKEN);
