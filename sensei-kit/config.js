// アカウントに保存（js/cloud.js）の送り先。ここにあるのは公開してよい値だけ（URL と公開用キー）。
// cloud: true にすると、ホームと左下に「ログイン」が出る。本番の Supabase に supabase/sensei.sql を流し、
// Exposed schemas に sensei を足してから true にする（それまでは false＝いままでどおり、この端末だけ）。
window.SENSEI_CONFIG = {
  // 公式LINE「アラフォー」の特典として開かれたときの「利用の記録」（js/usage.js・supabase/sensei_usage.sql）。
  // enabled: true で、LIFF や line-hub のリンク（?c=lh-…）から開いた人だけ、どの道具を使ったかを記録する。liffId が空なら LIFF は使わない。
  line: { enabled: true, liffId: '2012127240-d6dQkzlY' },   // LINE ログインのチャネル 2012127240（アラフォーのプロバイダー）
  cloud: false,
  supabaseUrl: "https://xisijxspafqhspgexfty.supabase.co",
  supabaseKey: "sb_publishable_lCGzQSqCd0fJ8u-Ca4HXSg_eV9rBYr6"
};
