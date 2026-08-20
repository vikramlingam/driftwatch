Introduction

The web is constantly changing, and that makes building reliable web scrapers much harder to extract data from a page. A scraper can work perfectly when you first build it, but a website redesign, a renamed CSS class, or a small change in the page structure can leave your pipeline returning incomplete or empty results.

That’s the problem we want you to solve in The Scrape-Verse Hackathon, which went live today and runs until August 23rd. WeMakeDevs and Bright Data are inviting developers, builders, and AI engineers to enter the Scrape-Verse and build web scrapers that don’t just collect data, but can also adapt, recover, and keep working when the web changes.

Why self-healing scrapers?

Websites constantly change as product pages are redesigned, documentation moves, and content structures evolve, which can easily break scrapers that rely on specific selectors even when the underlying data remains valuable.

Whether you're tracking prices, monitoring competitors, building a RAG knowledge base, or researching developer trends, the real challenge isn't just collecting data, but keeping the collection pipeline running reliably.

That's where self-healing comes in: instead of treating scraper maintenance as a future problem, build reliability into the scraper from day one.

Bright Data Scraper Studio

Bright Data Graph

Bright Data’s Scraper Studio is an AI-powered platform for turning web data requirements into ready-to-run scrapers. Instead of building and maintaining every scraper from scratch, developers can describe what data they need, generate scraper code with AI, test it in a hosted IDE, and run it at scale.

The platform handles much of the infrastructure that makes web scraping difficult, including proxies, browser rendering, CAPTCHA solving, retries, unblocking, scheduling, and data delivery.

Steps to build a custom scraper for any website

Scrape Verse Animated Graph

Using Bright Data Scraper Studio and its CLI, you can simplify building a web scraper from scratch. You can describe the data you want, let AI generate the scraper, run it directly from your terminal, and even self-heal it when the target website changes.

In this guide, we’ll walk through the complete process of building a custom scraper: from creating your first scraper to running it and fixing it when it breaks. You can follow these steps using your regular terminal or coding agents like Claude Code, Cursor, Codex, or VS Code.

Let's get started:

Step 1. Bright Data CLI

npx -p @brightdata/cli - Run the Bright Data CLI without installing it globally. No global installs and no dashboard hopping.

Step 2. Log in

bdata login - Connect your terminal to your Bright Data account.

bright data login

Step 3. Create the scraper

bdata scraper create <URL> "<data you need>" - Generate a scraper using AI from a URL and a simple description.

Create Scraper

Step 4. Run the scraper

bdata scraper run <COLLECTOR_ID> <URL> — Run the scraper and get structured data. Run the scraper

Step 5. Heal the scraper

bdata scraper heal <COLLECTOR_ID> "<what broke>" — Generate a fix when the website changes.

Heal the scraper

Step 6. Approve or reject the fix

bdata scraper approve <COLLECTOR_ID> - Approve the fix and update the existing scraper.

To discard the proposed fix and try a sharper prompt instead, reject it: bdata scraper approve c_mpohus372o5tmid1jk --reject - Approve the fix and update the existing scraper.

What can you build?

bulb sign image

The theme is open-ended so participants can build anything that uses Scraper Studio to turn websites into structured data.

A REPO FULL OF IDEAS TO START FROM
There's a companion repo for the hackathon with a collection of project ideas you can pick up and build on: scraper-studio-scrape-verse-hackathon-august-2026. Worth a browse before you commit to an idea.

Here are some project ideas, feel free to pick any one of these if you are out of ideas:

1. One-prompt scraper

Paste one prompt into your coding agent, point it at a site, and get clean JSON back with a bdata scraper create + bdata scraper run flow.

Then build something small on top: a CLI tool, a Discord bot, a simple dashboard. Perfect if this is your first scraper.

Scraper type: PDP or Discovery

2. Prompt-to-production pipeline

Have your agent build the scraper AND the pipeline that feeds it: a script that triggers the Collector ID via POST /dca/trigger, saves the JSON to S3 or a database, and runs on a schedule. One prompt, one PR, fresh data every night.

Scraper type: Discovery + PDP

3. Set-a-goal-and-walk-away automation

Give your agent a goal like "scrape this site every day at 3am and save results to storage" and let it plan, build, schedule, and verify the whole thing. Show off what agentic engineering can do end to end.

Scraper type: Discovery + PDP

4. Self-healing scraper (the hero project)

Every scraping tutorial ends when the scraper runs. Make yours start when it breaks. Build a scraper, break it (or catch a real site change), then run bdata scraper heal with a description of what broke, approve the fix, and re-run. Same Collector ID, no downstream code touched. Bonus: automate the whole heal loop.

Scraper type: any

5. Scrapers in CI, no humans

Put bdata scraper run inside GitHub Actions on a cron. When the target site changes, have claude -p run bdata scraper healautomatically and re-run the job. The dream: a scraper that fixes itself while you sleep, with a wall of green checks to prove it.

