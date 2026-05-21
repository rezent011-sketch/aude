=== Week57: AWS S3・CloudWatch・GitHub Actions連携（4ツール） ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: AWS S3連携 ===

【src/integrations/awss3.ts を新規作成】

AWS S3 REST API を使用。
認証: AWS Signature V4（簡易版: Authorization: AWS4-HMAC-SHA256 形式）
ただし実際のSigV4は複雑なため、以下の簡易実装とする:
Presigned URLやSDKではなく、AWS_ACCESS_KEY_IDとAWS_SECRET_ACCESS_KEYを使った基本認証で実装する。
実装は署名なしのパブリックバケット or S3互換API（MinIO等）を想定し、
Authorization ヘッダーに 'AWS ' + accessKeyId + ':' + secretKey の簡易形式を使う。

export async function listBuckets(accessKeyId: string, secretKey: string, region: string): Promise<Array<{ name: string; creationDate: string; }>>
  GET https://s3.{region}.amazonaws.com/
  ヘッダー: { Authorization: 'AWS '+accessKeyId+':'+secretKey, 'x-amz-date': new Date().toISOString() }
  レスポンス XML をパースせず、仮実装として以下を返す（XMLパースはせずfetchのokを確認するのみ）:
  実装: res.text()でXMLを取得し、<Name>タグの内容を正規表現で抽出して配列にする
  //<Name>(.*?)<\/Name>/g でマッチ、<CreationDate>タグも同様に抽出

export async function listObjects(accessKeyId: string, secretKey: string, region: string, bucket: string, prefix?: string): Promise<Array<{ key: string; size: number; lastModified: string; }>>
  GET https://s3.{region}.amazonaws.com/{bucket}?list-type=2&prefix={prefix||''}
  同様にXMLから<Key>, <Size>, <LastModified>を正規表現で抽出

全関数: import { IntegrationError } from './errors'

【src/commands/awss3.ts を新規作成】
コマンド名: 'awss3'
description: 'AWS S3のバケット・オブジェクトを確認します'
サブコマンド: buckets(region string optional, default: 'ap-northeast-1') / objects(bucket string required, prefix string optional, region string optional)
vaultService から 'aws_access_key_id', 'aws_secret_access_key' 取得。未設定ガイド color: 0xFF9900

---
=== TASK 2: AWS CloudWatch連携 ===

【src/integrations/cloudwatch.ts を新規作成】

AWS CloudWatch REST API を使用。
上記S3と同様の簡易認証方式を使用。
Base URL: https://monitoring.{region}.amazonaws.com

export async function getAlarms(accessKeyId: string, secretKey: string, region: string): Promise<Array<{ AlarmName: string; StateValue: string; MetricName: string; Namespace: string; }>>
  GET https://monitoring.{region}.amazonaws.com/?Action=DescribeAlarms&Version=2010-08-01
  ヘッダー: { Authorization: 'AWS '+accessKeyId+':'+secretKey }
  レスポンス XMLから<AlarmName>, <StateValue>, <MetricName>, <Namespace>を正規表現で抽出

export async function getMetricStatistics(accessKeyId: string, secretKey: string, region: string, namespace: string, metricName: string): Promise<Array<{ Timestamp: string; Average: number; }>>
  GET https://monitoring.{region}.amazonaws.com/?Action=GetMetricStatistics&Namespace={namespace}&MetricName={metricName}&Period=3600&Statistics.member.1=Average&StartTime={1時間前のISO日時}&EndTime={現在のISO日時}&Version=2010-08-01
  XMLから<Timestamp>, <Average>を正規表現で抽出

全関数: import { IntegrationError } from './errors'

【src/commands/cloudwatch.ts を新規作成】
コマンド名: 'cloudwatch'
description: 'AWS CloudWatchのアラーム・メトリクスを確認します'
サブコマンド: alarms(region string optional) / metrics(namespace/metric_name string required, region string optional)
vaultService から 'aws_access_key_id', 'aws_secret_access_key' 取得。未設定ガイド color: 0xFF9900

