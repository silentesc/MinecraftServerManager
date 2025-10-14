import { Client, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { MinecraftServer } from "../utils/minecraft_server";
import { sleep } from "../utils/utils";


module.exports = {
    execute: async (_: Client, interaction: ChatInputCommandInteraction) => {
        const name = interaction.options.get("name")?.value;
        const responseEmbed = new EmbedBuilder();

        // Check stuff
        if (!name) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Error").setDescription("Name required");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        const targetServer: MinecraftServer | undefined = MinecraftServer.servers.find(server => server.serverName === name);
        if (!targetServer) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Error").setDescription(`Server with Name '${name}' not found`);
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        if (!interaction.guild) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Error").setDescription("Guild is undefined");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        if (!targetServer.discordServerIds.includes(interaction.guild.id)) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Error").setDescription("Guild not in whitelist for this minecraft server");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        if (!interaction.member) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Error").setDescription("Member is undefined");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        if (!targetServer.discordMemberIds.includes(interaction.member.user.id)) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Error").setDescription("You are not in whitelist for this minecraft server");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        if (targetServer.isStarting || await targetServer.isServerOnline()) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Error").setDescription("Server already online or currently starting");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        targetServer.isStarting = true;

        // Start server
        try {
            await targetServer.startServer();
        } catch (error) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Error").setDescription((error as string));
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        // Send starting response
        responseEmbed
            .setColor(0x4c8afb)
            .setTitle("Server starting...")
            .setDescription(`Server '${name}' is being started. You will be notified when it's online.`)
            .setTimestamp(new Date());
        await interaction.reply({ embeds: [responseEmbed] });

        // Wait for server to start
        let serverOnline = false;
        const intervalId = setInterval(async () => {
            if (await targetServer.isServerOnline()) {
                serverOnline = true;
                clearInterval(intervalId);
                return;
            }
        }, 3000);
        while (!serverOnline) {
            await sleep(1000);
        }

        targetServer.isStarting = false;

        // Start wait job for empty server (not blocking)
        await targetServer.waitForServerEmpty(interaction);

        // Send started response
        responseEmbed
            .setColor(0x4c8afb)
            .setTitle("Server online")
            .setDescription(`Server '${name}' is now online. Enjoy playing.`)
            .setTimestamp(new Date());
        await interaction.followUp({ embeds: [responseEmbed] });
    },
};
