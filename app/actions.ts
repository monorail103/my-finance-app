// app/actions.ts
'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { format, addMonths, setDate } from "date-fns";

// 労働債権（収入予定）を追加する
export async function addReceivable(formData: FormData) {
  const supabase = await createClient();

  const title = formData.get("title") as string;
  const amount = Number(formData.get("amount"));
  const dueDate = formData.get("dueDate") as string;

  // バリデーション（簡易）
  if (!title || !amount || !dueDate) return;

  await supabase.from("receivables").insert({
    title,
    amount,
    due_date: dueDate,
    is_received: false,
  });

  // 画面を更新
  revalidatePath("/");
}

// 債務（支払い予定）を追加する
export async function addPayable(formData: FormData) {
  const supabase = await createClient();

  const title = formData.get("title") as string;
  const amount = Number(formData.get("amount"));
  // 今日の日付を取得 -> 1ヶ月足す -> 日にちを27日にセット
  const nextMonth = addMonths(new Date(), 1);
  const targetDate = setDate(nextMonth, 27);
  const dueDate = format(targetDate, 'yyyy-MM-dd');

  if (!title || !amount || !dueDate) return;

  await supabase.from("payables").insert({
    title,
    amount,
    due_date: dueDate,
    is_paid: false,
  });

  revalidatePath("/");
}

// 現金（口座残高）を直接増減させる
// amountが正なら入金、負なら出金として扱います
export async function updateCash(formData: FormData) {
  const supabase = await createClient();

  // フォームから "type" (spend | income) と "amount" を受け取る
  const type = formData.get("type") as string;
  const rawAmount = Number(formData.get("amount"));

  if (!rawAmount) return;

  // 出金ならマイナスにする
  const finalAmount = type === "spend" ? -rawAmount : rawAmount;

  // 現在の所持金を取得
  const { data: wallet } = await supabase.from("wallet").select("current_cash").single();
  
  if (!wallet) return;

  // DB更新 (現在の額 + 変動額)
  await supabase
    .from("wallet")
    .update({ current_cash: wallet.current_cash + finalAmount })
    .eq("id", (await supabase.from("wallet").select("id").single()).data?.id); // ID指定（1行しかないので雑に取得）

  revalidatePath("/");
}