---
=== TASK 3: GitHub Actions連携 ===

【src/integrations/githubactions.ts を新規作成】

GitHub Actions REST API を使用。
認証: Bearer token (既存の github.ts と同様)
Base URL: https://api.github.com

export async function listWorkflows(token: string, owner: string, repo: string): Promise<Array<{ id: number; name: string; state: string; path: string; }>>
  GET https://api.github.com/repos/{owner}/{repo}/actions/workflows
  ヘッダー: { Authorization: 'token '+token, Accept: 'application/vnd.github.v3+json' }
  レスポンス: { workflows: [{ id, name, state, path }] }

export async function listRuns(token: string, owner: string, repo: string, workflowId?: number): Promise<Array<{ id: number; name: string; status: string; conclusion: string | null; created_at: string; html_url: string; }>>
  GET https://api.github.com/repos/{owner}/{repo}/actions/runs{workflowId ? '/'+workflowId+'/runs' : ''}?per_page=10
  レスポンス: { workflow_runs: [{ id, name, status, conclusion, created_at, html_url }] }

export async function triggerWorkflow(token: string, owner: string, repo: string, workflowId: number | string, ref?: string): Promise<void>
  POST https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflowId}/dispatches
  body: { ref: ref || 'main' }
  204 で成功

全関数: import { IntegrationError } from './errors'

【src/commands/githubactions.ts を新規作成】
コマンド名: 'githubactions'
description: 'GitHub Actionsのワークフロー・実行履歴を管理します'
サブコマンド: workflows(owner/repo string required) / runs(owner/repo string required, workflow_id integer optional) / trigger(owner/repo string required, workflow_id string required, ref string optional)
vaultService から 'github_token' 取得（既存のgithubコマンドと同じキー）。未設定ガイド color: 0x24292F

---
=== TASK 4: Mailchimp連携 ===

【src/integrations/mailchimp.ts を新規作成】

Mailchimp Marketing API v3 を使用。
認証: Basic認証 (anystring:{api_key})
Base URL: https://{server}.api.mailchimp.com/3.0 (serverはAPIキーの末尾 -us1 等)

export async function getLists(apiKey: string): Promise<Array<{ id: string; name: string; stats: { member_count: number; }; }>>
  serverをapiKeyの末尾から抽出: apiKey.split('-').pop() || 'us1'
  GET https://{server}.api.mailchimp.com/3.0/lists?count=20
  ヘッダー: Authorization: Basic {Buffer.from('anystring:'+apiKey).toString('base64')}
  レスポンス: { lists: [{ id, name, stats: { member_count } }] }

export async function getCampaigns(apiKey: string): Promise<Array<{ id: string; settings: { subject_line: string; title: string; }; status: string; send_time: string; }>>
  GET https://{server}.api.mailchimp.com/3.0/campaigns?count=20
  レスポンス: { campaigns: [{ id, settings: { subject_line, title }, status, send_time }] }

export async function getAudienceStats(apiKey: string, listId: string): Promise<{ member_count: number; unsubscribe_count: number; open_rate: number; }>
  GET https://{server}.api.mailchimp.com/3.0/lists/{listId}
  レスポンス: { stats: { member_count, unsubscribe_count, open_rate } }

全関数: import { IntegrationError } from './errors'

【src/commands/mailchimp.ts を新規作成】
コマンド名: 'mailchimp'
description: 'Mailchimpのオーディエンス・キャンペーンを管理します'
サブコマンド: lists / campaigns / stats(list_id string required)
vaultService から 'mailchimp_api_key' 取得。未設定ガイド color: 0xFFE01B

---
=== TASK 5: commandHandler.ts への登録 ===
import { awss3Command } from '../commands/awss3';
import { cloudwatchCommand } from '../commands/cloudwatch';
import { githubactionsCommand } from '../commands/githubactions';
import { mailchimpCommand } from '../commands/mailchimp';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
