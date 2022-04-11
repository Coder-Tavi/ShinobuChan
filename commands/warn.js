const { SlashCommandBuilder } = require("@discordjs/builders");
// eslint-disable-next-line no-unused-vars
const { Client, CommandInteraction, CommandInteractionOptionResolver, MessageEmbed } = require("discord.js");
const { interactionEmbed } = require("../functions.js");

module.exports = {
  name: "warn",
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warns a user")
    .addUserOption(option => {
      return option
        .setName("user")
        .setDescription("The user to warn")
        .setRequired(true);
    })
    .addStringOption(option => {
      return option
        .setName("reason")
        .setDescription("The reason for the warning")
        .setRequired(true);
    }),
  /**
   * @param {Client} client 
   * @param {CommandInteraction} interaction 
   * @param {CommandInteractionOptionResolver} options
   */
  run: async (client, interaction, options) => {
    // Defer with ephemeral messages
    await interaction.deferReply({ ephemeral: false });
    // eslint-disable-next-line no-useless-escape
    if(!interaction.member.permissions.has("VIEW_AUDIT_LOG")) return interactionEmbed(3, "[ERR-UPRM]", "Missing: \`View Audit Log\`", interaction, client, true);

    // Variables
    let user = options.getUser("user");
    const reason = options.getString("reason");
    user = interaction.guild.members.cache.get(user.id) ?? user;

    // Execution
    const result = await client.connection.execute("INSERT INTO Warnings (id, guild, user, reason) VALUES (?, ?, ?, ?)", [Buffer.from(String(Date.now())).toString("base64"), interaction.guild.id, user.id, reason])
      .catch(e => interactionEmbed(3, "[SQL-ERR]", "[" + e.code + "] " + e.message, interaction, client, false));
    if(result.affectedRows === 0) return interactionEmbed(3, "[ERR-SQL]", "Failed to warn user for an unknown reason", interaction, client, true);
    const embed = new MessageEmbed({
      title: "Warning",
      description: "A warning has been issued to <@!" + user + "> (ID: " + user.id + ")",
      fields: [
        {
          name: "Reason",
          value: reason,
          inline: true
        },
        {
          name: "Overseer",
          value: "<@!" + interaction.member + "> (ID: " + interaction.member.id + ")",
          inline: true
        }
      ],
      timestamp: new Date()
    });

    interaction.editReply({ embeds: [embed] });
  }
};