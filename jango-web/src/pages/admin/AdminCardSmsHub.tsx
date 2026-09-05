import { useState } from 'react';
import AdminWebhookIngestion from './AdminWebhookIngestion';
import AdminParsingReinforcement from './AdminParsingReinforcement';
import AdminRuleManagement from './AdminRuleManagement';
import AdminCardSmsAiConfig from './AdminCardSmsAiConfig';
import AdminCardSmsProposals from './AdminCardSmsProposals';

const tabs = [
  { key: 'ingestion', label: '인입 모니터링' },
  { key: 'parsing', label: '파싱 규칙 강화' },
  { key: 'rules', label: '카드사별 룰' },
  { key: 'ai-config', label: 'AI 설정' },
  { key: 'ai-proposals', label: 'AI 제안 관리' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

export default function AdminCardSmsHub() {
  const [activeTab, setActiveTab] = useState<TabKey>('ingestion');

  return (
    <section className="bg-surface rounded-xl border border-border p-4 md:p-5 space-y-4">
      <h3 className="text-base font-semibold">📱 카드 SMS 관리</h3>

      <div className="inline-flex rounded-xl border border-border bg-surface p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${
              activeTab === tab.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'ingestion' && <AdminWebhookIngestion />}
        {activeTab === 'parsing' && <AdminParsingReinforcement />}
        {activeTab === 'rules' && <AdminRuleManagement />}
        {activeTab === 'ai-config' && <AdminCardSmsAiConfig />}
        {activeTab === 'ai-proposals' && <AdminCardSmsProposals />}
      </div>
    </section>
  );
}
