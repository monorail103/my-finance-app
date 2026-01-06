import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // ★追加: 処理開始のログ
  console.log('Cron Job: Started processing');

  // 1. Vercel Cronからのアクセスであることを確認
  const authHeader = request.headers.get('authorization');
  // 比較のためにログ出力（本番ではSECRETの中身は隠すべきですが、デバッグ時は確認）
  // console.log('Auth Header:', authHeader); 

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // ★追加: 認証失敗ログ
    console.error('Cron Job: Authorization failed');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('Cron Job: Webhook URL is missing');
    return NextResponse.json({ error: 'Webhook URL not set' }, { status: 500 });
  }

  // 2. ワンタップ登録用URLの作成
  const appUrl = "https://my-finance-app-b1xe.vercel.app/"; 
  const secret = process.env.CRON_SECRET;
  const quickAddUrl = `${appUrl}/api/quick-add?key=${secret}`;

  // 3. Discordへの通知送信
  const payload = {
    username: "給与管理Bot",
    embeds: [
      {
        title: "✅ シフト実績を登録する",
        description: "お疲れ様でした！\n下のリンクをタップすると即座に登録されます。",
        url: quickAddUrl,
        color: 3066993,
        fields: [
          {
            name: "登録内容",
            value: "¥5,040 (労働債権へ加算)",
            inline: true
          }
        ]
      }
    ]
  };

  // ★追加: 送信直前のログ
  console.log('Cron Job: Sending to Discord...');

  const discordRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!discordRes.ok) {
    // ★追加: 送信失敗時の詳細ログ
    const errorText = await discordRes.text();
    console.error('Cron Job: Discord API Error', discordRes.status, errorText);
    return NextResponse.json({ error: 'Failed to send to Discord' }, { status: 500 });
  }

  // ★追加: 完了ログ
  console.log('Cron Job: Successfully sent notification');
  return NextResponse.json({ success: true });
}