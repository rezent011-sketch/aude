# Aude -- Your AI Coworker in Discord

**Aude** is an autonomous AI coworker that lives in your Discord server. Delegate real work -- research, coding, content creation, automation -- and get finished results, not suggestions.

> The Discord-native alternative to Roman AI.

---

## What Aude Can Do

- Research -- Investigate competitors, markets, topics in depth
- Code -- Write, review, and debug code in any language
- Create -- Generate blog posts, emails, landing pages, reports
- Automate -- Run any task and get results directly in Discord
- DM Support -- No mention needed; just message Aude directly
- Mention Support -- Use `@Aude` in any server channel

---

## Quick Start

### In a server channel
```
@Aude research the top 5 AI tools launched this month and make a report
```

### In DM (no mention needed)
```
Build me a landing page for my SaaS product, target audience is developers
```

### Slash commands
```
/task        -- Run any task
/research    -- Deep research on any topic
/create      -- Generate content, LPs, documents
/code        -- Write and execute code
/notion      -- Search and create Notion pages
/google      -- List and add Google Calendar events
/github      -- List and create GitHub issues
```

---

## Self-Hosting

### Prerequisites
- Node.js 18+
- A Discord Bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- Anthropic API key and/or OpenAI API key

### Installation

```bash
git clone https://github.com/rezent011-sketch/aude
cd aude
npm install
cp .env.example .env
# Edit .env with your API keys
```

### Register Slash Commands

```bash
# For development (instant, guild-specific):
DISCORD_GUILD_ID=your_guild_id npm run register

# For production (global, takes ~1 hour):
npm run register
```

### Run

```bash
# Development (with hot reload via ts-node):
npm run dev

# Production:
npm run build
npm start
```

---

## Project Structure

```
src/
  index.ts                    # Bot entry point
  register-commands.ts        # Slash command registration script
  commands/
    task.ts                   # /task command
    research.ts               # /research command
    create.ts                 # /create command
    code.ts                   # /code command
    notion.ts                 # /notion command
    google.ts                 # /google command
    github.ts                 # /github command
  integrations/
    notion.ts                 # Notion API client
    google.ts                 # Google Calendar API client
    github.ts                 # GitHub API client
  handlers/
    commandHandler.ts         # Load + register commands
    interactionHandler.ts     # Handle slash command interactions
    messageHandler.ts         # Handle DM + mention messages
  llm/
    router.ts                 # LLM router (Claude / GPT-4o)
  utils/
    discord.ts                # Discord utilities (message splitting, etc.)
```

---

## LLM Router

Aude automatically routes requests to the best model:

| Task type         | Default model |
|-------------------|---------------|
| Research, content | Claude        |
| Code generation   | GPT-4o        |
| Auto (default)    | Heuristic     |

You can override the model per command using the `model` option.

---

## Environment Variables

See `.env.example` for all available variables.

| Variable              | Required | Description                      |
|-----------------------|----------|----------------------------------|
| `DISCORD_TOKEN`       | Yes      | Discord bot token                |
| `DISCORD_CLIENT_ID`   | Yes      | Discord application client ID    |
| `DISCORD_GUILD_ID`    | No       | Guild ID for dev command registration |
| `ANTHROPIC_API_KEY`   | No*      | Anthropic (Claude) API key       |
| `OPENAI_API_KEY`      | No*      | OpenAI (GPT-4o) API key          |
| `NOTION_API_KEY`      | No       | Notion integration token         |
| `NOTION_DATABASE_ID`  | No       | Notion database ID for page creation |
| `GOOGLE_CLIENT_ID`    | No       | Google OAuth client ID           |
| `GOOGLE_CLIENT_SECRET`| No       | Google OAuth client secret       |
| `GOOGLE_REFRESH_TOKEN`| No       | Google OAuth refresh token       |
| `GITHUB_TOKEN`        | No       | GitHub personal access token     |

*At least one LLM API key is required.

---

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Discord**: discord.js v14
- **LLM**: Claude (claude-opus-4-5) / GPT-4o

---

## Roadmap

- [x] Discord Bot foundation
- [x] /task, /research, /create, /code commands
- [x] DM support (no mention needed)
- [x] Mention support (@Aude in servers)
- [x] LLM router (Claude + GPT-4o)
- [ ] File generation (PDF, Excel, PPT)
- [ ] Scheduled automation
- [x] External tool integrations (Notion, Google, GitHub)
- [ ] Approval flows
- [ ] Credit system + Stripe billing
- [ ] Web dashboard

---

## License

MIT (c) 2026 Aude AI
