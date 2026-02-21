
// —— Requiring the packages the we need.
const fs = require("fs");
const { Client, Collection, Partials } = require("discord.js");
const { Signale } = require('signale');
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const express = require('express');
const path = require('path');
const https = require('https');
const pool = require('./pool');
const config = require("./config.js");
const logger = new Signale({ scope: 'Discord' });

// —— Initializing the client.
const client = new Client({ 
    intents: [ 131071 ], // Basically for (most?) of the intents.
    partials: [
        Partials.Channel
    ] 
});

// —— All event files of the event handler.
 const eventFiles = fs
 .readdirSync("./events")
 .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
 const event = require(`./events/${file}`);
 if (event.once) {
     client.once(event.name, (...args) => event.execute(...args, client));
 } else {
     client.on(event.name, async (...args) => await event.execute(...args, client));
 }
}

client.slashCommands = new Collection();

// —— Registration of Slash-Command Interactions.
const slashCommands = fs.readdirSync("./public/slash");

for (const module of slashCommands) {
	const commandFiles = fs
		.readdirSync(`./public/slash/${module}`)
		.filter((file) => file.endsWith(".js"));

	for (const commandFile of commandFiles) {
		const command = require(`./public/slash/${module}/${commandFile}`);
		client.slashCommands.set(command.data.name, command);
	}
}

// —— Registration of Slash-Commands in Discord API
const rest = new REST({ version: "9" }).setToken(config.Discord.token);

const commandJsonData = [
	...Array.from(client.slashCommands.values()).map((c) => c.data.toJSON()),
];

(async () => {
	try {
		logger.success("Started refreshing application (/) commands.");
		await rest.put(Routes.applicationGuildCommands(config.Discord.botId, config.Discord.guildId), { body: commandJsonData });
		logger.success("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error(error);
	}
})();

async function addRole(userID) {
    try {
		const guild = await client.guilds.fetch(config.Discord.guildId),
        	 role = await guild.roles.fetch(config.Discord.verifiedRole),
          	 member = await guild.members.fetch(userID);

        member.roles.add(role)
			.catch(() => {
				logger.error(`Failed to add role to user ${member.user.tag}! (Maybe verified role is above bot role?)`);
				return;
        	})
			.then(() => {
				logger.info(`Added verified role to user ${member.user.tag}.`);
			})
    } catch (e) {
		console.log(e)
        logger.error(`Failed to add role to user ${userID}!`);
    }
}

async function removeRole(userID) {
    const removeRole = config.Discord.removeRole

	if(removeRole) {
		try {
			const guild = await client.guilds.fetch(config.Discord.guildId),
				 removeRoleId = await guild.roles.fetch(config.Discord.removeRoleId),
				 member = await guild.members.fetch(userID);

			member.roles.remove(removeRoleId)
				.catch(() => {
					logger.error(`Failed to remove role from user ${member.user.tag}! (Maybe role is above bot role?)`);
					return;
				})
				.then(() => {
					logger.info(`Removed role from user ${member.user.tag}.`);
				})
			
		} catch(e) {
			logger.error(`Failed to remove role from user ${userID}!`);
		}
	} else {
		logger.info(`Remove role is set to false, step skipped.`)
	}  
}

// —— Login into your client application with bot's token.
client.login(config.Discord.token)
	.catch(() => {
		logger.fatal('Failed to login! Is your intents enabled?');
		process.exit(0);
	})

// —— And another thingy.
const app = express(),
     port = config.server.https ? 443 : config.server.httpPort;

// —— Define render engine and assets path
app.engine('html', require('ejs').renderFile);
app.use(express.static(path.join(__dirname, '/assets')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// GET /verify/id
app.get('/verify/:verifyId?', (req, res) => {
    if (!req.params.verifyId) return res.sendFile(path.join(__dirname, '/html/invalidLink.html'));
    if (!pool.isValidLink(req.params.verifyId)) return res.sendFile(path.join(__dirname, '/html/invalidLink.html'));
    res.sendFile(path.join(__dirname, '/html/verify.html'));
});

// POST /verify/id
app.post('/verify/:verifyId?', async (req, res) => {
    if (!pool.isValidLink(req.params.verifyId)) return res.sendFile(path.join(__dirname, '/html/invalidLink.html'));

    const discordId = pool.getDiscordId(req.params.verifyId);
    const requestIpAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    if (!pool.isValidAccountIp(discordId, requestIpAddress)) {
        logger.warn(`Blocked verification for ${discordId} due to mismatched IP address.`);
        return res.sendFile(path.join(__dirname, '/html/invalidLink.html'));
    }

    try {
        const guild = await client.guilds.fetch(config.Discord.guildId);
        const member = await guild.members.fetch(discordId);

        const accountAgeInDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        if (accountAgeInDays < 8) {
            logger.warn(`Blocked verification for ${discordId} due to account age below 8 days.`);
            return res.sendFile(path.join(__dirname, '/html/invalidAccount.html'));
        }

        if (!member.user.avatar) {
            logger.warn(`Blocked verification for ${discordId} due to missing profile picture.`);
            return res.sendFile(path.join(__dirname, '/html/invalidAccount.html'));
        }

        pool.setAccountIp(discordId, requestIpAddress);
        await addRole(discordId);
        await removeRole(discordId);
        pool.removeLink(req.params.verifyId);

        return res.sendFile(path.join(__dirname, '/html/valid.html'));
    } catch (error) {
        logger.error(`Failed to fetch member ${discordId} for verification checks.`);
        return res.sendFile(path.join(__dirname, '/html/invalidAccount.html'));
    }
});

const start = () => {
	if (config.https) {
		https.createServer({
			key: fs.readFileSync('private.pem'),
			cert: fs.readFileSync('certificate.pem')
		}, app).listen(port, () => logger.info(`Listening on port ${port}.`));
	} else {
		app.listen(port, () => logger.info(`Listening on port ${port}.`));
	}
}

// —— Start the server
start();
