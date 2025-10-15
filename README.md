# !!! IN ACTIVE DEVELOPMENT !!!

## Features
### Commands
(Use `/help (command_name)` for detailed explanation)
- `/help` -> Displays the Help Page.
- `/ping` -> Shows the client & websocket latency.
- `/start` -> Starts the minecraft server.
- `/servers` -> Lists all servers you have access to.

### How to register commands
- Edit `register_commands.js` (You'll need very basic javascript knowledge and googling skills)
- run `npm run register`

## Installation
- Clone the code
- Open a terminal and execute `npm install`
- Create a `.env`
- Create a `servers.json`

### Create a bot
- Go to the discord developer portal and create your bot
- Edit Install Settings (Installation > Default Install Settings)
    - Scopes
        - applications.commands
        - bot
    - Permissions
        - Embed Links
        - Send Messages
        - View Channels

### .env example:
```sh
CLIENT_ID='' # Bot Client ID
GUILD_ID='' # Guild ID (only needed for testing)
TOKEN='' # Bot Token
LOG_LEVEL='' # trace, debug, info, warn, error, fatal
```

### servers.json example:
```json
[
    {
        "server_name": "Survival_1.21",
        "empty_server_check_interval_millis": 10000, // 10 seconds
        "empty_server_duration_until_shutdown_millis": 1800000, // 30 mins
        "start_server_executable": "/home/myusername/minecraft_1.21/run.sh",
        "rcon_host": "127.0.0.1",
        "rcon_port": 25575,
        "rcon_password": "secure_password",
        "rcon_timeout_ms": 15000,
        "discord_server_ids": ["1234"],
        "discord_member_ids": ["5678", "8765"]
    }
    // Add as many servers as you like
]
```

## Running the bot
- `npm run build`
- `npm run start`
