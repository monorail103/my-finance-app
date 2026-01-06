import { createClient } from "@/lib/supabase/server";
import { addMonths, setDate, format } from "date-fns";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("key");

  // セキュリティチェック
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // 1. 給料日と給与タイトルの計算
  // 例: 今日が1月6日なら -> 給料日は2月15日、タイトルは「1月分給与」
  const today = new Date();
  const nextMonth = addMonths(today, 1);
  const payDay = setDate(nextMonth, 15);
  
  const targetDateStr = format(payDay, "yyyy-MM-dd");
  const targetTitle = `${format(today, "M")}月分給与`; 
  const shiftWage = 1260 * 4; // 1回あたりの給与

  // 2. 既存のレコードがあるか探す
  // 条件: 支払日が一致し、まだ受け取っていない(is_received=false)もの
  const { data: existingRecord } = await supabase
    .from("receivables")
    .select("*")
    .eq("due_date", targetDateStr)
    .eq("is_received", false)
    .maybeSingle(); // 0件か1件かを取得

  if (existingRecord) {
    // A. 既存レコードがある場合 -> 加算更新 (Update)
    await supabase
      .from("receivables")
      .update({ 
        amount: existingRecord.amount + shiftWage,
        // タイトルが「固定シフト」とかになっていたら「〇月分給与」に上書き統一しても良いかも
        title: targetTitle 
      })
      .eq("id", existingRecord.id);
  } else {
    // B. ない場合（その月の最初の出勤） -> 新規作成 (Insert)
    await supabase
      .from("receivables")
      .insert({
        title: targetTitle,
        amount: shiftWage,
        due_date: targetDateStr,
        is_received: false,
      });
  }

  // 完了後のリダイレクト
  redirect("/");
}