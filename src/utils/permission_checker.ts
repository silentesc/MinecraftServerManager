import { Client, PermissionsBitField } from "discord.js";
import logger from "./logging";

export async function canSendMessageToChannel(client: Client, guildId: string, channelId: string) {
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(_ => { });
    if (!guild) {
        logger.error(`Guild with id ${guildId} not found.`);
        return false;
    }

    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(_ => { });
    if (!channel || !channel.isTextBased()) {
        logger.error(`Channel with id ${channelId} not found or not a text channel.`);
        return false;
    }

    if (!client.user) {
        logger.error("client is null (this should not happen)");
        return false;
    }
    const me = guild.members.me || await guild.members.fetch(client.user.id).catch(_ => { });
    if (!me) {
        logger.error("client not found");
        return false;
    }
    const permissions = channel.permissionsFor(me);
    const hasPermission = permissions?.has([
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ViewChannel,
    ])

    return hasPermission;
}
