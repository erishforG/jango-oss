import { Link, useNavigate } from 'react-router-dom';
import { usePageSEO } from '../hooks/usePageSEO';
import { Shield, Database, Download, Trash2, Lock, Mail } from 'lucide-react';

/**
 * Security & Data Ownership page — Issue #843 Phase 1
 *
 * Explains to users:
 *  - Where data is stored
 *  - That there are no external financial integrations
 *  - How to export / delete their data
 *  - Account security model (Google OAuth only)
 *  - Contact channel
 *
 * Public route (/security): accessible without login so potential users
 * can build trust before signing up.
 */
export default function Security() {
  const navigate = useNavigate();

  usePageSEO({
    title: '보안 & 데이터 소유권 · Jango(잔고)',
    description:
      '잔고(Jango) 가계부 서비스의 데이터 저장 위치, 외부 연동 정책, 내보내기·삭제 방법, 계정 보안 모델을 안내합니다.',
    canonical: 'https://jango.monster/security',
  });

  return (
    <div className="min-h-screen bg-surface-secondary py-10 px-4 relative">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        aria-label="닫기"
        className="fixed top-4 right-4 z-10 h-10 w-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition"
      >
        ✕
      </button>

      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-6 sm:p-8 space-y-10">
        {/* Header */}
        <header>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-6 h-6 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-text-primary">보안 &amp; 데이터 소유권</h1>
          </div>
          <p className="text-sm text-text-secondary leading-7">
            잔고는 여러분의 금융 데이터를 소중히 다룹니다.
            이 페이지에서 데이터가 어디에 저장되는지, 어떻게 가져가거나 삭제할 수 있는지 투명하게 안내합니다.
          </p>
        </header>

        {/* Section 1: Where is data stored */}
        <section aria-labelledby="storage-heading">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 id="storage-heading" className="text-base font-semibold text-text-primary">
              데이터는 어디에 저장되나요?
            </h2>
          </div>
          <div className="text-sm text-text-secondary leading-7 space-y-3">
            <p>
              잔고의 모든 가계부 데이터(장부·계정과목·거래·분개)는{' '}
              <strong className="text-text-primary">Supabase(PostgreSQL)</strong>에 암호화된 연결로 저장됩니다.
              서버 인프라는 Google Cloud Run(asia-northeast1 · 도쿄 리전)에서 운영됩니다.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>저장소: Supabase 관리형 PostgreSQL (행 단위 접근 제어 적용)</li>
              <li>전송: HTTPS/TLS 1.2+ (Cloudflare CDN 경유)</li>
              <li>인증: Google OAuth 2.0 — 비밀번호를 잔고 서버에 저장하지 않습니다</li>
            </ul>
            <p className="text-xs text-text-tertiary">
              ※ 금융기관 계좌번호·카드번호·비밀번호 등 직접적인 금융식별정보는 수집·저장하지 않습니다.
            </p>
          </div>
        </section>

        {/* Section 2: No external financial integrations */}
        <section aria-labelledby="integration-heading">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 id="integration-heading" className="text-base font-semibold text-text-primary">
              외부 금융 연동이 없습니다
            </h2>
          </div>
          <div className="text-sm text-text-secondary leading-7 space-y-3">
            <p>
              잔고는 은행 API, 오픈뱅킹, 카드사 스크래핑 등 외부 금융 시스템과 직접 연동하지 않습니다.
              사용자가 자신의 금융 계정 자격증명(아이디·비밀번호·OTP)을 잔고에 제공할 필요가 없습니다.
            </p>
            <p>
              현재 지원하는 자동화 방식:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-text-primary">카드 SMS 웹훅</strong> —
                사용자가 자신의 기기에서 카드사 SMS를 잔고 웹훅 URL로 직접 전달하는 방식입니다.
                잔고는 SMS 텍스트만 수신·파싱하며, 금융기관에 직접 접근하지 않습니다.
              </li>
              <li>
                <strong className="text-text-primary">CSV 가져오기</strong> —
                사용자가 직접 내려받은 거래 내역 파일을 업로드하는 방식입니다.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 3: Data export */}
        <section aria-labelledby="export-heading">
          <div className="flex items-center gap-2 mb-3">
            <Download className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 id="export-heading" className="text-base font-semibold text-text-primary">
              언제든지 데이터를 가져갈 수 있습니다
            </h2>
          </div>
          <div className="text-sm text-text-secondary leading-7 space-y-3">
            <p>
              서비스에 종속되지 않도록, 잔고는 전체 가계부 데이터를 언제든 내보낼 수 있습니다.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-text-primary">JSON 전체 백업</strong> —
                장부·계정과목·거래·분개 전체를 JSON 파일로 다운로드.
                설정 → 데이터 관리에서 이용 가능.
              </li>
            </ul>
            <p>
              주기적으로 백업을 내려받아 두시길 권장합니다.
            </p>
          </div>
        </section>

        {/* Section 4: Data deletion */}
        <section aria-labelledby="deletion-heading">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 id="deletion-heading" className="text-base font-semibold text-text-primary">
              데이터 삭제 및 계정 탈퇴
            </h2>
          </div>
          <div className="text-sm text-text-secondary leading-7 space-y-3">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-text-primary">데이터 초기화</strong> —
                계정은 유지하고 가계부 데이터(장부·계정과목·거래)만 삭제.
                설정 → 위험 구역에서 이용 가능.
              </li>
              <li>
                <strong className="text-text-primary">회원탈퇴</strong> —
                계정과 모든 데이터를 즉시 영구 삭제. 복구 불가.
                탈퇴 전 삭제될 데이터 규모를 미리 확인하고 JSON 백업을 내려받도록 안내합니다.
              </li>
            </ul>
            <p className="text-xs text-text-tertiary">
              ※ 서비스 접속 로그는 90일, 오류 분석 로그는 30일 후 자동 삭제됩니다.
              자세한 내용은{' '}
              <Link to="/privacy" className="underline hover:text-text-primary">
                개인정보처리방침
              </Link>
              을 참고하세요.
            </p>
          </div>
        </section>

        {/* Section 5: Account security */}
        <section aria-labelledby="account-security-heading">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 id="account-security-heading" className="text-base font-semibold text-text-primary">
              계정 보안
            </h2>
          </div>
          <div className="text-sm text-text-secondary leading-7 space-y-3">
            <p>
              잔고는 Google OAuth 2.0으로만 로그인합니다. 별도 비밀번호를 잔고에 설정하지 않으므로,
              Google 계정 보안(2단계 인증 등)이 잔고 접근 보안과 직결됩니다.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Google 계정에 2단계 인증을 활성화하세요.</li>
              <li>공용 기기에서는 사용 후 반드시 로그아웃하세요.</li>
              <li>계정 이상 활동이 의심되면 Google 계정 보안 페이지에서 기기 세션을 확인하세요.</li>
            </ul>
          </div>
        </section>

        {/* Section 6: Contact */}
        <section aria-labelledby="contact-heading">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 id="contact-heading" className="text-base font-semibold text-text-primary">
              문의 채널
            </h2>
          </div>
          <div className="text-sm text-text-secondary leading-7 space-y-3">
            <p>
              데이터 관련 문의, 보안 취약점 신고, 개인정보 열람·정정·삭제 요청은 아래로 연락해 주세요.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                이메일:{' '}
                <a
                  href="mailto:support@jango.monster"
                  className="underline hover:text-text-primary"
                >
                  support@jango.monster
                </a>
              </li>
              <li>
                도움말:{' '}
                <Link to="/help" className="underline hover:text-text-primary">
                  /help
                </Link>
              </li>
            </ul>
            <p className="text-xs text-text-tertiary">
              보안 취약점 신고는 공개 채널보다 이메일을 통해 비공개로 제보해 주시면 감사하겠습니다.
            </p>
          </div>
        </section>

        {/* Footer nav */}
        <footer className="border-t border-border pt-6 text-xs text-text-tertiary flex flex-wrap gap-3">
          <Link to="/privacy" className="hover:text-text-secondary hover:underline">
            개인정보처리방침
          </Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-text-secondary hover:underline">
            이용약관
          </Link>
          <span>·</span>
          <Link to="/help" className="hover:text-text-secondary hover:underline">
            도움말
          </Link>
        </footer>
      </div>
    </div>
  );
}
