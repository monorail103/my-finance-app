import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // 1. 処理開始の狼煙（これがログに出なければコードが古いです）
  console.log('🚀 Cron Job: Start processing request...');

  try {
    // 2. 環境変数のチェック
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const cronSecret = process.env.CRON_SECRET;

    if (!webhookUrl) {
      console.error('❌ Error: DISCORD_WEBHOOK_URL is missing.');
      return NextResponse.json({ error: 'Webhook URL not set' }, { status: 500 });
    }
    if (!cronSecret) {
      console.warn('⚠️ Warning: CRON_SECRET is missing. Check Vercel Environment Variables.');
    }

    // 3. 認証チェック
    const authHeader = request.headers.get('authorization');
    // セキュリティのため末尾のみログに出す
    const debugAuth = authHeader ? `Bearer ...${authHeader.slice(-5)}` : 'null';
    const debugSecret = cronSecret ? `...${cronSecret.slice(-5)}` : 'undefined';
    
    console.log(`🔐 Auth Check: Received=${debugAuth}, Expected_Secret_End=${debugSecret}`);

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('⛔ Auth Failed: Unauthorized access attempt.');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    console.log('✅ Auth Success: Credentials match.');

    // 4. データ準備
    const appUrl = "https://my-finance-app-b1xe.vercel.app/"; 
    const quickAddUrl = `${appUrl}/api/quick-add?key=${cronSecret}`;

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

    console.log('📨 Sending payload to Discord...');

    // 5. Discordへの送信
    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      console.error(`❌ Discord API Error: ${discordRes.status}`, errorText);
      return NextResponse.json({ error: 'Failed to send to Discord' }, { status: 500 });
    }

    console.log('🎉 Success: Notification sent to Discord!');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('💥 Unhandled Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}