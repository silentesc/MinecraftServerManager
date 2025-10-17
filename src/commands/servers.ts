import { Client, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { MinecraftServer } from "../utils/minecraft_server";


module.exports = {
    execute: async (_: Client, interaction: ChatInputCommandInteraction) => {
        const responseEmbed = new EmbedBuilder();

        const member = interaction.member;

        if (!member) {
            responseEmbed.setColor(0xfa4b4b).setTitle("Error").setDescription("Member is undefined");
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        const serversWithMember: Array<string> = MinecraftServer.getServers()
            .filter(server => server.discordMemberIds.includes(member.user.id))
            .map(server => server.serverName);

        let serversWithMemberStr: string = serversWithMember ? `- ${serversWithMember.join("\n- ")}` : "You don't have access to any servers";

        responseEmbed
            .setColor(0x4c8afb)
            .setTitle("Servers you have access to:")
            .setDescription(serversWithMemberStr)
            .setTimestamp(new Date());
        await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
    },
};
