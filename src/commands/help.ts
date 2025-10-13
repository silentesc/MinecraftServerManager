import { Client, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { readFileSync } from "fs";


module.exports = {
    execute: async (_: Client, interaction: ChatInputCommandInteraction) => {
        const command = interaction.options.get("command")?.value;
        const responseEmbed = new EmbedBuilder()
        let helpPage;

        if (command) {
            helpPage = readFileSync(`./src/txt/help_specific_commands/${command}.txt`).toString();
            responseEmbed
                .setTitle(`Help for: /${command}`);
        }
        else {
            helpPage = readFileSync("./src/txt/general_help.txt").toString();
            responseEmbed
                .setTitle("Help Page");
        }

        responseEmbed
            .setColor(0x4c8afb)
            .setDescription(helpPage);

        await interaction.reply({ embeds: [responseEmbed] });
    },
};
