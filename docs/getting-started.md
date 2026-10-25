Cabin runs on your own computer or server, on macOS, Linux or Windows with WSL2. Git is required; rer brings Node and pnpm. Nothing else is needed.

## Start Cabin

Run one line to install the `rer` launcher, clone Cabin into `run-cabin` and start it:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-cabin
```

Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-cabin` does the same. The installer does not edit your shell files itself. If it prints a line to run, run it: that line puts `rer` on your PATH now and appends the same `export PATH=…` setting to your shell's startup file (`~/.zshrc` for zsh, otherwise `~/.profile` or `~/.bash_profile`), so `rer` also works in new terminals. To set Cabin up without starting it, use `setup` in place of `dev`.

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

To make Cabin available away from this computer, follow [Put Cabin online](/docs/hosting). For Cabin-specific mail, integrations, backup and permanent removal, see [Deploy your own Cabin](/docs/self-hosting).
