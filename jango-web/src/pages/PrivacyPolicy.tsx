import { useNavigate } from 'react-router-dom';
import { usePageSEO } from '../hooks/usePageSEO';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  usePageSEO({
    title: '개인정보 처리방침 · Jango(잔고)',
    description:
      '잔고(Jango) 가계부 서비스 개인정보 처리방침. 수집·이용 항목, 보관 기간, 제3자 제공, 이용자 권리.',
    canonical: 'https://jango.monster/privacy',
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
        <h1 className="text-2xl font-bold text-text-primary mb-2">개인정보처리방침</h1>
        <p className="text-sm text-text-tertiary mb-1">공고일자: 2026-02-23</p>
        <p className="text-sm text-text-tertiary mb-8">시행일자: 2026-02-23</p>

        <div className="space-y-6 text-sm leading-7 text-text-secondary">
          <p>
            Jango(이하 “서비스”)는 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을
            준수합니다. 본 개인정보처리방침은 서비스 이용 과정에서 개인정보가 어떤 항목으로 수집되고,
            어떤 목적으로 이용되며, 언제 파기되는지 안내합니다.
          </p>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">1. 수집하는 개인정보 항목 및 수집방법</h2>
            <p className="mb-2 font-medium text-text-primary">1-1. 수집 항목</p>
            <p>서비스는 다음 정보를 수집할 수 있습니다.</p>

            <p className="mt-3 font-medium text-text-primary">① 계정 및 식별 정보</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>이메일 주소</li>
              <li>표시 이름(닉네임)</li>
              <li>Google 계정 식별자(google_id)</li>
            </ul>

            <p className="mt-3 font-medium text-text-primary">② 서비스 설정 정보</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>언어(locale)</li>
              <li>기준통화(baseCurrency)</li>
              <li>시간대(timezone)</li>
            </ul>

            <p className="mt-3 font-medium text-text-primary">③ 가계부 데이터</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>장부 정보</li>
              <li>계정 정보(계좌/카드/자산·부채 계정명, 메모 등)</li>
              <li>거래 정보(일시, 금액, 통화, 설명, 메모, 태그, 분개 정보)</li>
              <li>CSV 업로드 데이터</li>
            </ul>
            <p className="mt-2">
              ※ 서비스는 금융기관 계좌번호, 카드번호, 비밀번호 등 직접적인 금융식별정보를 수집하거나 저장하지
              않습니다.
              <br />※ 이용자가 자유 입력란에 민감한 금융정보를 기재하지 않도록 주의해야 합니다.
            </p>

            <p className="mt-3 font-medium text-text-primary">④ 서비스 이용 정보 (자동 수집)</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>접속 로그</li>
              <li>접속 IP 정보</li>
              <li>브라우저 및 디바이스 정보(User-Agent 등)</li>
              <li>쿠키 및 유사 기술 기반 인증 정보</li>
            </ul>

            <p className="mt-3 mb-2 font-medium text-text-primary">1-2. 수집 방법</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Google 로그인</li>
              <li>이용자의 직접 입력</li>
              <li>CSV 업로드</li>
              <li>서비스 이용 과정에서의 자동 수집</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">2. 개인정보의 수집 및 이용 목적</h2>
            <p>서비스는 수집한 개인정보를 다음 목적에 한해 이용합니다.</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>회원 식별 및 인증, 계정 관리</li>
              <li>가계부 서비스 제공(기록, 조회, 통계, 리포트 기능)</li>
              <li>서비스 안정성 및 보안 확보, 부정 이용 방지</li>
              <li>문의 대응 및 분쟁 처리</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">3. 개인정보의 보유 및 이용기간</h2>
            <p>서비스는 개인정보 수집·이용 목적이 달성되면 지체 없이 파기하는 것을 원칙으로 합니다.</p>
            <p className="mt-2 font-medium text-text-primary">① 회원 계정정보 및 가계부 데이터</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>보유기간: 회원 탈퇴 시까지</li>
              <li>파기시점: 회원 탈퇴 즉시 파기</li>
            </ul>

            <p className="mt-2 font-medium text-text-primary">② 서비스 접속 로그(IP, User-Agent 등)</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>보유기간: 90일</li>
              <li>보존기간 경과 시 자동 삭제</li>
            </ul>

            <p className="mt-2 font-medium text-text-primary">③ 오류/장애 분석 로그</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>보유기간: 30일</li>
              <li>보존기간 경과 시 자동 삭제</li>
            </ul>

            <p className="mt-2 font-medium text-text-primary">④ 보안 이상징후 탐지 로그</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>보유기간: 180일</li>
              <li>보존기간 경과 시 자동 삭제</li>
            </ul>

            <p className="mt-2">
              ※ 단, 관련 법령에 따라 보관 의무가 발생하는 경우 해당 법령에서 정한 기간 동안 보관할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">4. 개인정보의 파기절차 및 방법</h2>
            <p className="font-medium text-text-primary">① 파기절차</p>
            <p>회원 탈퇴 또는 처리 목적 달성 시 파기 대상 정보를 식별하여 지체 없이 파기합니다.</p>
            <p className="mt-2 font-medium text-text-primary">② 파기방법</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>전자적 파일: 복구가 어려운 기술적 방법으로 삭제</li>
              <li>출력물(해당 시): 분쇄 또는 소각</li>
            </ul>
            <p className="mt-2">※ 탈퇴 후 즉시 삭제된 데이터는 복구가 불가능할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">5. 개인정보의 제3자 제공</h2>
            <p>서비스는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만, 다음의 경우는 예외로 합니다.</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령에 근거한 수사기관 등의 적법한 요청이 있는 경우</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">6. 개인정보 처리의 위탁</h2>
            <p>
              서비스 운영을 위해 클라우드 인프라, 인증 서비스, 로그 관리 도구 등 외부 서비스 제공자를 이용할 수
              있으며, 이 과정에서 개인정보 처리가 수반될 수 있습니다. 위탁이 발생하는 경우 관련 법령에 따라
              수탁자 및 위탁업무 내용을 공개합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">7. 이용자의 권리 및 행사방법</h2>
            <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>개인정보 조회 및 수정</li>
              <li>회원 탈퇴 및 삭제 요청</li>
              <li>개인정보 처리 정지 요청</li>
            </ol>
            <p className="mt-2">권리 행사는 서비스 내 기능 또는 문의 채널을 통해 가능하며, 서비스는 관련 법령에 따라 지체 없이 조치합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">8. 개인정보 자동 수집 장치(쿠키 등)의 운영 및 거부</h2>
            <p>
              서비스는 인증 유지 및 서비스 제공을 위해 쿠키 또는 유사 기술을 사용할 수 있습니다. 이용자는 브라우저
              설정을 통해 쿠키 저장을 거부할 수 있으나, 일부 기능 이용이 제한될 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">9. 개인정보의 안전성 확보조치</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>접근 권한 최소화 및 권한 통제</li>
              <li>HTTPS 기반 암호화 통신</li>
              <li>관리자 접근 기록 관리</li>
              <li>보안 점검 및 비인가 접근 방지</li>
              <li>내부 관리적 보호조치 시행</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">10. 만 14세 미만 아동의 개인정보</h2>
            <p>본 서비스는 만 14세 미만 아동을 대상으로 하지 않습니다. 만 14세 미만 아동의 개인정보를 고의로 수집하지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">11. 개인정보 보호책임자 및 문의</h2>
            <p>개인정보 처리 관련 문의는 아래 채널로 접수할 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>담당자: [기입 예정]</li>
              <li>이메일: [기입 예정]</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">12. 고지의 의무</h2>
            <p>
              본 개인정보처리방침의 내용이 추가·삭제·수정되는 경우, 시행일 최소 7일 전 서비스 공지 또는 본 페이지를
              통해 고지합니다.
            </p>
            <p className="mt-2">공고일자: 2026-02-23</p>
            <p>시행일자: 2026-02-23</p>
          </section>
        </div>
      </div>
    </div>
  );
}
