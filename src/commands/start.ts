import { Client, ChatInputCommandInteraction } from "discord.js";
import { MinecraftServer } from "../utils/minecraft_server";
import { roundTo, sleep } from "../utils/utils";
import logger from "../utils/logging";
import { editEmbedReply, sendEmbedReply, sendEmbedToChannel } from "../utils/interaction_utils";
import { canSendMessageToChannel } from "../utils/permission_checker";


module.exports = {
    execute: async (client: Client, interaction: ChatInputCommandInteraction) => {
        const name = interaction.options.get("name")?.value;

        // Check stuff
        if (!name) {
            await sendEmbedReply(interaction, 0xfa4b4b, "Error", "Name required", true);
            return;
        }
        const targetServer: MinecraftServer | undefined = MinecraftServer.getServers().find(server => server.serverName === name);
        if (!targetServer) {
            await sendEmbedReply(interaction, 0xfa4b4b, "Error", `Server with Name '${name}' not found`, true);
            return;
        }
        if (!interaction.inGuild()) {
            await sendEmbedReply(interaction, 0xfa4b4b, "Error", "Command can only be executed in guild", true);
            return;
        }
        if (!targetServer.discordServerIds.includes(interaction.guildId)) {
            await sendEmbedReply(interaction, 0xfa4b4b, "Error", "Guild not in whitelist for this minecraft server", true);
            return;
        }
        if (!interaction.member) {
            await sendEmbedReply(interaction, 0xfa4b4b, "Error", "Member is undefined", true);
            return;
        }
        if (!targetServer.discordMemberIds.includes(interaction.member.user.id)) {
            await sendEmbedReply(interaction, 0xfa4b4b, "Error", "You are not in whitelist for this minecraft server", true);
            return;
        }
        if (targetServer.isStarting || await targetServer.isServerOnline()) {
            await sendEmbedReply(interaction, 0xfa4b4b, "Error", "Server already online or currently starting", true);
            return;
        }

        await interaction.deferReply();

        targetServer.isStarting = true;

        // Start server
        try {
            logger.info(`${interaction.member.user.username} started server ${targetServer.serverName}`);
            await targetServer.startServer();
        } catch (error) {
            logger.error(`${targetServer.serverName} failed to start`);
            await editEmbedReply(interaction, 0xfa4b4b, "Error", (error as string));
            return;
        }

        // Send starting response
        if (!await canSendMessageToChannel(client, interaction.guildId, interaction.channelId)) {
            await editEmbedReply(interaction, 0xfad34b, "Server starting...", `Server '${name}' is being started.\nI currently do not have the necessary permissions to send independent messages (like updates about the server stopping) to this channel.`);
        }
        else {
            await editEmbedReply(interaction, 0x4c8afb, "Server starting...", `Server '${name}' is being started. You will be notified when it's online.`);
        }

        // Wait for server to start
        logger.info(`Waiting for server ${targetServer.serverName} to be online`);
        while (true) {
            await sleep(10000);
            if (await targetServer.isServerOnline()) {
                break;
            }
        }

        // Start wait job for empty server (not blocking)
        await targetServer.waitForServerEmpty(async () => {
            if (await canSendMessageToChannel(client, interaction.guildId, interaction.channelId)) {
                await sendEmbedToChannel(interaction, 0x4c8afb, "Server automatically stopped", `Nobody was online for ${roundTo(targetServer.emptyServerDurationUntilShutdownMillis / 60000, 2)} minutes`);
            }
        });

        targetServer.isStarting = false;

        // Send started response
        logger.info(`Server ${targetServer.serverName} is online`);
        if (await canSendMessageToChannel(client, interaction.guildId, interaction.channelId)) {
            await sendEmbedToChannel(interaction, 0x4c8afb, "Server is now online", `Server '${name}' is now online. Enjoy playing.`);
        }
    },
};
