import { useState, useRef, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { useIsSimpleMode } from '../hooks/useInputMode';
import { formatKRW, formatNumber, stripNonDigits } from '../utils/format';
import { formatDateInput, isValidDate, isDateInputComplete, normalizeDateTyping, toCompactDateInput } from '../utils/dateFormat';
import type { Transaction, Entry } from '../types';
import { useTranslation } from '../i18n/useTranslation';
import { useToast } from '../components/Toast';

const categories = [
  { name: '식비', emoji: '🍽️' },
  { name: '카페/간식', emoji: '☕' },
  { name: '교통비', emoji: '🚌' },
  { name: '주거비', emoji: '🏠' },
  { name: '통신비', emoji: '📱' },
  { name: '의류', emoji: '👔' },
  { name: '문화생활', emoji: '🎬' },
  { name: '의료비', emoji: '🏥' },
  { name: '생활용품', emoji: '🧴' },
  { name: '경조사', emoji: '🎁' },
  { name: '보험료', emoji: '🛡️' },
  { name: '기타', emoji: '📦' },
];

const paymentMethods = [
  { id: 'a2-1', name: '신한카드', type: 'credit', emoji: '💳' },
  { id: 'a2-2', name: '삼성카드', type: 'credit', emoji: '💳' },
  { id: 'a1-1', name: '신한은행', type: 'debit', emoji: '🏦' },
  { id: 'a1-2', name: '카카오뱅크', type: 'debit', emoji: '🏦' },
  { id: 'a1-4', name: '현금', type: 'cash', emoji: '💵' },
];

const incomeCategories = [
  { name: '급여', emoji: '💰' },
  { name: '상여금', emoji: '🎊' },
  { name: '이자수입', emoji: '🏦' },
  { name: '배당금', emoji: '📈' },
  { name: '기타수입', emoji: '💡' },
];

export default function TransactionNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addTransaction, inputMode, setInputMode } = useStore();
  const isSimple = useIsSimpleMode();
  const [txType, setTxType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0].name);
  const [payment, setPayment] = useState(paymentMethods[0]);
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showHelp, setShowHelp] = useState(false);
  const [dateFocused, setDateFocused] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);

  // Expert mode state
  const [entries, setEntries] = useState<{ accountName: string; type: 'DR' | 'CR'; amount: string }[]>([
    { accountName: '', type: 'DR', amount: '' },
    { accountName: '', type: 'CR', amount: '' },
  ]);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const displayAmount = amount ? formatNumber(amount) : '';
  const compactDate = toCompactDateInput(date);
  const normalizedDate = formatDateInput(compactDate);
  const dateComplete = isDateInputComplete(compactDate);
  const dateInvalid = dateComplete && !isValidDate(normalizedDate);

  const openDatePicker = () => {
    const picker = datePickerRef.current;
    if (!picker) return;
    picker.value = isValidDate(normalizedDate) ? normalizedDate : new Date().toISOString().slice(0, 10);
    const showPicker = (picker as HTMLInputElement & { showPicker?: () => void }).showPicker;
    if (typeof showPicker === 'function') showPicker.call(picker);
    else picker.focus();
  };

  const handleSimpleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidDate(normalizedDate)) return;
    const numAmount = parseInt(amount.replace(/,/g, ''), 10);
    if (!numAmount) return;

    let txEntries: Entry[];
    if (txType === 'income') {
      txEntries = [
        { id: `e-${Date.now()}-1`, accountId: payment.id, accountName: payment.name, type: 'DR', amount: numAmount },
        { id: `e-${Date.now()}-2`, accountId: `a3-1`, accountName: category, type: 'CR', amount: numAmount },
      ];
    } else {
      txEntries = [
        { id: `e-${Date.now()}-1`, accountId: `a4-${categories.findIndex(c => c.name === category) + 1}`, accountName: category, type: 'DR', amount: numAmount },
        { id: `e-${Date.now()}-2`, accountId: payment.id, accountName: payment.name, type: 'CR', amount: numAmount },
      ];
    }

    const tx: Transaction = {
      id: `t-${Date.now()}`,
      date: normalizedDate,
      description: memo || category,
      category,
      entries: txEntries,
    };
    addTransaction(tx);
    toast(t('transactions.savedSuccess'));
    navigate('/transactions');
  };

  const handleExpertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidDate(normalizedDate)) return;
    const parsedEntries: Entry[] = entries.map((en, i) => ({
      id: `e-${Date.now()}-${i}`,
      accountId: `custom-${i}`,
      accountName: en.accountName,
      type: en.type,
      amount: parseInt(en.amount.replace(/,/g, ''), 10) || 0,
    }));

    // Balance check
    const drTotal = parsedEntries.filter(e => e.type === 'DR').reduce((s, e) => s + e.amount, 0);
    const crTotal = parsedEntries.filter(e => e.type === 'CR').reduce((s, e) => s + e.amount, 0);

    const tx: Transaction = {
      id: `t-${Date.now()}`,
      date: normalizedDate,
      description: memo || t('transactions.manualEntry'),
      entries: parsedEntries,
    };
    addTransaction(tx);
    toast(t('transactions.savedSuccess'));
    navigate('/transactions');
  };

  const addEntryRow = () => {
    setEntries([...entries, { accountName: '', type: 'DR', amount: '' }]);
  };

  const removeEntryRow = (idx: number) => {
    if (entries.length <= 2) return;
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const drTotal = entries.filter(e => e.type === 'DR').reduce((s, e) => s + (parseInt(e.amount) || 0), 0);
  const crTotal = entries.filter(e => e.type === 'CR').reduce((s, e) => s + (parseInt(e.amount) || 0), 0);
  const isBalanced = drTotal === crTotal && drTotal > 0;

  const activeCategories = txType === 'income' ? incomeCategories : categories;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('transactions.newTitle')}</h2>
        <button
          onClick={() => setInputMode(inputMode === 'simple' ? 'expert' : 'simple')}
          className="text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          {inputMode === 'simple' ? `🔧 ${t('transactions.expertMode')}` : `✨ ${t('transactions.simpleMode')}`}
        </button>
      </div>

      {inputMode === 'simple' ? (
        <form
          onSubmit={handleSimpleSubmit}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.defaultPrevented) return;
            const target = e.target as HTMLElement;
            if (target instanceof HTMLTextAreaElement) return;
            const canSubmit = Boolean(isValidDate(normalizedDate) && amount);
            if (!canSubmit) return;
            e.preventDefault();
            (e.currentTarget as HTMLFormElement).requestSubmit();
          }}
          className="space-y-4"
        >
          {/* Transaction type tabs */}
          <div className="flex gap-1 bg-surface rounded-xl p-1 border border-border">
            {([['expense', t('accounts.types.expense'), '💸'], ['income', t('accounts.types.income'), '💰'], ['transfer', t('transactions.transfer'), '🔄']] as const).map(([key, label, emoji]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTxType(key);
                  if (key === 'income') setCategory(incomeCategories[0].name);
                  else setCategory(categories[0].name);
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                  txType === key
                    ? key === 'expense' ? 'bg-expense/10 text-expense shadow-sm' :
                      key === 'income' ? 'bg-income/10 text-income shadow-sm' :
                      'bg-primary/10 text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {emoji} {label}
              </button>
            ))}
          </div>

          {/* Amount — big prominent input */}
          <div className="bg-surface rounded-xl p-5 shadow-sm border border-border">
            <label className="block text-xs text-text-secondary mb-1">{t('transactions.amount')}</label>
            <div className="flex items-center gap-2">
              <span className="text-2xl text-text-tertiary">₩</span>
              <input
                ref={amountRef}
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={displayAmount}
                onChange={(e) => setAmount(stripNonDigits(e.target.value))}
                className="flex-1 text-3xl font-bold text-right bg-transparent focus:outline-none"
              />
            </div>
            {/* 후잉 인사이트: "대충 맞으면 OK" */}
            <p className="text-[10px] text-text-tertiary mt-2 text-right">
              💡 {t('transactions.amountHint')}
            </p>
          </div>

          {/* Date + Payment row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
              <label className="block text-xs text-text-secondary mb-1.5">{t('transactions.date')}</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="YYYYMMDD"
                  value={dateFocused ? compactDate : normalizedDate}
                  onFocus={() => setDateFocused(true)}
                  onChange={(e) => setDate(normalizeDateTyping(e.target.value))}
                  onBlur={() => {
                    setDateFocused(false);
                    if (dateComplete) setDate(normalizedDate);
                  }}
                  className={`w-full text-sm bg-transparent pr-8 focus:outline-none ${dateInvalid ? 'text-red-500' : ''}`}
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openDatePicker}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-primary"
                  aria-label="날짜 선택"
                >
                  <CalendarDays size={16} />
                </button>
                <input
                  ref={datePickerRef}
                  type="date"
                  tabIndex={-1}
                  className="sr-only"
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
              <label className="block text-xs text-text-secondary mb-1.5">
                {txType === 'income' ? t('transactions.depositSource') : t('transactions.paymentMethod')}
              </label>
              <select
                value={payment.id}
                onChange={(e) => setPayment(paymentMethods.find((p) => p.id === e.target.value)!)}
                className="w-full text-sm bg-transparent focus:outline-none"
              >
                {paymentMethods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </option>
                ))}
              </select>
              {/* 체크카드 안내 — 온보딩 힌트 */}
              {payment.type === 'debit' && (
                <p className="text-[10px] text-primary/70 mt-1">
                  ℹ️ 체크카드 = 연동 계좌(자산)에서 출금
                </p>
              )}
            </div>
          </div>

          {/* Category chips */}
          <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
            <label className="block text-xs text-text-secondary mb-2">{t('transactions.category')}</label>
            <div className="flex flex-wrap gap-2">
              {activeCategories.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setCategory(cat.name)}
                  className={`px-3 py-1.5 rounded-full text-xs transition flex items-center gap-1 ${
                    category === cat.name
                      ? txType === 'income' ? 'bg-income text-white' : 'bg-primary text-white'
                      : 'bg-surface-secondary border border-border text-text-secondary hover:border-primary'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Memo */}
          <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
            <label className="block text-xs text-text-secondary mb-1.5">{t('transactions.memo')}</label>
            <input
              type="text"
              placeholder={t('transactions.memoPlaceholder')}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full text-sm bg-transparent focus:outline-none"
            />
          </div>

          {/* AI suggestion mockup — 전문가모드에서만 표시 */}
          {!isSimple && <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🤖</span>
                <span className="text-xs font-semibold text-primary">AI가 추천한 분개</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-[10px] text-primary/60 hover:text-primary"
              >
                분개가 뭔가요?
              </button>
            </div>
            {showHelp && (
              <div className="text-xs text-text-secondary bg-surface rounded-lg p-3 mb-2 border border-border">
                <p className="font-medium mb-1">💡 분개(仕訳)란?</p>
                <p>하나의 거래를 "어디서 나갔는지(대변)"와 "어디로 갔는지(차변)"로 나누어 기록하는 방식이에요.</p>
                <p className="mt-1">예: 커피 5,000원을 신한카드로 결제 →</p>
                <p className="text-text-tertiary">차변(지출 증가): 카페/간식 ₩5,000</p>
                <p className="text-text-tertiary">대변(부채 증가): 신한카드 ₩5,000</p>
              </div>
            )}
            <div className="text-xs text-text-secondary space-y-1.5">
              {txType === 'income' ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-income inline-block" /> 차변: {payment.name}</span>
                    <span>{amount ? formatKRW(parseInt(amount)) : '₩0'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" /> 대변: {category}</span>
                    <span>{amount ? formatKRW(parseInt(amount)) : '₩0'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-expense inline-block" /> 차변: {category}</span>
                    <span>{amount ? formatKRW(parseInt(amount)) : '₩0'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" /> 대변: {payment.name}</span>
                    <span>{amount ? formatKRW(parseInt(amount)) : '₩0'}</span>
                  </div>
                </>
              )}
            </div>
          </div>}

          <button
            type="submit"
            disabled={!amount}
            className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-dark transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {txType === 'income' ? t('transactions.saveIncome') : txType === 'transfer' ? t('transactions.saveTransfer') : t('transactions.saveExpense')}
          </button>
        </form>
      ) : (
        /* ─── 전문가 모드 ─── */
        <form
          onSubmit={handleExpertSubmit}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.defaultPrevented) return;
            const target = e.target as HTMLElement;
            if (target instanceof HTMLTextAreaElement) return;
            const canSubmit = Boolean(isValidDate(normalizedDate));
            if (!canSubmit) return;
            e.preventDefault();
            (e.currentTarget as HTMLFormElement).requestSubmit();
          }}
          className="space-y-4"
        >
          <div className="bg-surface rounded-xl p-5 shadow-sm border border-border space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">{t('transactions.date')}</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="YYYYMMDD"
                    value={dateFocused ? compactDate : normalizedDate}
                    onFocus={() => setDateFocused(true)}
                    onChange={(e) => setDate(normalizeDateTyping(e.target.value))}
                    onBlur={() => {
                      setDateFocused(false);
                      if (dateComplete) setDate(normalizedDate);
                    }}
                    className={`w-full px-3 py-2.5 pr-10 rounded-xl bg-surface-secondary border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${dateInvalid ? 'border-red-500' : 'border-border'}`}
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openDatePicker}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-primary"
                    aria-label="날짜 선택"
                  >
                    <CalendarDays size={16} />
                  </button>
                  <input
                    ref={datePickerRef}
                    type="date"
                    tabIndex={-1}
                    className="sr-only"
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">{t('transactions.memo')}</label>
                <input
                  type="text"
                  placeholder={t('transactions.description')}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-text-secondary">{t('transactions.journalLines')}</label>
                <button type="button" onClick={addEntryRow} className="text-xs text-primary hover:underline" >
                  + {t('transactions.addLine')}
                </button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[70px_1fr_90px_28px] gap-2 text-[10px] text-text-tertiary px-1">
                  <span>{t('transactions.drCr')}</span>
                  <span>{t('nav.accounts')}</span>
                  <span className="text-right">{t('transactions.amount')}</span>
                  <span />
                </div>
                {entries.map((entry, idx) => (
                  <div key={idx} className="grid grid-cols-[70px_1fr_90px_28px] gap-2">
                    <select
                      value={entry.type}
                      onChange={(e) => {
                        const next = [...entries];
                        next[idx].type = e.target.value as 'DR' | 'CR';
                        setEntries(next);
                      }}
                      className={`px-2 py-2 rounded-lg border text-xs ${
                        entry.type === 'DR'
                          ? 'bg-expense/5 border-expense/20 text-expense'
                          : 'bg-income/5 border-income/20 text-income'
                      }`}
                    >
                      <option value="DR">{t('transactions.debit')}</option>
                      <option value="CR">{t('transactions.credit')}</option>
                    </select>
                    <input
                      type="text"
                      placeholder={t('nav.accounts')}
                      value={entry.accountName}
                      onChange={(e) => {
                        const next = [...entries];
                        next[idx].accountName = e.target.value;
                        setEntries(next);
                      }}
                      className="px-2 py-2 rounded-lg bg-surface-secondary border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={entry.amount}
                      onChange={(e) => {
                        const next = [...entries];
                        next[idx].amount = stripNonDigits(e.target.value);
                        setEntries(next);
                      }}
                      className="px-2 py-2 rounded-lg bg-surface-secondary border border-border text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => removeEntryRow(idx)}
                      className="text-text-tertiary hover:text-expense text-xs"
                      tabIndex={-1}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Balance indicator */}
            <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
              isBalanced ? 'bg-income/10 text-income' :
              drTotal === 0 && crTotal === 0 ? 'bg-surface-secondary text-text-tertiary' :
              'bg-expense/10 text-expense'
            }`}>
              <div className="flex gap-4">
                <span>{t('transactions.debitTotal')}: {formatKRW(drTotal)}</span>
                <span>{t('transactions.creditTotal')}: {formatKRW(crTotal)}</span>
              </div>
              <span className="font-medium">
                {isBalanced ? `✓ ${t('transactions.balanced')}` : drTotal === 0 && crTotal === 0 ? t('transactions.waitingInput') : `${t('transactions.diff')} ${formatKRW(Math.abs(drTotal - crTotal))}`}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isBalanced}
            className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-dark transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('transactions.saveJournal')}
          </button>

          <p className="text-[10px] text-text-tertiary text-center">
            {t('transactions.balanceRequired')}
          </p>
        </form>
      )}
    </div>
  );
}
