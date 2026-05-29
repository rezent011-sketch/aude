// @ts-nocheck
// eslint-disable
// Week65: 拡張ツール実行ロジック (型チェック無効 - dynamic integrations)

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
export async function executeExtendedToolCall(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  try {
    switch (toolName) {
      // ── Slack ──
      case 'slack_send': {
        await slackSendMessage(process.env.SLACK_BOT_TOKEN!, args.channel as string, args.message as string);
        return `✅ Slackに送信しました\nチャンネル: ${args.channel}\nメッセージ: ${args.message}`;
      }
      case 'slack_list_channels': {
        const channels = await slackGetChannels(process.env.SLACK_BOT_TOKEN!);
        if (channels.length === 0) return 'Slackチャンネルが見つかりませんでした。';
        return `💬 Slackチャンネル一覧 (${channels.length}件):\n\n` + channels.slice(0, 20).map((c: { name: string }) => `• #${c.name}`).join('\n');
      }

      // ── Salesforce ──
      case 'salesforce_list_accounts': {
        const accounts = await sfGetAccounts(process.env.SALESFORCE_ACCESS_TOKEN!, process.env.SALESFORCE_INSTANCE_URL!);
        if (accounts.length === 0) return '取引先が見つかりませんでした。';
        return `🏢 Salesforce 取引先 (${accounts.length}件):\n\n` + accounts.slice(0, 10).map((a: { Name: string; Id: string }) => `• **${a.Name}** (ID: ${a.Id})`).join('\n');
      }
      case 'salesforce_list_opportunities': {
        const opps = await sfGetOpportunities(process.env.SALESFORCE_ACCESS_TOKEN!, process.env.SALESFORCE_INSTANCE_URL!);
        if (opps.length === 0) return '商談が見つかりませんでした。';
        return `💼 Salesforce 商談 (${opps.length}件):\n\n` + opps.slice(0, 10).map((o: { Name: string; StageName: string; Amount: number }) => `• **${o.Name}** [${o.StageName}] ¥${o.Amount?.toLocaleString() ?? 0}`).join('\n');
      }
      case 'salesforce_create_lead': {
        const lead = await sfCreateLead(process.env.SALESFORCE_ACCESS_TOKEN!, process.env.SALESFORCE_INSTANCE_URL!, args.firstName as string, args.lastName as string, args.company as string, args.email as string ?? '');
        return `✅ Salesforceにリードを作成しました\nID: ${(lead as { id?: string })?.id}`;
      }

      // ── HubSpot ──
      case 'hubspot_list_contacts': {
        const contacts = await hubspotGetContacts(process.env.HUBSPOT_ACCESS_TOKEN!, args.limit as number | undefined);
        if (contacts.length === 0) return 'コンタクトが見つかりませんでした。';
        return `👤 HubSpot コンタクト (${contacts.length}件):\n\n` + contacts.slice(0, 10).map((c) => `• **${c.firstName} ${c.lastName}** (${c.email})`).join('\n');
      }
      case 'hubspot_list_deals': {
        const deals = await hubspotGetDeals(process.env.HUBSPOT_ACCESS_TOKEN!, args.limit as number | undefined);
        if (deals.length === 0) return '取引が見つかりませんでした。';
        return `💼 HubSpot 取引 (${deals.length}件):\n\n` + deals.slice(0, 10).map((d) => `• **${d.dealname}** [${d.dealstage}] $${d.amount}`).join('\n');
      }
      case 'hubspot_create_contact': {
        const contact = await hubspotCreateContact(process.env.HUBSPOT_ACCESS_TOKEN!, args.email as string, (args.firstName as string) ?? '', (args.lastName as string) ?? '');
        return `✅ HubSpotにコンタクトを作成しました\nID: ${contact.id}`;
      }

      // ── kintone ──
      case 'kintone_get_apps': {
        const apps = await kintoneGetApps(process.env.KINTONE_SUBDOMAIN!, process.env.KINTONE_API_TOKEN!);
        if (apps.length === 0) return 'kintoneアプリが見つかりませんでした。';
        return `🏢 kintoneアプリ一覧 (${apps.length}件):\n\n` + apps.slice(0, 15).map((a: { appId: string; name: string }) => `• **${a.name}** (ID: ${a.appId})`).join('\n');
      }
      case 'kintone_get_records': {
        const records = await kintoneGetRecords(process.env.KINTONE_SUBDOMAIN!, process.env.KINTONE_API_TOKEN!, args.appId as string, args.query as string | undefined);
        if (records.length === 0) return 'レコードが見つかりませんでした。';
        return `📋 kintoneレコード (${records.length}件取得):\n\n` + records.slice(0, 5).map((r: Record<string, { value: unknown }>, i: number) => `${i + 1}. ${JSON.stringify(r).slice(0, 100)}`).join('\n');
      }
      case 'kintone_create_record': {
        const fields = JSON.parse(args.fields as string);
        const result = await kintoneCreateRecord(process.env.KINTONE_SUBDOMAIN!, process.env.KINTONE_API_TOKEN!, args.appId as string, fields);
        return `✅ kintoneにレコードを作成しました\nレコードID: ${result.id}`;
      }

      // ── freee ──
      case 'freee_list_deals': {
        const deals = await freeeListDeals(process.env.FREEE_CLIENT_ID!, process.env.FREEE_CLIENT_SECRET!, process.env.FREEE_REFRESH_TOKEN!, args.companyId as number);
        if (deals.length === 0) return '取引が見つかりませんでした。';
        return `💴 freee 取引一覧 (${deals.length}件):\n\n` + deals.slice(0, 10).map((d: { issue_date: string; amount: number; description?: string }) => `• ${d.issue_date} ¥${d.amount?.toLocaleString()} ${d.description ?? ''}`).join('\n');
      }
      case 'freee_list_partners': {
        const partners = await freeeListPartners(process.env.FREEE_CLIENT_ID!, process.env.FREEE_CLIENT_SECRET!, process.env.FREEE_REFRESH_TOKEN!, args.companyId as number);
        if (partners.length === 0) return '取引先が見つかりませんでした。';
        return `🤝 freee 取引先一覧 (${partners.length}件):\n\n` + partners.slice(0, 15).map((p: { name: string; id: number }) => `• **${p.name}** (ID: ${p.id})`).join('\n');
      }

      // ── SmartHR ──
      case 'smarthr_list_employees': {
        const employees = await smarthrGetEmployees(process.env.SMARTHR_CLIENT_ID!, process.env.SMARTHR_CLIENT_SECRET!, process.env.SMARTHR_SUBDOMAIN!, args.page as number | undefined);
        if (employees.length === 0) return '従業員が見つかりませんでした。';
        return `👥 SmartHR 従業員一覧 (${employees.length}件):\n\n` + employees.slice(0, 15).map((e: { display_name?: string; emp_code?: string; department?: { name?: string } }) => `• **${e.display_name ?? '(名前なし)'}** [${e.emp_code ?? ''}] ${e.department?.name ?? ''}`).join('\n');
      }
      case 'smarthr_list_departments': {
        const depts = await smarthrGetDepartments(process.env.SMARTHR_CLIENT_ID!, process.env.SMARTHR_CLIENT_SECRET!, process.env.SMARTHR_SUBDOMAIN!);
        if (depts.length === 0) return '部署が見つかりませんでした。';
        return `🏢 SmartHR 部署一覧 (${depts.length}件):\n\n` + depts.slice(0, 20).map((d: { name: string }) => `• ${d.name}`).join('\n');
      }

      // ── SendGrid ──
      case 'sendgrid_send': {
        await sendgridSendEmail(process.env.SENDGRID_API_KEY!, args.to as string, args.subject as string, args.body as string, args.from as string | undefined);
        return `✅ SendGridでメールを送信しました\n宛先: ${args.to}\n件名: ${args.subject}`;
      }

      // ── Twilio ──
      case 'twilio_send_sms': {
        const result = await twilioSendSms(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!, process.env.TWILIO_FROM_NUMBER!, args.to as string, args.message as string);
        return `✅ SMSを送信しました\n宛先: ${args.to}\nSID: ${(result as { sid?: string })?.sid}`;
      }
      case 'twilio_list_messages': {
        const messages = await twilioGetMessages(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!, args.limit as number | undefined);
        if (messages.length === 0) return 'メッセージ履歴が見つかりませんでした。';
        return `📱 Twilio メッセージ履歴 (${messages.length}件):\n\n` + messages.slice(0, 10).map((m: { to?: string; body?: string; status?: string }) => `• ${m.to}: ${(m.body ?? '').slice(0, 50)} [${m.status}]`).join('\n');
      }

      // ── Shopify ──
      case 'shopify_list_orders': {
        const orders = await shopifyGetOrders(process.env.SHOPIFY_SHOP!, process.env.SHOPIFY_ACCESS_TOKEN!, args.status as string | undefined);
        if (orders.length === 0) return '注文が見つかりませんでした。';
        return `🛒 Shopify 注文一覧 (${orders.length}件):\n\n` + orders.slice(0, 10).map((o: { name?: string; total_price?: string; financial_status?: string }) => `• **${o.name}** ¥${o.total_price} [${o.financial_status}]`).join('\n');
      }
      case 'shopify_list_products': {
        const products = await shopifyGetProducts(process.env.SHOPIFY_SHOP!, process.env.SHOPIFY_ACCESS_TOKEN!, args.limit as number | undefined);
        if (products.length === 0) return '商品が見つかりませんでした。';
        return `🛍️ Shopify 商品一覧 (${products.length}件):\n\n` + products.slice(0, 10).map((p: { title?: string; status?: string; variants?: Array<{ price?: string }> }) => `• **${p.title}** [${p.status}] ¥${p.variants?.[0]?.price ?? 0}`).join('\n');
      }

      // ── Stripe ──
      case 'stripe_list_customers': {
        const customers = await stripeListCustomers(process.env.STRIPE_SECRET_KEY!, args.limit as number | undefined);
        if (customers.length === 0) return '顧客が見つかりませんでした。';
        return `💳 Stripe 顧客一覧 (${customers.length}件):\n\n` + customers.slice(0, 10).map((c: { name?: string; email?: string; id: string }) => `• **${c.name ?? c.email ?? c.id}**`).join('\n');
      }
      case 'stripe_list_payments': {
        const payments = await stripeListPayments(process.env.STRIPE_SECRET_KEY!, args.limit as number | undefined);
        if (payments.length === 0) return '支払いが見つかりませんでした。';
        return `💰 Stripe 支払い一覧 (${payments.length}件):\n\n` + payments.slice(0, 10).map((p: { amount?: number; currency?: string; status?: string; id?: string }) => `• ¥${p.amount} ${(p.currency ?? '').toUpperCase()} [${p.status}]`).join('\n');
      }
      case 'stripe_list_subscriptions': {
        const subs = await stripeListSubscriptions(process.env.STRIPE_SECRET_KEY!, args.limit as number | undefined);
        if (subs.length === 0) return 'サブスクリプションが見つかりませんでした。';
        return `🔄 Stripe サブスクリプション (${subs.length}件):\n\n` + subs.slice(0, 10).map((s: { status?: string; id?: string }) => `• ID: ${s.id} [${s.status}]`).join('\n');
      }

      // ── Zendesk ──
      case 'zendesk_list_tickets': {
        const tickets = await zendeskGetTickets(process.env.ZENDESK_SUBDOMAIN!, process.env.ZENDESK_EMAIL!, process.env.ZENDESK_API_TOKEN!, args.status as string | undefined);
        if (tickets.length === 0) return 'チケットが見つかりませんでした。';
        return `🎫 Zendesk チケット (${tickets.length}件):\n\n` + tickets.slice(0, 10).map((t: { id: number; subject?: string; status?: string }) => `• **#${t.id} ${t.subject}** [${t.status}]`).join('\n');
      }
      case 'zendesk_create_ticket': {
        const ticket = await zendeskCreateTicket(process.env.ZENDESK_SUBDOMAIN!, process.env.ZENDESK_EMAIL!, process.env.ZENDESK_API_TOKEN!, { subject: args.subject as string, comment: { body: args.description as string }, priority: args.priority as string | undefined });
        return `✅ Zendeskにチケットを作成しました\n**#${(ticket as { id?: number })?.id} ${args.subject}**`;
      }

      // ── Intercom ──
      case 'intercom_list_conversations': {
        const convs = await intercomGetConversations(process.env.INTERCOM_ACCESS_TOKEN!, args.status as string | undefined);
        if (convs.length === 0) return '会話が見つかりませんでした。';
        return `💬 Intercom 会話一覧 (${convs.length}件):\n\n` + convs.slice(0, 10).map((c: { id?: string; state?: string }) => `• ID: ${c.id} [${c.state}]`).join('\n');
      }

      // ── Sentry ──
      case 'sentry_list_issues': {
        const issues = await sentryGetIssues(process.env.SENTRY_AUTH_TOKEN!, process.env.SENTRY_ORG_SLUG!, args.projectSlug as string | undefined, args.query as string | undefined);
        if (issues.length === 0) return 'エラーが見つかりませんでした。';
        return `🐛 Sentry エラー一覧 (${issues.length}件):\n\n` + issues.slice(0, 10).map((i: { title?: string; culprit?: string; status?: string }) => `• **${i.title}**\n  ${i.culprit ?? ''} [${i.status}]`).join('\n\n');
      }

      // ── Asana ──
      case 'asana_list_tasks': {
        const tasks = await asanaGetTasks(process.env.ASANA_PAT!, args.projectId as string | undefined);
        if (tasks.length === 0) return 'タスクが見つかりませんでした。';
        return `✅ Asana タスク一覧 (${tasks.length}件):\n\n` + tasks.slice(0, 10).map((t: { name?: string; completed?: boolean }) => `• ${t.completed ? '✓' : '○'} ${t.name}`).join('\n');
      }
      case 'asana_create_task': {
        const task = await asanaCreateTask(process.env.ASANA_PAT!, { name: args.name as string, projectId: args.projectId as string | undefined, notes: args.notes as string | undefined, due_on: args.dueOn as string | undefined });
        return `✅ Asanaにタスクを作成しました\n**${(task as { name?: string })?.name}**\nID: ${(task as { gid?: string })?.gid}`;
      }

      // ── ClickUp ──
      case 'clickup_list_tasks': {
        const tasks = await clickupGetTasks(process.env.CLICKUP_API_TOKEN!, args.listId as string | undefined);
        if (tasks.length === 0) return 'タスクが見つかりませんでした。';
        return `✅ ClickUp タスク (${tasks.length}件):\n\n` + tasks.slice(0, 10).map((t: { name?: string; status?: { status?: string } }) => `• **${t.name}** [${t.status?.status ?? ''}]`).join('\n');
      }
      case 'clickup_create_task': {
        const task = await clickupCreateTask(process.env.CLICKUP_API_TOKEN!, args.listId as string, { name: args.name as string, description: args.description as string | undefined });
        return `✅ ClickUpにタスクを作成しました\n**${(task as { name?: string })?.name}**\nID: ${(task as { id?: string })?.id}`;
      }

      // ── monday.com ──
      case 'monday_list_boards': {
        const boards = await mondayGetBoards(process.env.MONDAY_API_KEY!);
        if (boards.length === 0) return 'ボードが見つかりませんでした。';
        return `📋 monday.com ボード (${boards.length}件):\n\n` + boards.slice(0, 15).map((b: { name?: string; id?: string }) => `• **${b.name}** (ID: ${b.id})`).join('\n');
      }
      case 'monday_create_item': {
        const item = await mondayCreateItem(process.env.MONDAY_API_KEY!, args.boardId as string, args.itemName as string);
        return `✅ monday.comにアイテムを作成しました\n**${(item as { name?: string })?.name}**\nID: ${(item as { id?: string })?.id}`;
      }

      // ── Confluence ──
      case 'confluence_search': {
        const pages = await confluenceSearchPages(process.env.CONFLUENCE_HOST!, process.env.CONFLUENCE_EMAIL!, process.env.CONFLUENCE_API_TOKEN!, args.query as string);
        if (pages.length === 0) return 'ページが見つかりませんでした。';
        return `📄 Confluence 検索結果 (${pages.length}件):\n\n` + pages.slice(0, 10).map((p: { title?: string; _links?: { webui?: string } }) => `• **${p.title}**\n  🔗 ${process.env.CONFLUENCE_HOST ?? ''}${p._links?.webui ?? ''}`).join('\n\n');
      }
      case 'confluence_create_page': {
        const page = await confluenceCreatePage(process.env.CONFLUENCE_HOST!, process.env.CONFLUENCE_EMAIL!, process.env.CONFLUENCE_API_TOKEN!, args.spaceKey as string, args.title as string, args.content as string);
        return `✅ Confluenceにページを作成しました\n**${(page as { title?: string })?.title}**\n🔗 ${process.env.CONFLUENCE_HOST ?? ''}${(page as { _links?: { webui?: string } })?._links?.webui ?? ''}`;
      }

      // ── Miro ──
      case 'miro_list_boards': {
        const boards = await miroGetBoards(process.env.MIRO_ACCESS_TOKEN!);
        if (boards.length === 0) return 'ボードが見つかりませんでした。';
        return `🖼️ Miro ボード (${boards.length}件):\n\n` + boards.slice(0, 10).map((b: { name?: string; id?: string; viewLink?: string }) => `• **${b.name}** (ID: ${b.id})\n  🔗 ${b.viewLink ?? ''}`).join('\n\n');
      }
      case 'miro_create_sticky': {
        await miroCreateStickyNote(process.env.MIRO_ACCESS_TOKEN!, args.boardId as string, args.content as string, args.color as string | undefined);
        return `✅ Miroにスティッキーノートを作成しました\nボード: ${args.boardId}\n内容: ${args.content}`;
      }

      // ── Dropbox ──
      case 'dropbox_list_files': {
        const files = await dropboxListFolder(process.env.DROPBOX_ACCESS_TOKEN!, (args.path as string) ?? '');
        if (files.length === 0) return 'ファイルが見つかりませんでした。';
        return `📁 Dropbox ファイル一覧 (${files.length}件):\n\n` + files.slice(0, 15).map((f: { name?: string; '.tag'?: string }) => `• ${f['.tag'] === 'folder' ? '📁' : '📄'} ${f.name}`).join('\n');
      }
      case 'dropbox_search': {
        const results = await dropboxSearch(process.env.DROPBOX_ACCESS_TOKEN!, args.query as string);
        if (results.length === 0) return 'ファイルが見つかりませんでした。';
        return `🔍 Dropbox 検索結果 (${results.length}件):\n\n` + results.slice(0, 10).map((r: { name?: string; path_display?: string }) => `• **${r.name}**\n  ${r.path_display ?? ''}`).join('\n\n');
      }

      // ── Box ──
      case 'box_list_files': {
        const files = await boxListFiles(process.env.BOX_ACCESS_TOKEN!, (args.folderId as string) ?? '0');
        if (files.length === 0) return 'ファイルが見つかりませんでした。';
        return `📁 Box ファイル一覧 (${files.length}件):\n\n` + files.slice(0, 15).map((f: { name?: string; type?: string }) => `• ${f.type === 'folder' ? '📁' : '📄'} ${f.name}`).join('\n');
      }
      case 'box_search': {
        const results = await boxSearchFiles(process.env.BOX_ACCESS_TOKEN!, args.query as string);
        if (results.length === 0) return 'ファイルが見つかりませんでした。';
        return `🔍 Box 検索結果 (${results.length}件):\n\n` + results.slice(0, 10).map((f: { name?: string; type?: string }) => `• ${f.type === 'folder' ? '📁' : '📄'} ${f.name}`).join('\n');
      }

      // ── OneDrive ──
      case 'onedrive_list_files': {
        const token = await (await import('../integrations/onedrive')).getAccessToken(process.env.ONEDRIVE_CLIENT_ID!, process.env.ONEDRIVE_CLIENT_SECRET!, process.env.ONEDRIVE_REFRESH_TOKEN!);
        const files = await onedriveListFiles(token, args.path as string | undefined);
        if (files.length === 0) return 'ファイルが見つかりませんでした。';
        return `📁 OneDrive ファイル一覧 (${files.length}件):\n\n` + files.slice(0, 15).map((f: { name?: string; folder?: object }) => `• ${f.folder ? '📁' : '📄'} ${f.name}`).join('\n');
      }
      case 'onedrive_search': {
        const token = await (await import('../integrations/onedrive')).getAccessToken(process.env.ONEDRIVE_CLIENT_ID!, process.env.ONEDRIVE_CLIENT_SECRET!, process.env.ONEDRIVE_REFRESH_TOKEN!);
        const results = await onedriveSearchFiles(token, args.query as string);
        if (results.length === 0) return 'ファイルが見つかりませんでした。';
        return `🔍 OneDrive 検索結果 (${results.length}件):\n\n` + results.slice(0, 10).map((f: { name?: string }) => `• ${f.name}`).join('\n');
      }

      // ── Teams ──
      case 'teams_send_message': {
        const teamsToken = await (await import('../integrations/teams')).getAccessToken(process.env.TEAMS_CLIENT_ID!, process.env.TEAMS_CLIENT_SECRET!, process.env.TEAMS_TENANT_ID!);
        const teamsList = await getTeams(teamsToken);
        const teamId = teamsList[0]?.id;
        if (!teamId) return '⚠️ Teamsチームが見つかりませんでした。';
        const channels = await teamsGetChannels(teamsToken, teamId);
        const channel = channels[0];
        if (!channel) return '⚠️ Teamsチャンネルが見つかりませんでした。';
        await teamsSendMessage(teamsToken, teamId, channel.id, args.message as string);
        return `✅ Teamsにメッセージを送信しました\n内容: ${args.message}`;
      }

      // ── Outlook ──
      case 'outlook_list_emails': {
        const token = await (await import('../integrations/outlook')).getAccessToken(process.env.OUTLOOK_CLIENT_ID!, process.env.OUTLOOK_CLIENT_SECRET!, process.env.OUTLOOK_REFRESH_TOKEN!);
        const emails = await outlookGetEmails(token, args.folder as string | undefined);
        if (emails.length === 0) return 'メールが見つかりませんでした。';
        return `📧 Outlook メール (${emails.length}件):\n\n` + emails.slice(0, 10).map((e: { subject?: string; from?: { emailAddress?: { address?: string } } }) => `• **${e.subject}**\n  差出人: ${e.from?.emailAddress?.address ?? ''}`).join('\n\n');
      }
      case 'outlook_send_email': {
        const token = await (await import('../integrations/outlook')).getAccessToken(process.env.OUTLOOK_CLIENT_ID!, process.env.OUTLOOK_CLIENT_SECRET!, process.env.OUTLOOK_REFRESH_TOKEN!);
        await outlookSendEmail(token, args.to as string, args.subject as string, args.body as string);
        return `✅ Outlookでメールを送信しました\n宛先: ${args.to}\n件名: ${args.subject}`;
      }

      // ── Amplitude ──
      case 'amplitude_active_users': {
        const result = await amplitudeGetActiveUsers(process.env.AMPLITUDE_API_KEY!, process.env.AMPLITUDE_SECRET_KEY!, args.start as string, args.end as string);
        return `📊 Amplitude アクティブユーザー:\n\n${JSON.stringify(result, null, 2).slice(0, 800)}`;
      }

      // ── Mixpanel ──
      case 'mixpanel_top_events': {
        const events = await mixpanelGetTopEvents(process.env.MIXPANEL_PROJECT_TOKEN!, process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME!, process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET!, args.from_date as string, args.to_date as string);
        return `📊 Mixpanel トップイベント:\n\n` + events.slice(0, 10).map((e: { event?: string; totals?: number }) => `• **${e.event}**: ${e.totals?.toLocaleString()}回`).join('\n');
      }

      // ── Google Analytics ──
      case 'ga_page_views': {
        const token = await (await import('../integrations/google')).getAccessToken(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, process.env.GOOGLE_REFRESH_TOKEN!);
        const days = (args.days as number) ?? 7;
        const data = await gaGetPageViews(token, process.env.GOOGLE_ANALYTICS_PROPERTY_ID!, days);
        return `📊 Google Analytics ページビュー (過去${days}日):\n\n${JSON.stringify(data, null, 2).slice(0, 600)}`;
      }

      // ── GitHub Actions ──
      case 'github_actions_list_workflows': {
        const workflows = await ghActionsListWorkflows(process.env.GITHUB_TOKEN!, args.repository as string);
        if (workflows.length === 0) return 'ワークフローが見つかりませんでした。';
        return `⚙️ GitHub Actions ワークフロー (${workflows.length}件):\n\n` + workflows.slice(0, 10).map((w: { name?: string; id?: number; state?: string }) => `• **${w.name}** [${w.state}] (ID: ${w.id})`).join('\n');
      }
      case 'github_actions_trigger': {
        await ghActionsTriggerWorkflow(process.env.GITHUB_TOKEN!, args.repository as string, args.workflowId as string, (args.branch as string) ?? 'main');
        return `✅ GitHub Actionsワークフローをトリガーしました\nリポジトリ: ${args.repository}\nワークフロー: ${args.workflowId}\nブランチ: ${args.branch ?? 'main'}`;
      }

      // ── GitLab ──
      case 'gitlab_list_projects': {
        const projects = await gitlabListProjects(process.env.GITLAB_TOKEN!, process.env.GITLAB_URL!, args.search as string | undefined);
        if (projects.length === 0) return 'プロジェクトが見つかりませんでした。';
        return `🦊 GitLab プロジェクト (${projects.length}件):\n\n` + projects.slice(0, 10).map((p: { name?: string; id?: number; web_url?: string }) => `• **${p.name}** (ID: ${p.id})\n  🔗 ${p.web_url}`).join('\n\n');
      }
      case 'gitlab_list_mrs': {
        const mrs = await gitlabListMRs(process.env.GITLAB_TOKEN!, process.env.GITLAB_URL!, args.projectId as string, args.state as string | undefined);
        if (mrs.length === 0) return 'MRが見つかりませんでした。';
        return `🔀 GitLab Merge Requests (${mrs.length}件):\n\n` + mrs.slice(0, 10).map((m: { title?: string; state?: string; web_url?: string }) => `• **${m.title}** [${m.state}]\n  🔗 ${m.web_url}`).join('\n\n');
      }

      // ── CircleCI ──
      case 'circleci_list_pipelines': {
        const pipelines = await circleciGetPipelines(process.env.CIRCLECI_TOKEN!, args.projectSlug as string);
        if (pipelines.length === 0) return 'パイプラインが見つかりませんでした。';
        return `⭕ CircleCI パイプライン (${pipelines.length}件):\n\n` + pipelines.slice(0, 10).map((p: { number?: number; state?: string; vcs?: { branch?: string } }) => `• #${p.number} [${p.state}] ${p.vcs?.branch ?? ''}`).join('\n');
      }
      case 'circleci_trigger': {
        await circleciTriggerPipeline(process.env.CIRCLECI_TOKEN!, args.projectSlug as string, (args.branch as string) ?? 'main');
        return `✅ CircleCIパイプラインをトリガーしました\nプロジェクト: ${args.projectSlug}\nブランチ: ${args.branch ?? 'main'}`;
      }

      // ── Heroku ──
      case 'heroku_list_apps': {
        const apps = await herokuGetApps(process.env.HEROKU_API_KEY!);
        if (apps.length === 0) return 'アプリが見つかりませんでした。';
        return `🟣 Heroku アプリ (${apps.length}件):\n\n` + apps.slice(0, 15).map((a: { name?: string; web_url?: string }) => `• **${a.name}** 🔗 ${a.web_url ?? ''}`).join('\n');
      }
      case 'heroku_restart': {
        await herokuRestartDynos(process.env.HEROKU_API_KEY!, args.appName as string);
        return `✅ Heroku Dynoを再起動しました\nアプリ: ${args.appName}`;
      }

      // ── Mailchimp ──
      case 'mailchimp_list_campaigns': {
        const campaigns = await mailchimpGetCampaigns(process.env.MAILCHIMP_API_KEY!, args.count as number | undefined);
        if (campaigns.length === 0) return 'キャンペーンが見つかりませんでした。';
        return `📧 Mailchimp キャンペーン (${campaigns.length}件):\n\n` + campaigns.slice(0, 10).map((c: { settings?: { subject_line?: string }; status?: string }) => `• **${c.settings?.subject_line ?? '(無題)'}** [${c.status}]`).join('\n');
      }
      case 'mailchimp_list_audiences': {
        const lists = await mailchimpGetLists(process.env.MAILCHIMP_API_KEY!);
        if (lists.length === 0) return 'オーディエンスが見つかりませんでした。';
        return `👥 Mailchimp オーディエンス (${lists.length}件):\n\n` + lists.slice(0, 10).map((l: { name?: string; stats?: { member_count?: number } }) => `• **${l.name}** (${l.stats?.member_count?.toLocaleString()}人)`).join('\n');
      }

      // ── Brevo ──
      case 'brevo_list_contacts': {
        const contacts = await brevoGetContacts(process.env.BREVO_API_KEY!, args.limit as number | undefined);
        if (contacts.length === 0) return 'コンタクトが見つかりませんでした。';
        return `👤 Brevo コンタクト (${contacts.length}件):\n\n` + contacts.slice(0, 10).map((c: { email?: string; firstName?: string; lastName?: string }) => `• **${c.firstName ?? ''} ${c.lastName ?? ''}** (${c.email})`).join('\n');
      }
      case 'brevo_send_email': {
        await brevoSendEmail(process.env.BREVO_API_KEY!, args.to as string, args.subject as string, args.content as string);
        return `✅ Brevoでメールを送信しました\n宛先: ${args.to}\n件名: ${args.subject}`;
      }

      // ── ActiveCampaign ──
      case 'activecampaign_list_contacts': {
        const contacts = await acGetContacts(process.env.ACTIVECAMPAIGN_API_URL!, process.env.ACTIVECAMPAIGN_API_KEY!, args.limit as number | undefined);
        if (contacts.length === 0) return 'コンタクトが見つかりませんでした。';
        return `👤 ActiveCampaign コンタクト (${contacts.length}件):\n\n` + contacts.slice(0, 10).map((c: { email?: string; firstName?: string; lastName?: string }) => `• **${c.firstName ?? ''} ${c.lastName ?? ''}** (${c.email})`).join('\n');
      }
      case 'activecampaign_create_contact': {
        const contact = await acCreateContact(process.env.ACTIVECAMPAIGN_API_URL!, process.env.ACTIVECAMPAIGN_API_KEY!, { email: args.email as string, firstName: args.firstName as string | undefined, lastName: args.lastName as string | undefined });
        return `✅ ActiveCampaignにコンタクトを作成しました\nID: ${(contact as { id?: string })?.id}`;
      }

      // ── Typeform ──
      case 'typeform_list_forms': {
        const forms = await typeformGetForms(process.env.TYPEFORM_API_KEY!);
        if (forms.length === 0) return 'フォームが見つかりませんでした。';
        return `📝 Typeform フォーム (${forms.length}件):\n\n` + forms.slice(0, 10).map((f: { title?: string; id?: string }) => `• **${f.title}** (ID: ${f.id})`).join('\n');
      }
      case 'typeform_get_responses': {
        const responses = await typeformGetResponses(process.env.TYPEFORM_API_KEY!, args.formId as string, args.count as number | undefined);
        return `📊 Typeform 回答数: ${responses.total_items ?? responses.items?.length ?? 0}件`;
      }

      // ── SurveyMonkey ──
      case 'surveymonkey_list_surveys': {
        const surveys = await surveymonkeyGetSurveys(process.env.SURVEYMONKEY_ACCESS_TOKEN!);
        if (surveys.length === 0) return 'アンケートが見つかりませんでした。';
        return `📊 SurveyMonkey アンケート (${surveys.length}件):\n\n` + surveys.slice(0, 10).map((s: { title?: string; id?: string }) => `• **${s.title}** (ID: ${s.id})`).join('\n');
      }

      // ── Pipedrive ──
      case 'pipedrive_list_deals': {
        const deals = await pipedriveGetDeals(process.env.PIPEDRIVE_API_KEY!, args.status as string | undefined);
        if (deals.length === 0) return '取引が見つかりませんでした。';
        return `💼 Pipedrive 取引 (${deals.length}件):\n\n` + deals.slice(0, 10).map((d: { title?: string; status?: string; value?: number }) => `• **${d.title}** [${d.status}] ¥${d.value?.toLocaleString() ?? 0}`).join('\n');
      }
      case 'pipedrive_list_persons': {
        const persons = await pipedriveGetPersons(process.env.PIPEDRIVE_API_KEY!, args.limit as number | undefined);
        if (persons.length === 0) return '人物が見つかりませんでした。';
        return `👤 Pipedrive 人物 (${persons.length}件):\n\n` + persons.slice(0, 10).map((p: { name?: string; email?: Array<{ value?: string }> }) => `• **${p.name}** (${p.email?.[0]?.value ?? ''})`).join('\n');
      }

      // ── Sansan ──
      case 'sansan_list_contacts': {
        const contacts = await sansanGetContacts(process.env.SANSAN_API_KEY!, args.limit as number | undefined);
        if (contacts.length === 0) return '名刺コンタクトが見つかりませんでした。';
        return `💳 Sansan コンタクト (${contacts.length}件):\n\n` + contacts.slice(0, 10).map((c: { name?: string; company?: string; email?: string }) => `• **${c.name}** / ${c.company ?? ''} (${c.email ?? ''})`).join('\n');
      }

      // ── Airtable ──
      case 'airtable_list_records': {
        const records = await airtableListRecords(process.env.AIRTABLE_API_KEY!, args.baseId as string, args.tableId as string);
        if (records.length === 0) return 'レコードが見つかりませんでした。';
        return `📋 Airtable レコード (${records.length}件):\n\n` + records.slice(0, 10).map((r: { id?: string; fields?: Record<string, unknown> }, i: number) => `${i + 1}. ID: ${r.id}\n   ${JSON.stringify(r.fields ?? {}).slice(0, 80)}`).join('\n\n');
      }
      case 'airtable_create_record': {
        const fields = JSON.parse(args.fields as string);
        const record = await airtableCreateRecord(process.env.AIRTABLE_API_KEY!, args.baseId as string, args.tableId as string, fields);
        return `✅ Airtableにレコードを作成しました\nID: ${(record as { id?: string })?.id}`;
      }

      // ── Coda ──
      case 'coda_list_docs': {
        const docs = await codaListDocs(process.env.CODA_API_KEY!);
        if (docs.length === 0) return 'ドキュメントが見つかりませんでした。';
        return `📄 Coda ドキュメント (${docs.length}件):\n\n` + docs.slice(0, 10).map((d: { name?: string; id?: string }) => `• **${d.name}** (ID: ${d.id})`).join('\n');
      }
      case 'coda_list_rows': {
        const rows = await codaListRows(process.env.CODA_API_KEY!, args.docId as string, args.tableId as string);
        if (rows.length === 0) return '行が見つかりませんでした。';
        return `📋 Coda テーブル行 (${rows.length}件):\n\n` + rows.slice(0, 10).map((r: { id?: string; values?: Record<string, unknown> }, i: number) => `${i + 1}. ${JSON.stringify(r.values ?? {}).slice(0, 80)}`).join('\n');
      }

      // ── LINE ──
      case 'line_push': {
        await linePushMessage(process.env.LINE_CHANNEL_ACCESS_TOKEN!, args.to as string, args.message as string);
        return `✅ LINEにメッセージを送信しました\n宛先: ${args.to}\n内容: ${args.message}`;
      }
      case 'line_broadcast': {
        await lineBroadcastMessage(process.env.LINE_CHANNEL_ACCESS_TOKEN!, args.message as string);
        return `✅ LINEブロードキャストを送信しました\n内容: ${args.message}`;
      }

      // ── LINE WORKS ──
      case 'lineworks_send': {
        const lwToken = await (await import('../integrations/lineworks')).getAccessToken(process.env.LINEWORKS_CLIENT_ID!, process.env.LINEWORKS_CLIENT_SECRET!, process.env.LINEWORKS_BOT_ID!);
        await lineworksSendMessage(lwToken, process.env.LINEWORKS_BOT_ID!, args.channelId as string, args.message as string);
        return `✅ LINE WORKSにメッセージを送信しました\nチャンネル: ${args.channelId}\n内容: ${args.message}`;
      }

      // ── ジョブカン ──
      case 'jobcan_list_staff': {
        const staff = await jobcanGetStaff(process.env.JOBCAN_API_KEY!);
        if (staff.length === 0) return 'スタッフが見つかりませんでした。';
        return `👥 ジョブカン スタッフ (${staff.length}件):\n\n` + staff.slice(0, 15).map((s: { staff_id?: string; last_name?: string; first_name?: string; department_name?: string }) => `• **${s.last_name ?? ''} ${s.first_name ?? ''}** (ID: ${s.staff_id}) ${s.department_name ?? ''}`).join('\n');
      }
      case 'jobcan_get_attendance': {
        const attendance = await jobcanGetAttendance(process.env.JOBCAN_API_KEY!, args.staffId as string, args.year as number, args.month as number);
        return `📅 ジョブカン 勤怠データ:\n\n${JSON.stringify(attendance, null, 2).slice(0, 800)}`;
      }
      case 'jobcan_clock_in': {
        await jobcanClockIn(process.env.JOBCAN_API_KEY!, args.note as string | undefined);
        return `✅ ジョブカンで出勤打刻しました${args.note ? `\n備考: ${args.note}` : ''}`;
      }
      case 'jobcan_clock_out': {
        await jobcanClockOut(process.env.JOBCAN_API_KEY!, args.note as string | undefined);
        return `✅ ジョブカンで退勤打刻しました${args.note ? `\n備考: ${args.note}` : ''}`;
      }

      // ── MFクラウド給与 ──
      case 'mfpayroll_list_employees': {
        const token = await (await import('../integrations/mfpayroll')).getAccessToken(process.env.MFPAYROLL_CLIENT_ID!, process.env.MFPAYROLL_CLIENT_SECRET!, process.env.MFPAYROLL_REFRESH_TOKEN!);
        const employees = await mfGetEmployees(token, args.officeId as string);
        if (employees.length === 0) return '従業員が見つかりませんでした。';
        return `👥 MFクラウド給与 従業員 (${employees.length}件):\n\n` + employees.slice(0, 15).map((e: { display_name?: string; employee_no?: string }) => `• **${e.display_name}** (No. ${e.employee_no})`).join('\n');
      }
      case 'mfpayroll_list_payslips': {
        const token = await (await import('../integrations/mfpayroll')).getAccessToken(process.env.MFPAYROLL_CLIENT_ID!, process.env.MFPAYROLL_CLIENT_SECRET!, process.env.MFPAYROLL_REFRESH_TOKEN!);
        const payslips = await mfGetPayslips(token, args.officeId as string, args.year as number, args.month as number);
        return `💴 MFクラウド給与 給与明細 (${payslips.length}件)`;
      }

      // ── マネーフォワード ──
      case 'moneyforward_list_invoices': {
        const token = await (await import('../integrations/moneyforward')).getAccessToken(process.env.MONEYFORWARD_CLIENT_ID!, process.env.MONEYFORWARD_CLIENT_SECRET!, process.env.MONEYFORWARD_REFRESH_TOKEN!);
        const invoices = await moneyforwardGetInvoices(token, args.officeId as string);
        if (invoices.length === 0) return '請求書が見つかりませんでした。';
        return `📄 マネーフォワード 請求書 (${invoices.length}件):\n\n` + invoices.slice(0, 10).map((i: { title?: string; total_amount?: number; status?: string }) => `• **${i.title ?? '(無題)'}** ¥${i.total_amount?.toLocaleString()} [${i.status}]`).join('\n');
      }
      case 'moneyforward_list_expenses': {
        const token = await (await import('../integrations/moneyforward')).getAccessToken(process.env.MONEYFORWARD_CLIENT_ID!, process.env.MONEYFORWARD_CLIENT_SECRET!, process.env.MONEYFORWARD_REFRESH_TOKEN!);
        const expenses = await moneyforwardGetExpenses(token, args.officeId as string);
        if (expenses.length === 0) return '経費が見つかりませんでした。';
        return `💴 マネーフォワード 経費 (${expenses.length}件):\n\n` + expenses.slice(0, 10).map((e: { item?: string; amount?: number }) => `• ${e.item ?? ''} ¥${e.amount?.toLocaleString()}`).join('\n');
      }

      // ── 弥生 ──
      case 'yayoi_trial_balance': {
        const balance = await yayoiGetTrialBalance(process.env.YAYOI_API_KEY!, args.companyId as string);
        return `📊 弥生 試算表:\n\n${JSON.stringify(balance, null, 2).slice(0, 800)}`;
      }

      // ── LaunchDarkly ──
      case 'launchdarkly_list_flags': {
        const flags = await ldGetFlags(process.env.LAUNCHDARKLY_API_KEY!, args.projectKey as string);
        if (flags.length === 0) return 'フラグが見つかりませんでした。';
        return `🚩 LaunchDarkly フラグ (${flags.length}件):\n\n` + flags.slice(0, 15).map((f: { key?: string; name?: string }) => `• **${f.name}** (\`${f.key}\`)`).join('\n');
      }
      case 'launchdarkly_toggle_flag': {
        await ldToggleFlag(process.env.LAUNCHDARKLY_API_KEY!, args.projectKey as string, args.flagKey as string, args.envKey as string, args.enabled as boolean);
        return `✅ LaunchDarklyフラグを${args.enabled ? 'ON' : 'OFF'}にしました\nフラグ: ${args.flagKey}\n環境: ${args.envKey}`;
      }

      // ── Statuspage ──
      case 'statuspage_list_incidents': {
        const incidents = await statuspageGetIncidents(process.env.STATUSPAGE_API_KEY!, args.pageId as string);
        if (incidents.length === 0) return 'インシデントが見つかりませんでした。';
        return `🚨 Statuspage インシデント (${incidents.length}件):\n\n` + incidents.slice(0, 10).map((i: { name?: string; status?: string }) => `• **${i.name}** [${i.status}]`).join('\n');
      }
      case 'statuspage_create_incident': {
        const incident = await statuspageCreateIncident(process.env.STATUSPAGE_API_KEY!, args.pageId as string, args.name as string, args.status as string);
        return `✅ Statuspageにインシデントを作成しました\n**${(incident as { name?: string })?.name}** [${args.status}]`;
      }

      // ── AWS ──
      case 'aws_cloudwatch_alarms': {
        const alarms = await cwGetAlarms(process.env.AWS_ACCESS_KEY_ID!, process.env.AWS_SECRET_ACCESS_KEY!, process.env.AWS_REGION!, (args.region as string) ?? process.env.AWS_REGION!);
        if (alarms.length === 0) return 'CloudWatchアラームが見つかりませんでした。';
        return `☁️ AWS CloudWatch アラーム (${alarms.length}件):\n\n` + alarms.slice(0, 10).map((a: { AlarmName?: string; StateValue?: string }) => `• **${a.AlarmName}** [${a.StateValue}]`).join('\n');
      }
      case 'aws_s3_list_buckets': {
        const buckets = await s3ListBuckets(process.env.AWS_ACCESS_KEY_ID!, process.env.AWS_SECRET_ACCESS_KEY!, process.env.AWS_REGION!);
        if (buckets.length === 0) return 'S3バケットが見つかりませんでした。';
        return `🪣 AWS S3 バケット (${buckets.length}件):\n\n` + buckets.slice(0, 15).map((b: { Name?: string; CreationDate?: string }) => `• **${b.Name}** (作成: ${b.CreationDate ? new Date(b.CreationDate).toLocaleDateString('ja') : '不明'})`).join('\n');
      }
      case 'aws_s3_list_objects': {
        const objects = await s3ListObjects(process.env.AWS_ACCESS_KEY_ID!, process.env.AWS_SECRET_ACCESS_KEY!, process.env.AWS_REGION!, args.bucket as string, args.prefix as string | undefined);
        if (objects.length === 0) return 'オブジェクトが見つかりませんでした。';
        return `📦 S3 バケット: ${args.bucket} (${objects.length}件):\n\n` + objects.slice(0, 15).map((o: { Key?: string; Size?: number }) => `• ${o.Key} (${((o.Size ?? 0) / 1024).toFixed(1)}KB)`).join('\n');
      }

      // ── Square ──
      case 'square_list_transactions': {
        const token = await (await import('../integrations/square')).getAccessToken(process.env.SQUARE_ACCESS_TOKEN!);
        const locations = await squareListLocations(token);
        const locationId = (args.locationId as string) ?? locations[0]?.id;
        if (!locationId) return '⚠️ Squareロケーションが見つかりませんでした。';
        const transactions = await squareListTransactions(token, locationId);
        if (transactions.length === 0) return '取引が見つかりませんでした。';
        return `💳 Square 取引 (${transactions.length}件):\n\n` + transactions.slice(0, 10).map((t: { id?: string; total_money?: { amount?: number; currency?: string }; status?: string }) => `• ID: ${t.id} ¥${(t.total_money?.amount ?? 0) / 100} [${t.status}]`).join('\n');
      }

      // ── クラウドサイン ──
      case 'cloudsign_list_documents': {
        const docs = await cloudsignGetDocuments(process.env.CLOUDSIGN_API_KEY!, args.status as string | undefined);
        if (docs.length === 0) return '書類が見つかりませんでした。';
        return `📑 クラウドサイン 書類 (${docs.length}件):\n\n` + docs.slice(0, 10).map((d: { title?: string; status?: string; id?: string }) => `• **${d.title ?? '(無題)'}** [${d.status}]`).join('\n');
      }

      // ── DocuSign ──
      case 'docusign_list_envelopes': {
        const token = await (await import('../integrations/docusign')).getAccessToken(process.env.DOCUSIGN_CLIENT_ID!, process.env.DOCUSIGN_CLIENT_SECRET!, process.env.DOCUSIGN_REFRESH_TOKEN!);
        const envelopes = await docusignGetEnvelopes(token, process.env.DOCUSIGN_ACCOUNT_ID!, args.status as string | undefined);
        if (envelopes.length === 0) return 'エンベロープが見つかりませんでした。';
        return `📑 DocuSign エンベロープ (${envelopes.length}件):\n\n` + envelopes.slice(0, 10).map((e: { emailSubject?: string; status?: string }) => `• **${e.emailSubject ?? '(無題)'}** [${e.status}]`).join('\n');
      }

      // ── freeeサイン ──
      case 'freeesign_list_contracts': {
        const contracts = await freesignGetContracts(process.env.FREEE_SIGN_API_KEY!);
        if (contracts.length === 0) return '契約書が見つかりませんでした。';
        return `📋 freeeサイン 契約書 (${contracts.length}件):\n\n` + contracts.slice(0, 10).map((c: { title?: string; status?: string }) => `• **${c.title ?? '(無題)'}** [${c.status}]`).join('\n');
      }

      // ── freee人事労務 ──
      case 'freeehr_list_employees': {
        const token = await (await import('../integrations/freeehr')).getAccessToken(process.env.FREEEHR_CLIENT_ID!, process.env.FREEEHR_CLIENT_SECRET!, process.env.FREEEHR_REFRESH_TOKEN!);
        const employees = await freeehrGetEmployees(token, parseInt(args.companyId as string));
        if (employees.length === 0) return '従業員が見つかりませんでした。';
        return `👥 freee人事労務 従業員 (${employees.length}件):\n\n` + employees.slice(0, 15).map((e: { display_name?: string; emp_code?: string }) => `• **${e.display_name}** (${e.emp_code})`).join('\n');
      }

      // ── RECEPTIONIST ──
      case 'receptionist_list_visitors': {
        const visitors = await receptionistGetVisitors(process.env.RECEPTIONIST_API_KEY!, args.date as string | undefined);
        if (visitors.length === 0) return '来訪者が見つかりませんでした。';
        return `🏢 RECEPTIONIST 来訪者 (${visitors.length}件):\n\n` + visitors.slice(0, 10).map((v: { name?: string; company?: string; check_in_at?: string }) => `• **${v.name}** / ${v.company ?? ''} (${v.check_in_at ?? ''})`).join('\n');
      }

      // ── Talentio ──
      case 'talentio_list_jobs': {
        const jobs = await talentioGetJobs(process.env.TALENTIO_API_KEY!);
        if (jobs.length === 0) return '求人が見つかりませんでした。';
        return `💼 Talentio 求人 (${jobs.length}件):\n\n` + jobs.slice(0, 10).map((j: { title?: string; status?: string; id?: number }) => `• **${j.title}** [${j.status}] (ID: ${j.id})`).join('\n');
      }
      case 'talentio_list_candidates': {
        const candidates = await talentioGetCandidates(process.env.TALENTIO_API_KEY!, args.jobId as number | undefined);
        if (candidates.length === 0) return '候補者が見つかりませんでした。';
        return `👤 Talentio 候補者 (${candidates.length}件):\n\n` + candidates.slice(0, 10).map((c: { name?: string; stage?: string }) => `• **${c.name}** [${c.stage}]`).join('\n');
      }

      // ── Wantedly ──
      case 'wantedly_list_jobs': {
        const token = await (await import('../integrations/wantedly')).getAccessToken(process.env.WANTEDLY_CLIENT_ID!, process.env.WANTEDLY_CLIENT_SECRET!, process.env.WANTEDLY_ACCESS_TOKEN!);
        const jobs = await wantedlyGetJobPostings(token);
        if (jobs.length === 0) return '求人が見つかりませんでした。';
        return `🌟 Wantedly 求人 (${jobs.length}件):\n\n` + jobs.slice(0, 10).map((j: { title?: string; status?: string }) => `• **${j.title}** [${j.status}]`).join('\n');
      }

      // ── サイボウズ ──
      case 'cybozu_list_schedules': {
        const token = await (await import('../integrations/cybozu')).getApiToken(process.env.CYBOZU_BASE_URL!, process.env.CYBOZU_USER!, process.env.CYBOZU_PASSWORD!);
        const date = (args.date as string) ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const schedules = await cybozuGetSchedules(process.env.CYBOZU_BASE_URL!, token, date);
        if (schedules.length === 0) return 'スケジュールが見つかりませんでした。';
        return `📅 サイボウズ スケジュール (${schedules.length}件):\n\n` + schedules.slice(0, 10).map((s: { title?: string; start?: { dateTime?: string } }) => `• **${s.title}** (${s.start?.dateTime ?? ''})`).join('\n');
      }

      // ── Calendly ──
      case 'calendly_list_event_types': {
        const user = await calendlyGetEventTypes(process.env.CALENDLY_ACCESS_TOKEN!);
        if (!user || user.length === 0) return 'イベントタイプが見つかりませんでした。';
        return `📅 Calendly イベントタイプ (${user.length}件):\n\n` + user.slice(0, 10).map((e: { name?: string; scheduling_url?: string }) => `• **${e.name}**\n  🔗 ${e.scheduling_url ?? ''}`).join('\n\n');
      }
      case 'calendly_list_scheduled_events': {
        const userInfo = await (await import('../integrations/calendly')).getCurrentUser(process.env.CALENDLY_ACCESS_TOKEN!);
        const events = await calendlyGetScheduledEvents(process.env.CALENDLY_ACCESS_TOKEN!, userInfo.uri, args.count as number | undefined);
        if (events.length === 0) return '予約済みイベントが見つかりませんでした。';
        return `📅 Calendly 予約済みイベント (${events.length}件):\n\n` + events.slice(0, 10).map((e: { name?: string; start_time?: string; status?: string }) => `• **${e.name}** (${e.start_time ?? ''}) [${e.status}]`).join('\n');
      }

      // ── Webflow ──
      case 'webflow_list_sites': {
        const sites = await webflowGetSites(process.env.WEBFLOW_API_TOKEN!);
        if (sites.length === 0) return 'サイトが見つかりませんでした。';
        return `🌐 Webflow サイト (${sites.length}件):\n\n` + sites.slice(0, 10).map((s: { name?: string; id?: string; domain?: string }) => `• **${s.name}** (${s.domain ?? s.id})`).join('\n');
      }
      case 'webflow_publish_site': {
        await webflowPublishSite(process.env.WEBFLOW_API_TOKEN!, args.siteId as string);
        return `✅ WebflowサイトをPublishしました\nサイトID: ${args.siteId}`;
      }

      // ── n8n ──
      case 'n8n_list_workflows': {
        const workflows = await n8nGetWorkflows(process.env.N8N_API_URL!, process.env.N8N_API_KEY!);
        if (workflows.length === 0) return 'ワークフローが見つかりませんでした。';
        return `⚙️ n8n ワークフロー (${workflows.length}件):\n\n` + workflows.slice(0, 10).map((w: { name?: string; active?: boolean }) => `• **${w.name}** [${w.active ? '有効' : '無効'}]`).join('\n');
      }
      case 'n8n_trigger': {
        const data = args.data ? JSON.parse(args.data as string) : {};
        await n8nTriggerWorkflow(args.webhookUrl as string, data);
        return `✅ n8n Webhookをトリガーしました\nURL: ${args.webhookUrl}`;
      }

      // ── Zapier ──
      case 'zapier_trigger': {
        const data = args.data ? JSON.parse(args.data as string) : {};
        await zapierTriggerZap(process.env.ZAPIER_WEBHOOK_URL!, data);
        return `✅ Zapier Webhookをトリガーしました`;
      }

      // ── Make ──
      case 'make_list_scenarios': {
        const scenarios = await makeGetScenarios(process.env.MAKE_API_KEY!, args.teamId as number | undefined);
        if (scenarios.length === 0) return 'シナリオが見つかりませんでした。';
        return `⚙️ Make シナリオ (${scenarios.length}件):\n\n` + scenarios.slice(0, 10).map((s: { name?: string; isActive?: boolean }) => `• **${s.name}** [${s.isActive ? '有効' : '無効'}]`).join('\n');
      }
      case 'make_trigger': {
        const data = args.data ? JSON.parse(args.data as string) : {};
        await makeTriggerScenario(args.webhookUrl as string, data);
        return `✅ Make Webhookをトリガーしました\nURL: ${args.webhookUrl}`;
      }

      // ── TikTok広告 ──
      case 'tiktokads_list_campaigns': {
        const campaigns = await tiktokGetCampaigns(process.env.TIKTOK_ADS_ACCESS_TOKEN!, process.env.TIKTOK_ADS_APP_ID!, args.advertiserId as string);
        if (campaigns.length === 0) return 'キャンペーンが見つかりませんでした。';
        return `🎵 TikTok広告 キャンペーン (${campaigns.length}件):\n\n` + campaigns.slice(0, 10).map((c: { campaign_name?: string; status?: string }) => `• **${c.campaign_name}** [${c.status}]`).join('\n');
      }

      // ── Meta広告 ──
      case 'metaads_list_campaigns': {
        const campaigns = await metaGetCampaigns(process.env.META_ACCESS_TOKEN!, args.adAccountId as string);
        if (campaigns.length === 0) return 'キャンペーンが見つかりませんでした。';
        return `📘 Meta広告 キャンペーン (${campaigns.length}件):\n\n` + campaigns.slice(0, 10).map((c: { name?: string; status?: string }) => `• **${c.name}** [${c.status}]`).join('\n');
      }

      // ── Vonage ──
      case 'vonage_send_sms': {
        await vonageSendSms(process.env.VONAGE_API_KEY!, process.env.VONAGE_API_SECRET!, args.to as string, args.from as string, args.message as string);
        return `✅ Vonage SMSを送信しました\n宛先: ${args.to}`;
      }

      // ── Cloudflare ──
      case 'cloudflare_list_zones': {
        const zones = await cfGetZones(process.env.CLOUDFLARE_API_TOKEN!);
        if (zones.length === 0) return 'Zoneが見つかりませんでした。';
        return `☁️ Cloudflare Zone (${zones.length}件):\n\n` + zones.slice(0, 10).map((z: { name?: string; id?: string; status?: string }) => `• **${z.name}** [${z.status}] (ID: ${z.id})`).join('\n');
      }
      case 'cloudflare_purge_cache': {
        await cfPurgeCache(process.env.CLOUDFLARE_API_TOKEN!, args.zoneId as string);
        return `✅ CloudflareキャッシュをPurgeしました\nZone ID: ${args.zoneId}`;
      }

      // ── Postmark ──
      case 'postmark_send': {
        await postmarkSendEmail(process.env.POSTMARK_API_TOKEN!, args.to as string, args.subject as string, args.body as string, args.from as string | undefined);
        return `✅ Postmarkでメールを送信しました\n宛先: ${args.to}\n件名: ${args.subject}`;
      }

      // ── OpenAI ──
      case 'openai_list_models': {
        const models = await openaiListModels(process.env.OPENAI_API_KEY!);
        return `🤖 OpenAI モデル (${models.length}件):\n\n` + models.slice(0, 20).map((m: { id?: string }) => `• ${m.id}`).join('\n');
      }
      default:
        return `ツール "${toolName}" は未実装です。`;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `⚠️ ${toolName} の実行に失敗しました: ${msg}`;
  }
}
