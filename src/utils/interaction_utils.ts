import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import logger from "./logging";


export async function sendEmbedReply(interaction: ChatInputCommandInteraction, color: number, title: string, description: string, ephemeral: boolean): Promise<void> {
    const responseEmbed = new EmbedBuilder();
    responseEmbed.setColor(color).setTitle(title).setDescription(description).setTimestamp(new Date());
    try {
        if (ephemeral) {
            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
        }
        else {
            await interaction.reply({ embeds: [responseEmbed] });
        }
    } catch (error) {
        logger.error(`Unexpected error when replying to interaction: ${error}`);
    }
}


export async function editEmbedReply(interaction: ChatInputCommandInteraction, color: number, title: string, description: string): Promise<void> {
    const responseEmbed = new EmbedBuilder();
    responseEmbed.setColor(color).setTitle(title).setDescription(description).setTimestamp(new Date());
    try {
        await interaction.editReply({ embeds: [responseEmbed] });
    } catch (error) {
        logger.error(`Unexpected error when editing reply to interaction: ${error}`);
    }
}


export async function sendEmbedToChannel(interaction: ChatInputCommandInteraction, color: number, title: string, description: string): Promise<void> {
    const responseEmbed = new EmbedBuilder();
    responseEmbed.setColor(color).setTitle(title).setDescription(description).setTimestamp(new Date());
    try {
        const channel = await interaction.client.channels.fetch(interaction.channelId);
        if (channel && channel.isSendable()) {
            await channel.send({ embeds: [responseEmbed] });
        }
        else {
            logger.error(`Channel is null or not sendable: ${channel}`);
        }
    } catch (error) {
        logger.error(`Unexpected error when sending to channel: ${error}`);
    }
}
