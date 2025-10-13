import { Client, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { MinecraftServer } from "../utils/minecraft_server";


module.exports = {
    execute: async (_: Client, interaction: ChatInputCommandInteraction) => {
        const name = interaction.options.get("name")?.value;
        const responseEmbed = new EmbedBuilder();

        // Check stuff
        if (!name) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Name required");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        const targetServer: MinecraftServer | undefined = MinecraftServer.servers.find(server => server.serverName === name);
        if (!targetServer) {
            responseEmbed.setColor(0xfa4b4b).setTitle(`Server with Name '${name}' not found`);
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        if (!interaction.guild) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Guild is undefined");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        if (!targetServer.discordServerIds.includes(interaction.guild.id)) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Guild not in whitelist for this minecraft server");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        if (!interaction.member) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Member is undefined");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        if (!targetServer.discordMemberIds.includes(interaction.member.user.id)) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Member not in whitelist for this minecraft server");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        // Start server
        try {
            targetServer.startServer()
        } catch (error) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Starting the server failed with error").setDescription((error as string));
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        // Send starting response
        responseEmbed
            .setColor(0x4c8afb)
            .setTitle("Starting Server")
            .setDescription(`Server '${name}' is being started. You will be notified when it's online.`);
        await interaction.reply({ embeds: [responseEmbed] });

        // Wait for server to start
        const intervalId = setInterval(async () => {
            if (await targetServer.isServerOnline()) {
                clearInterval(intervalId);
                return;
            }
        }, 3000);

        // Start wait job for empty server
        targetServer.waitForServerEmpty();

        // Send started response
        responseEmbed
            .setColor(0x4c8afb)
            .setTitle("Starting Server")
            .setDescription(`Server '${name}' is now online. Enjoy playing.`);
        await interaction.followUp({ embeds: [responseEmbed] });
    },
};
