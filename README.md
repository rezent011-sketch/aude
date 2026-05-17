# Aude — Your AI Coworker in Discord

**Aude** is an autonomous AI coworker that lives in your Discord server. Delegate real work — research, coding, content creation, automation — and get finished results, not suggestions.

> The Discord-native alternative to Roman AI.

---

## What Aude Can Do

- 🔍 **Deep Research** — Investigate competitors, markets, or leads
- 💻 **Write & Run Code** — Build features, fix bugs, review PRs
- 🌐 **Browser Automation** — Scrape, monitor, and interact with any website
- 📅 **Scheduled Automation** — Set recurring tasks that run on autopilot
- 📁 **Reports & Files** — Generate PDFs, Excel, PowerPoint from any data
- ✍️ **Create & Publish** — Write content, generate LPs, draft campaigns
- 🔗 **3,000+ Integrations** — Connect to Notion, Google, GitHub, Stripe, and more
- ✅ **Approval Flows** — Human-in-the-loop for sensitive actions

---

## Usage

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
/task    — Run any task
/research — Deep research on any topic
/create   — Generate content, LPs, documents
/code     — Write and execute code
/build    — Build web apps and tools
/schedule — Set up recurring automations
/credits  — Check your credit balance
```

---

## Getting Started

1. **Invite Aude** to your Discord server → [Invite Link](#)
2. **Get credits** at [aude.ai](#) (Free plan available)
3. **Start working** — just talk to Aude like a coworker

---

## Self-Hosting

```bash
git clone https://github.com/rezent011-sketch/aude
cd aude
npm install
cp .env.example .env
# Add your API keys to .env
npm run dev
```

---

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Discord**: discord.js v14
- **LLM**: Claude / GPT-4o / Gemini (via LiteLLM)
- **Browser**: Playwright
- **Payments**: Stripe
- **DB**: PostgreSQL + Redis

---

## Roadmap

- [x] Discord Bot foundation
- [ ] /task, /research, /create, /code commands
- [ ] DM support (no mention needed)
- [ ] File generation (PDF, Excel, PPT)
- [ ] Scheduled automation
- [ ] External tool integrations (Notion, Google, GitHub)
- [ ] Approval flows
- [ ] Credit system + Stripe billing
- [ ] Web dashboard

---

## License

MIT © 2026 Aude AI
