import { Client, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";


module.exports = {
    execute: async (client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();
        const reply = await interaction.fetchReply();

        const clientPing = reply.createdTimestamp - interaction.createdTimestamp;
        const websocketPing = client.ws.ping;

        const responseEmbed = new EmbedBuilder()
            .setColor(0x4c8afb)
            .setTitle("🏓 Pong!")
            .addFields(
                { name: "Latency", value: `${clientPing}ms` },
                { name: "API", value: `${websocketPing}ms` },
            )

        await interaction.editReply({ embeds: [responseEmbed] });
    },
};
