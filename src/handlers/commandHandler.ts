// src/handlers/commandHandler.ts — Load and register slash commands
import { Client, Collection, REST, Routes } from 'discord.js';
import { taskCommand } from '../commands/task';
import { jobCommand } from '../commands/job';
import { approveTaskCommand } from '../commands/approveTask';
import { researchCommand } from '../commands/research';
import { createCommand } from '../commands/create';
import { codeCommand } from '../commands/code';
import { creditsCommand } from '../commands/credits';
import { planCommand } from '../commands/plan';
import { subscribeCommand } from '../commands/subscribe';
import { exportCommand } from '../commands/export';
import { reportCommand } from '../commands/report';
import { scheduleCommand } from '../commands/schedule';
import { notionCommand } from '../commands/notion';
import { googleCommand } from '../commands/google';
import { githubCommand } from '../commands/github';
import { gitlabCommand } from '../commands/gitlab';
import { linearCommand } from '../commands/linear';
import { jiraCommand } from '../commands/jira';
import { backlogCommand } from '../commands/backlog';
import { trelloCommand } from '../commands/trello';
import { asanaCommand } from '../commands/asana';
import { pendingCommand } from '../commands/pending';
import { configCommand } from '../commands/config';
import { analyticsCommand } from '../commands/analytics';
import { memoryCommand } from '../commands/memory';
import { tmemoryCommand } from '../commands/tmemory';
import { browseCommand } from '../commands/browse';
import { alertCommand } from '../commands/alert';
import { vaultCommand } from '../commands/vault';
import { chatworkCommand } from '../commands/chatwork';
import { moneyforwardCommand } from '../commands/moneyforward';
import { slackCommand } from '../commands/slack';
import { calendlyCommand } from '../commands/calendly';
import { googleanalyticsCommand } from '../commands/googleanalytics';
import { metaadsCommand } from '../commands/metaads';
import { teamsCommand } from '../commands/teams';
import { tiktokadsCommand } from '../commands/tiktokads';
import { outlookCommand } from '../commands/outlook';
import { onedriveCommand } from '../commands/onedrive';
import { boxCommand } from '../commands/box';
import { dropboxCommand } from '../commands/dropbox';
import { confluenceCommand } from '../commands/confluence';
import { airtableCommand } from '../commands/airtable';
import { mondayCommand } from '../commands/monday';
import { clickupCommand } from '../commands/clickup';
import { twilioCommand } from '../commands/twilio';
import { sendgridCommand } from '../commands/sendgrid';
import { zendeskCommand } from '../commands/zendesk';
import { intercomCommand } from '../commands/intercom';
import { freshdeskCommand } from '../commands/freshdesk';
import { storesCommand } from '../commands/stores';
import { baseCommand } from '../commands/base';
import { shopifyCommand } from '../commands/shopify';
import { paypayCommand } from '../commands/paypay';
import { squareCommand } from '../commands/square';
import { cloudsignCommand } from '../commands/cloudsign';
import { docusignCommand } from '../commands/docusign';
import { jobcanCommand } from '../commands/jobcan';
import { cybozuCommand } from '../commands/cybozu';
import { talentioCommand } from '../commands/talentio';
import { sansanCommand } from '../commands/sansan';
import { zoomCommand } from '../commands/zoom';
import { pagerdutyCommand } from '../commands/pagerduty';
import { datadogCommand } from '../commands/datadog';
import { freeeCommand } from '../commands/freee';
import { freeehrCommand } from '../commands/freeehr';
import { freeesignCommand } from '../commands/freeesign';
import { gmoagreeCommand } from '../commands/gmoagree';
import { kintoneCommand } from '../commands/kintone';
import { lineworksCommand } from '../commands/lineworks';
import { imageCommand } from '../commands/image';
import { lineCommand } from '../commands/line';
import { rakumoCommand } from '../commands/rakumo';
import { lstepCommand } from '../commands/lstep';
import { elmeCommand } from '../commands/elme';
import { utageCommand } from '../commands/utage';
import { lmessageCommand } from '../commands/lmessage';
import { smarthrCommand } from '../commands/smarthr';
import { videoCommand } from '../commands/video';
import { websiteCommand } from '../commands/website';
import { kingofthymeCommand } from '../commands/kingofthyme';
import { yayoiCommand } from '../commands/yayoi';
import { wantedlyCommand } from '../commands/wantedly';
import { receptionistCommand } from '../commands/receptionist';
import { mfpayrollCommand } from '../commands/mfpayroll';
import { stripeapiCommand } from '../commands/stripeapi';
import { typeformCommand } from '../commands/typeform';
import { salesforceCommand } from '../commands/salesforce';
import { pipedriveCommand } from '../commands/pipedrive';
import { activecampaignCommand } from '../commands/activecampaign';
import {
  aiCommand,
  canvaCommand,
  driveCommand,
  figmaCommand,
  firefliesCommand,
  gmailCommand,
  hubspotCommand,
  sheetsCommand,
  vercelCommand,
} from '../commands/integrations';

