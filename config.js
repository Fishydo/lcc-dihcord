module.exports = {
    server: {
        domain: "lcc-discord.onrender.com",
        https: true,
        httpPort: ,
    },

    Discord: {
        // —— Things that are required for the whole project to work.
        token: process.env.TOKEN_ID || "", // —— Your bot but its not a secret so its ok to have in this code.
        botId: "1474542663176028253", // —— The bot's ID.
        guildId: "1474543090583994490", // —— The server ID on where the commands will be deployed.
        verifiedRole: "1474549843148935321", // —— Role that will be added to the user when they verify their account.

        // —— For users that want to have a role removed upon verification, if you want this, set remove-role to true, and set your remove role ID.
        removeRole: false,
        removeRoleId: "",

        // —— Set the bot's presence, for statusType see: https://discord-api-types.dev/api/discord-api-types-v10/enum/ActivityType
        statusType: 3, // 1 (STREAMING), 2 (LISTENING), 3 (WATCHING), 5 (COMPETING). Default is 0 (PLAYING). 
        statusMsg: "unverified users!",

        // —— By default, rules are set to disabled, this means rules will be hidden. If you want to use the rules function, change disabled to your rules. Please ensure you use \n for each line break and do not use any symbols that could interfear with JSON.
        rulesEnabled: true,
        rules: "Type your rules here if rulesEnabled is enabled, ensure to use \n for new lines"
    },

    reCAPTCHA: {
        secretKey: "6LdXt3IsAAAAADrN0qhGPTrL0gQZnj2As6SVEPl-",
        publicKey: "6LdXt3IsAAAAAH_74J2tAtL25Er9NWSQN84ZUgF-"
    }
}