Scraper type: any

6. Docs site → RAG pipeline

Point a Sitemap scraper at any docs site and get every page as structured JSON. Chunk it, embed it, and build a "chat with these docs" app that answers questions with real citations. One prompt from docs site to queryable knowledge base.

Scraper type: Sitemap

7. Competitive intel pipeline

Scrape 3 to 5 competitor changelogs or release-notes pages weekly, diff the results against last week, and deliver the changes to your inbox, Slack, or Discord every Monday. A tool you'd genuinely keep using after the hackathon.

Scraper type: Sitemap

8. Keyword-powered agent (no URLs needed)

Use the Search scraper type: your agent gets data from just a keyword and optional country, no URL required. Build an AI agent that researches products, prices, jobs, or listings on demand from a plain-English request.

Scraper type: Search

9. Parallel subagents battle

Spin up 3 subagents in 3 git worktrees, each building a scraper for a different site, then have a fourth agent judge the outputs and ship the winner. The flex project for multi-agent orchestration fans.

Scraper type: any

Best practices

1. Build for the long tail
Bright Data already has 800+ pre-built scrapers for popular sites. Pick a target that doesn't already have one, like regional e-commerce, B2B catalogs, niche sites, documentation, or competitor changelogs. If the obvious question is “Why not use a pre-built scraper?”, choose a different target.

2. Keep the terminal as your UI
Build from your coding agent, Claude Code, Cursor, or Codex. Use the dashboard only to check your Collector ID or configure a schedule.

3. Show self-healing in action
The key differentiator is owning the scraper code while AI can repair it when a website changes. Use bdata scraper heal in your demo to show the scraper recovering without breaking your workflow.

4. Scrape public data only
Stick to publicly available pages. No login-walled sites, paywalled content, or personal data. Never expose API tokens or .env files in your repo or demo.

5. Use the Collector ID as an API
Every scraper gets a c_* Collector ID that you can trigger via POST /dca/trigger. Connect it to something real, such as a cron job, database, agent, or dashboard, to show how your scraper fits into a larger workflow.

RULES
Everything you're held to
Read these before you start building. Registering for Into the Scrape-Verse means agreeing to all of them, along with the WeMakeDevs Code of Conduct.
1.
You can take part online from anywhere in the world, or join us in person on August 22 in San Francisco if you're in the city.*
2.
You can participate solo or in a team of up to 4 members. Each participant may only be part of one team.
3.
Required technology: your project must use Bright Data Scraper Studio to create and run a custom web scraper.
4.
The challenge is open-ended. You may build an application, automation, research platform, developer tool, data pipeline, AI product, or any other useful project powered by web data.
5.
Using only an existing scraper from the Bright Data Scrapers Library will not qualify. Your submission must include a custom scraper created using Scraper Studio.
6.
Your project must use publicly available web data. Do not collect private, login-protected, paywalled, personal, or restricted information.
7.
Scraping government websites is not allowed during this hackathon. Scraper Studio will not work on them, so pick a different target.
8.
The main coding and design work must begin after the hackathon starts. You may discuss ideas, create notes, plan the architecture, or prepare diagrams beforehand.
9.
You may use frameworks, open-source libraries, public APIs, templates, third-party tools, and publicly available assets. The original work completed during the hackathon will be judged.
10.
Every submission must include:
A public source-code repository
A clear README
Example structured output
A demo video showing the working project
A clear explanation of how Bright Data Scraper Studio is used
11.
AI coding assistants are allowed, but their use must be disclosed.
12.
Participants must understand the submitted code and be able to explain the scraper, project architecture, and technical decisions.
13.
Projects that are entirely generated using AI without meaningful participant contribution, verification, or technical understanding may be rejected.
14.
The Suit-Up and Spider-Sense tracks award their prize to every member of the winning team. The Web-Slinger grand prize is a single NVIDIA DGX Spark, awarded to the winning team. The Daily Bugle track is judged on a post rather than a project, so its prize goes to the one person who wrote it.
15.
The raffle is drawn from all valid registrations after submissions close, and the draw is final. The Daily Bugle prize goes to one participant: post about your build on LinkedIn during the hackathon and tag WeMakeDevs. Posts on other platforms are not judged for it.
16.
Any intellectual property developed during the hackathon belongs to the participant or team that created it. Teams are encouraged to agree internally on ownership before submitting.
17.
Treat participants, organisers, sponsors, speakers, judges, and community members with respect.
18.
Harassment, discrimination, plagiarism, or attempts to manipulate the judging process will result in disqualification.
19.
Failure to follow these rules or the WeMakeDevs Code of Conduct may result in disqualification.
*
Bright Data's platform is not accessible in Pakistan and Iran, so the hackathon is not open to participants in those two countries.