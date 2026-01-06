
import { createClient } from "@/lib/supabase/server";
import { addReceivable, addPayable, updateCash } from "./actions"; // updateCashを追加
import { format, addMonths, setDate, isAfter, parseISO } from "date-fns";

// 型定義
type TransactionItem = {
  id: string;
  title: string;
  amount: number;
  due_date: string;
};

// --- シミュレーション用ロジック ---
// 「次の27日」を取得する関数
const getNextPaymentDate = () => {
  const now = new Date();
  const currentMonth27th = setDate(now, 27);

  // もし今日が27日を過ぎていたら、来月の27日を返す
  if (isAfter(now, currentMonth27th)) {
    return addMonths(currentMonth27th, 1);
  }
  return currentMonth27th;
};

export default async function Home() {
  const supabase = await createClient();

  // データ取得
  const [walletRes, receivablesRes, payablesRes] = await Promise.all([
    supabase.from("wallet").select("*").single(),
    supabase.from("receivables").select("*").eq("is_received", false).order("due_date"),
    supabase.from("payables").select("*").eq("is_paid", false).order("due_date"),
  ]);

  const wallet = walletRes.data || { current_cash: 0, safety_buffer: 0 };
  const receivables = (receivablesRes.data as TransactionItem[]) || [];
  const payables = (payablesRes.data as TransactionItem[]) || [];

  // --- 計算ロジック ---
  const totalReceivables = receivables.reduce((sum, item) => sum + item.amount, 0);
  const totalPayables = payables.reduce((sum, item) => sum + item.amount, 0);
  
  // 今現在の使用可能額
  const currentDisposableIncome =
    wallet.current_cash + totalReceivables - totalPayables - wallet.safety_buffer;

  // --- シミュレーションロジック (New!) ---
  const nextPaymentDate = getNextPaymentDate(); // 次の27日
  const simulationDateStr = format(nextPaymentDate, "yyyy-MM-dd");

  // 次の27日までに「確実に入ってくるお金」と「出ていくお金」だけで計算
  const receivablesUntilPayment = receivables
    .filter((item) => item.due_date <= simulationDateStr)
    .reduce((sum, item) => sum + item.amount, 0);

  const payablesUntilPayment = payables
    .filter((item) => item.due_date <= simulationDateStr)
    .reduce((sum, item) => sum + item.amount, 0);

  // 27日時点での予測残高（バッファは考慮せず、単純に金が足りるか）
  const projectedBalanceOnPaymentDay = wallet.current_cash + receivablesUntilPayment - payablesUntilPayment;
  // バッファを割るかどうか
  const isSafe = projectedBalanceOnPaymentDay >= wallet.safety_buffer;
  const isDanger = projectedBalanceOnPaymentDay < 0;

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 p-4 pb-20 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        
        {/* --- 1. 資金繰りシミュレーション (最優先表示) --- */}
        <section className={`p-4 rounded-xl border-2 ${isDanger ? 'bg-red-900/20 border-red-500' : isSafe ? 'bg-emerald-900/20 border-emerald-500' : 'bg-yellow-900/20 border-yellow-500'}`}>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-1 text-gray-400">
            次回引き落とし日 ({format(nextPaymentDate, "M/dd")}) の予測
          </h2>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-gray-400">当日予想残高</p>
              <p className={`text-3xl font-bold ${projectedBalanceOnPaymentDay < 0 ? 'text-red-500' : 'text-white'}`}>
                ¥{projectedBalanceOnPaymentDay.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <span className={`px-2 py-1 rounded text-xs font-bold ${isDanger ? 'bg-red-600 text-white' : isSafe ? 'bg-emerald-600 text-white' : 'bg-yellow-600 text-black'}`}>
                {isDanger ? "資金ショート警告" : isSafe ? "安全圏" : "バッファ割れ"}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ※ {format(nextPaymentDate, "M/dd")} までに入出金予定の項目のみで計算
          </p>
        </section>

        {/* --- 2. 現在の使用可能額 (メイン) --- */}
        <section className="bg-gray-800 p-6 rounded-2xl shadow-lg text-center">
          <h2 className="text-gray-400 text-sm font-semibold uppercase mb-2">
            現在の使用可能額 (全期間)
          </h2>
          <div className={`text-5xl font-bold ${currentDisposableIncome < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            ¥{currentDisposableIncome.toLocaleString()}
          </div>
          <div className="mt-4 flex justify-between text-sm bg-gray-700/50 p-3 rounded-lg">
             <span className="text-gray-400">現在の手持ち現金</span>
             <span className="font-mono font-bold">¥{wallet.current_cash.toLocaleString()}</span>
          </div>
        </section>

        {/* --- 3. 現金操作フォーム (New!) --- */}
        <section className="grid grid-cols-2 gap-4">
           {/* 使った (減らす) */}
           <form action={updateCash} className="bg-gray-800 p-3 rounded-xl border border-gray-700">
             <input type="hidden" name="type" value="spend" />
             <h3 className="text-xs text-red-400 font-bold mb-2">現金を使った</h3>
             <div className="flex gap-2">
               <input name="amount" type="number" placeholder="¥" className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-white text-right" required />
               <button type="submit" className="bg-red-600 text-white px-3 rounded font-bold">-</button>
             </div>
           </form>
           {/* 増えた (増やす) */}
           <form action={updateCash} className="bg-gray-800 p-3 rounded-xl border border-gray-700">
             <input type="hidden" name="type" value="income" />
             <h3 className="text-xs text-emerald-400 font-bold mb-2">現金増 (ATM引出等)</h3>
             <div className="flex gap-2">
               <input name="amount" type="number" placeholder="¥" className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-white text-right" required />
               <button type="submit" className="bg-emerald-600 text-white px-3 rounded font-bold">+</button>
             </div>
           </form>
        </section>

        {/* --- 4. 予定リスト & 追加フォーム --- */}
        <div className="space-y-6 pt-4 border-t border-gray-800">
          
          {/* 収入管理 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-emerald-400">収入予定</h3>
              <span className="text-xs text-emerald-400/70">合計: +¥{totalReceivables.toLocaleString()}</span>
            </div>
            {/* 追加フォーム */}
            <form action={addReceivable} className="flex gap-2 mb-3">
              <input name="title" placeholder="項目" className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white" required />
              <input name="amount" type="number" placeholder="金額" className="w-20 bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white" required />
              <input name="dueDate" type="date" className="w-28 bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white" required />
              <button className="bg-emerald-600 text-white p-2 rounded text-xs">Add</button>
            </form>
            {/* リスト */}
            <div className="space-y-2">
              {receivables.map((item) => (
                <div key={item.id} className="bg-gray-800/50 p-2 rounded flex justify-between text-sm">
                  <span>{item.title} <span className="text-gray-500 text-xs">({format(parseISO(item.due_date), "M/d")})</span></span>
                  <span>¥{item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 支出管理 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-red-400">支出予定 (引落)</h3>
              <span className="text-xs text-red-400/70">合計: -¥{totalPayables.toLocaleString()}</span>
            </div>
            {/* 追加フォーム */}
            <form action={addPayable} className="flex gap-2 mb-3">
              <input name="title" placeholder="項目" className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white" required />
              <input name="amount" type="number" placeholder="金額" className="w-20 bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white" required />
              <button className="bg-red-600 text-white p-2 rounded text-xs">Add</button>
            </form>
            {/* リスト */}
            <div className="space-y-2">
              {payables.map((item) => (
                <div key={item.id} className="bg-gray-800/50 p-2 rounded flex justify-between text-sm">
                  <span>{item.title} <span className="text-gray-500 text-xs">({format(parseISO(item.due_date), "M/d")})</span></span>
                  <span>¥{item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}