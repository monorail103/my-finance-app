import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // 1. Vercel Cronからのアクセスであることを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: 'Webhook URL not set' }, { status: 500 });
  }

  // 2. ワンタップ登録用URLの作成
  // 本番環境のURLをここに書いてください
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

  const discordRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!discordRes.ok) {
    return NextResponse.json({ error: 'Failed to send to Discord' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}