export interface Command {
  data: {
    name: string;
    toJSON(): object;
  };
  execute: (interaction: any) => Promise<void>;
}

const commands: Command[] = [
  taskCommand,
  jobCommand,
  approveTaskCommand,
  pendingCommand,
  researchCommand,
  createCommand,
  codeCommand,
  creditsCommand,
  subscribeCommand,
  planCommand,
  exportCommand,
  reportCommand,
  scheduleCommand,
  notionCommand,
  googleCommand,
  githubCommand,
  gitlabCommand,
  linearCommand,
  jiraCommand,
  backlogCommand,
  trelloCommand,
  asanaCommand,
  gmailCommand,
  sheetsCommand,
  driveCommand,
  hubspotCommand,
  vercelCommand,
  firefliesCommand,
  canvaCommand,
  figmaCommand,
  aiCommand,
  configCommand,
  analyticsCommand,
  memoryCommand,
  tmemoryCommand,
  browseCommand,
  alertCommand,
  chatworkCommand,
  moneyforwardCommand,
  slackCommand,
  calendlyCommand,
  googleanalyticsCommand,
  metaadsCommand,
  teamsCommand,
  outlookCommand,
  onedriveCommand,
  boxCommand,
  dropboxCommand,
  confluenceCommand,
  airtableCommand,
  mondayCommand,
  clickupCommand,
  twilioCommand,
  sendgridCommand,
  zendeskCommand,
  intercomCommand,
  freshdeskCommand,
  storesCommand,
  baseCommand,
  shopifyCommand,
  paypayCommand,
  squareCommand,
  cloudsignCommand,
  docusignCommand,
  jobcanCommand,
  cybozuCommand,
  talentioCommand,
  sansanCommand,
  zoomCommand,
  pagerdutyCommand,
  datadogCommand,
  kintoneCommand,
  lineworksCommand,
  freeeCommand,
  freeehrCommand,
  freeesignCommand,
  gmoagreeCommand,
  smarthrCommand,
  vaultCommand,
  imageCommand,
  lineCommand,
  rakumoCommand,
  lstepCommand,
  elmeCommand,
  utageCommand,
  lmessageCommand,
  kingofthymeCommand,
  yayoiCommand,
  wantedlyCommand,
  receptionistCommand,
  mfpayrollCommand,
  stripeapiCommand,
  typeformCommand,
  salesforceCommand,
  pipedriveCommand,
  activecampaignCommand,
  tiktokadsCommand,
  videoCommand,
  websiteCommand,
];

export async function loadCommands(client: Client): Promise<void> {
  const collection = (client as any).commands as Collection<string, Command>;

  for (const command of commands) {
    collection.set(command.data.name, command);
    console.log(`📌 Loaded command: /${command.data.name}`);
  }

  console.log(`✅ Loaded ${commands.length} commands`);
}

export async function registerCommandsToDiscord(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID are required');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const commandData = commands.map((cmd) => cmd.data.toJSON());

  console.log('🔄 Registering slash commands with Discord...');

  if (process.env.DISCORD_GUILD_ID) {
    // Guild-specific registration (instant, for development)
    await rest.put(
      Routes.applicationGuildCommands(clientId, process.env.DISCORD_GUILD_ID),
      { body: commandData }
    );
    console.log(`✅ Registered ${commandData.length} commands to guild ${process.env.DISCORD_GUILD_ID}`);
  } else {
    // Global registration (takes up to 1 hour to propagate)
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log(`✅ Registered ${commandData.length} global commands`);
  }
}
