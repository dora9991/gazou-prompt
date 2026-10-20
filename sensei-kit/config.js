// アカウントに保存（js/cloud.js）の送り先。ここにあるのは公開してよい値だけ（URL と公開用キー）。
// cloud: true にすると、ホームと左下に「ログイン」が出る。本番の Supabase に supabase/sensei.sql を流し、
// Exposed schemas に sensei を足してから true にする（それまでは false＝いままでどおり、この端末だけ）。
window.SENSEI_CONFIG = {
  cloud: false,
  supabaseUrl: "https://xisijxspafqhspgexfty.supabase.co",
  supabaseKey: "sb_publishable_lCGzQSqCd0fJ8u-Ca4HXSg_eV9rBYr6"
};
