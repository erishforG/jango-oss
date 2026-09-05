import { useNavigate } from 'react-router-dom';
import { usePageSEO } from '../hooks/usePageSEO';

export default function Terms() {
  const navigate = useNavigate();

  usePageSEO({
    title: '이용약관 · Jango(잔고)',
    description:
      '잔고(Jango) 가계부 서비스 이용약관. 회원의 권리·의무, 서비스 이용 범위, 책임의 한계.',
    canonical: 'https://jango.monster/terms',
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
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">이용약관</h1>
        <p className="text-sm text-text-tertiary mb-8">시행일자: 2026-02-23</p>

        <div className="space-y-6 text-sm leading-7 text-text-secondary">
          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제1조 (목적)</h2>
            <p>
              본 약관은 Jango(이하 "서비스")가 제공하는 복식부기 가계부 서비스의 이용과 관련하여,
              서비스와 이용자 간 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제2조 (정의)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>"이용자"란 본 약관에 따라 서비스를 이용하는 회원을 의미합니다.</li>
              <li>"회원"이란 Google 로그인 등 회사가 정한 절차를 통해 가입한 자를 의미합니다.</li>
              <li>"콘텐츠"란 이용자가 서비스에 입력/업로드한 거래, 계정, 메모 등 일체의 데이터를 의미합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제3조 (약관의 효력 및 변경)</h2>
            <p>
              서비스는 본 약관의 내용을 서비스 화면에 게시하거나 기타 방법으로 공지함으로써 효력이 발생합니다.
              관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 중요한 변경은 사전에 공지합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제4조 (회원가입 및 계정관리)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원가입은 이용자가 약관에 동의하고 서비스가 이를 승인함으로써 성립합니다.</li>
              <li>이용자는 계정정보를 정확하게 제공하고 최신 상태로 유지해야 합니다.</li>
              <li>계정의 관리 책임은 이용자에게 있으며, 부정 사용 발견 시 즉시 회사에 알려야 합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제5조 (서비스 제공)</h2>
            <p>
              서비스는 가계부 작성, 거래/계정 관리, 통계 및 리포트 기능 등 재무관리 기능을 제공합니다.
              운영상·기술상 필요에 따라 서비스의 일부 또는 전부를 변경할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제6조 (서비스 이용 제한)</h2>
            <p className="mb-2">이용자는 다음 행위를 해서는 안 됩니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>타인의 개인정보/계정 도용</li>
              <li>서비스 운영을 고의로 방해하는 행위</li>
              <li>법령 또는 공서양속에 반하는 콘텐츠 게시</li>
              <li>시스템 취약점 악용, 비정상 트래픽 유발 등 보안 위협 행위</li>
            </ul>
            <p className="mt-2">위반 시 서비스 이용이 제한되거나 계정이 해지될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제7조 (이용자 콘텐츠와 권리)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>이용자가 입력한 콘텐츠의 권리는 원칙적으로 이용자에게 귀속됩니다.</li>
              <li>서비스 제공 및 개선을 위해 필요한 범위에서 콘텐츠를 처리할 수 있습니다.</li>
              <li>이용자는 관련 법령 및 타인의 권리를 침해하지 않는 콘텐츠만 등록해야 합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제8조 (개인정보 보호)</h2>
            <p>
              서비스는 개인정보 보호 관련 법령을 준수하며, 개인정보의 처리에 관한 사항은
              별도의 개인정보처리방침에 따릅니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제9조 (면책)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>천재지변, 불가항력, 제3자의 위법행위 등으로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.</li>
              <li>이용자 귀책사유로 발생한 손해에 대해 회사는 책임을 지지 않습니다.</li>
              <li>서비스 내 정보는 참고용이며, 최종 의사결정(투자/재무 등)의 책임은 이용자에게 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제10조 (서비스 종료 및 회원 탈퇴)</h2>
            <p>
              이용자는 언제든지 회원 탈퇴를 요청할 수 있으며, 서비스는 관련 법령 및 개인정보처리방침에 따라
              정보를 처리합니다. 서비스 종료 시 사전 고지를 원칙으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">제11조 (준거법 및 관할)</h2>
            <p>
              본 약관은 대한민국 법령을 준거법으로 하며, 서비스 이용과 관련하여 분쟁이 발생한 경우
              관련 법령에 따른 관할 법원을 따릅니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
