// index.mjs
// 依存: twitter-api-v2（package.json に "twitter-api-v2" が入っている想定）
import { TwitterApi } from 'twitter-api-v2';

function req(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`ENV missing: ${name}`);
    process.exit(1);
  }
  return v.trim();
}

async function main() {
  const appKey       = req('X_API_KEY');
  const appSecret    = req('X_API_SECRET');
  const accessToken  = req('X_ACCESS_TOKEN');
  const accessSecret = req('X_ACCESS_SECRET');
  const bodyRaw      = req('POST_BODY');

  const body = bodyRaw.trim();
  if (!body) {
    console.error('POST_BODY is empty after trim');
    process.exit(1);
  }

  const client = new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });

  try {
    const me = await client.v2.me();
    console.log(`Posting as @${me.data.username}`);
    console.log(body);

    // v2Tweet
    const res = await client.v2.tweet({ text: body });

    if (!res?.data?.id) {
      console.error('Tweet response has no id:', JSON.stringify(res, null, 2));
      process.exit(1);
    }

    const url = `https://x.com/${me.data.username}/status/${res.data.id}`;
    console.log('Tweet OK:', res.data.id, url);
    // 正常終了
  } catch (err) {
    // twitter-api-v2 は err.data / err.errors に詳細が入ることが多い
    const detail = err?.data ?? err?.errors ?? err?.message ?? err;
    console.error('Tweet FAILED:', JSON.stringify(detail, null, 2));
    process.exit(1);
  }
}

main();
