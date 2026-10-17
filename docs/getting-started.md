Cabin runs on your own computer or server. You need Git, and macOS, Linux or Windows with WSL2. Nothing else: the installer brings Node when it is missing, and `rer` brings pnpm.

## Start Cabin

Run one line to install the `rer` launcher, clone Cabin and start it:

```sh
npx -y @runeditrun/rer dev just-every/run-cabin
```

No Node? `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-cabin` does the same and brings its own Node; it changes no shell settings, so if it prints an `export PATH=…` line, run that line to use `rer` again later. To set Cabin up without starting it, use `setup` in place of `dev`.

The first launch installs dependencies, sets up the local database and prepares a local owner. It can take several minutes. Run the same command again if it is interrupted.

## Sign in as the owner

1. When Cabin is ready, the terminal prints a private **RER_OPEN** link. Open it in your browser and keep it to yourself.
2. Confirm yourself as the owner on **Finish setup**.
3. Open `/app`. As the owner you have every tab: Calendar, Turnovers, Statements, Properties & people, Move in and Agent access.

**RER_READY** in the terminal is the ordinary app address for later visits.

## Stop and start again

Stop Cabin with `rer dev --stop` or Ctrl-C. To start it again later:

```sh
cd run-cabin
rer dev
```

## A lasting installation

For an installation that sends real email from your own mailbox, run setup in place of the one line, entering your email when asked, then start it:

```sh
npx -y @runeditrun/rer setup just-every/run-cabin
cd run-cabin
rer dev
```

While you try Cabin locally, development mail is not sent. To see what a manager or a cleaner sees, use the local personas described in [Homes and people](/docs/homes-and-people#try-the-other-roles).

## What to do first

1. Add your homes and your team in [Homes and people](/docs/homes-and-people), or bring a register of homes with [Move in your homes](/docs/move-in).
2. Bring in each home's channel calendars in [Channel calendars](/docs/calendars).
3. Send a cleaner their first job in [Turnovers](/docs/turnovers).
4. Prepare the month's figures in [Owner statements](/docs/statements).
