import { Client, ActivityType, EmbedBuilder } from "discord.js";
import { readdirSync } from "fs";
import "dotenv/config";


const commands = new Map();
readdirSync("./src/commands").filter(file => file.endsWith(".ts")).forEach(fileName => {
    const commandName = fileName.split(".ts")[0];
    const command = require(`./commands/${commandName}`);
    commands.set(commandName, command);
});

const client = new Client({ intents: [] });


client.on("clientReady", c => {
    console.log(`Logged in as ${c.user.tag}`);
    if (client.user) {
        client.user.setActivity({
            name: "/help",
            type: ActivityType.Watching
        });
    }
    else {
        console.error("Failed to set activity. client.user not defined.")
    }
});


client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (command) {
        try {
            await command.execute(client, interaction);
        }
        catch (error) {
            const timestamp = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
            console.log(`[${timestamp}] Catched error`);
            console.log("Executer:", interaction.user.tag);
            console.log("Command:", interaction.commandName);
            console.log("Options:", interaction.options.data);
            console.log(error);
            console.log("End of error");

            const responseEmbed = new EmbedBuilder()
                .setColor(0xfa4b4b)
                .setTitle("❗Error❗")
                .setDescription("An unexpected error occured while executing that command.\n**Please contact an admin or dev so it can be fixed!**");
            await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
        }
    }
});


client.login(process.env.TOKEN);
