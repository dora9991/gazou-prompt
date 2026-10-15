# 記録の送り先（Supabase）― LINE とつなぐ追加分

処方箋のページを公式LINE（LIFF）から開いた人の「LINE の表示名」を、記録につけるための部品です。
LINE の外（ふつうのブラウザ）から開いた人は、これまでどおり名前なしで記録されます。

| ファイル | 中身 |
|---|---|
| `gazou_prompt_line.sql` | 追加のSQL（列・札のテーブル・関数）。SQL Editor で流す |
| `functions/gazou-line/index.ts` | LINE の ID トークンを確かめて、記録用の札を返す Edge Function |

## 仕組み

```
LINE アプリ ─ LIFF ─▶ 処方箋のページ ──(ID トークン)──▶ gazou-line ──▶ LINE に「本物？」と確かめる
                           │                                │
                           │◀────────(記録用の札・表示名)────┘  札のハッシュだけを DB に預ける
                           │
                           └──(記録＋札)──▶ log_event ──▶ 札から「だれ」を決めて、events に LINE の名前をつける
```

- 札は、ランダムな64桁の16進数。DB には、そのハッシュ（SHA-256）だけを持つ。有効期間は12時間。
- 記録の中身（`p`）に `line_user_id` などが書かれていても無視する。LINE の名前がつくのは、有効な札があるときだけ。
- 札が古い・知らない札のときは、名前なしで記録して `session: "expired"` を返す（ページがつなぎ直す）。
- 今ある `log_event` / `admin_events` は消さずに、名前を変えて残し（`_log_event_base` / `_admin_events_base`）、その外側に新しい関数を置く。

## 設定の手順（Supabase の画面でやる）

前提：`config.js` の `supabaseUrl` と同じプロジェクトで作業する（画面のURLが `.../project/<supabaseUrl の xxxx.supabase.co の xxxx>` のもの）。

### 1. SQL を流す
1. 左メニュー **SQL Editor** → 新しいクエリ
2. `gazou_prompt_line.sql` の中身を、すべて貼る
3. **Run**。エラーなく終われば成功（前提がちがうと、何も変えずに止まって、理由が出る）
   - もう一度流しても、二重に包まれない

### 2. Edge Function を作る
1. 左メニュー **Edge Functions** → **Deploy a new function** → **Via Editor**
2. 名前：`gazou-line`（この名前でないと、ページから呼べない）
3. `functions/gazou-line/index.ts` の中身を、すべて貼る → **Deploy**
4. その関数の設定で **Verify JWT（Enforce JWT Verification）をオフ**にする
   - ページは公開用キーだけで呼ぶため。オンのままだと、`401 Missing authorization header` になる

### 3. 秘密の設定（Secrets）
**Edge Functions → Secrets**（または Manage secrets）に、次を足す。

| 名前 | 値 |
|---|---|
| `LINE_CHANNEL_ID` | LINEログインのチャネルID（10桁の数字。LIFF ID の `-` より前と同じ） |
| `ALLOWED_ORIGINS` | （任意）ページの出どころ。既定は `https://dora9991.github.io`。ほかのURLで公開するときだけ、カンマ区切りで入れる |

`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` は、Supabase が自動で入れる。

### 4. 動作の確認
- ブラウザで `https://<プロジェクト>.supabase.co/functions/v1/gazou-line` を開く
  - `{"ok":false,"error":"method_not_allowed"}` と出れば、関数は動いている
  - `Missing authorization header` と出たら、手順2の4が済んでいない
  - `not_configured` と出たら、手順3が済んでいない（POSTのときに出る）
- LINE で LIFF URL（`https://liff.line.me/<LIFF ID>`）を開いて処方箋を作り、管理画面（`admin.html`）に表示名が出るか見る

## 記録を消す（本人から頼まれたとき）
管理画面で、その人を選ぶと出る「名前から切り離す（記録は名前なしで残す）」または「この人の記録をすべて消す」を押す（`admin_forget_user`）。
どちらも、その人の札も消える。
