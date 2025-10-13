# Bot Base with working help and ping slash commands

## Installation:
- Clone the code
- Open a terminal and execute `npm install`
- Create a `.env` file for the `TOKEN` and `CLIENT_ID`

## Features:
- Standalone script for creating slash commands.
- New commands in `./src/commands/` will automatically be recognized and executed, just copy the execute function etc. from another command
- Any error that happen while executing a command will be logged in the console with some extra info and the sender will be informed about the error
- Help command code doesn't have to be updated when adding a new command.

## How to:
### Setting up a new command:
  1. Add the command to the bot via the standalone script and execute it
  2. Implement your new command in `./src/commands/[command].ts` (command filename has to match the command)
  3. Update the help command options in the standalone script
  4. Update the general help page in `./src/txt/general_help.txt`
  5. Create a help page specific for the new command in `./src/help_specific_commands/[command].txt`
