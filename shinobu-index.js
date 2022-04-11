const { Client, Collection } = require("discord.js");
const { EventEmitter } = require("stream");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { toConsole } = require("./functions.js");
const fs = require("fs");
const AsciiTable = require("ascii-table");
const config = require("./config.json");
const mysql = require("mysql2/promise");
const rest = new REST({ version: 9 }).setToken(config.token);
const wait = require("util").promisify(setTimeout);

// Client creation
const client = new Client({
  intents: ["GUILDS", "GUILD_BANS", "GUILD_INVITES", "GUILD_MEMBERS", "GUILD_SCHEDULED_EVENTS", "GUILD_WEBHOOKS"]
});
const slashCommands = [];
client.commands = new Collection();
client.event = new EventEmitter();

// MySQL handling
client.event.on("query", async (results, trace) => {
  const channel = client.channels.cache.get(config.errorChannel);
  const table = new AsciiTable("Query");
  table
    .setHeading("Property", "Value")
    .addRow("Source", trace ?? "? (No trace given)")
    .addRow("Rows Affected", results.affectedRows ?? "?")
    .addRow("Field Count", results.fieldCount ?? "?")
    .addRow("Insert ID", results.insertId ?? "?")
    .addRow("Server Status", results.serverStatus ?? "?")
    .addRow("Warning Status", results.warningStatus ?? "?")
    .addRow("Information", results.info === "" ? "No information" : results.info);
  // eslint-disable-next-line no-useless-escape
  const data = JSON.stringify(results[0], null, 2) + "\n===\n\n\`\`\`\n" + table.toString() + "\n\`\`\`";

  if(channel === null) {
    fs.writeFileSync("./queries/" + Date.now() + "_query-log.txt", data);
  } else {
    toConsole(data, __filename.split("/")[__filename.split("/").length - 1] +  " 21:16", client);
  }
});
(async () => {
  client.connection = await mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
  });
})();

// Slash command registration
(async () => {
  console.info("[APP-REFR] Starting file loading");
  const commands = fs.readdirSync("./commands/").filter(c => c.endsWith(".js"));
  console.info("[APP-REFR] Expecting " + commands.length + " files to be loaded");
  const ascii = new AsciiTable("Command Loading");
  ascii.setHeading("File", "Load Status");
  ascii.addRow("example.js", "Loaded from module.exports :D");
  for (let file of commands) {
    let command = require("./commands/" + file);

    if(command.name) {
      ascii.addRow(file, "Loaded from module.exports :D");
      client.commands.set(command.name, command);
      slashCommands.push(command.data.toJSON());
    } else {
      ascii.addRow(file, "Missing module.exports D:");
    }
  }
  
  console.info("[APP-REFR] All files loaded");
  await wait(500); // Artificial wait to prevent instant sending
  const now = Date.now();

  try {
    console.info("[APP-REFR] Started refreshing application commands");

    await rest.put(
      Routes.applicationCommands(config.applicationId),
      { body: slashCommands }
    );

    const then = Date.now();
    console.info("[APP-REFR] Successfully refreshed application commands after " + (then - now) + "ms");
    console.info("[APP-REFR]\n" + ascii.toString());
  } catch(e) {
    console.error("[APP-REFR]\nFailed to push the commands due to: " + e);
    console.info("[APP-REFR]\n" + ascii.toString());
  }
  console.info("[APP-REFR] All files loaded successfully");
})();

// Client events
client.on("ready", async () => {
  console.info("[ACT-SET] Client is ready. Setting Presence for " + client.user.username);
  const presence = await client.user.setPresence({ activities: [{ name: client.user.username + "is starting up!", type: "PLAYING" }] });
  console.info("[ACT-SET] Presence set successfully");
  console.info("[ACT-SET]\n> Type: " + presence.activities[0].type + "\n> Name: " + presence.activities[0].name + "\n> State: " + presence.activities[0].state);
  // State the time the client started up
  console.info("[APP-INIT] Time of startup: " + new Date());
});

client.on("interactionCreate", async (interaction) => {
  // Filters
  if(!interaction.guild) return;
  if(interaction.user.bot) return;

  if(interaction.isCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if(!cmd) return;
    cmd.run(client, interaction, interaction.options);
  }
});

client.login(config.token);