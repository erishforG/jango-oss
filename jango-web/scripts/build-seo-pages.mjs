import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST_DIR = new URL('../dist/', import.meta.url);
const BASE_URL = 'https://jango.monster';

const pages = [
  {
    route: 'login',
    title: 'Jango(잔고) | 쉽게 쓰는 복식부기 가계부 · 자산 관리',
    description:
      '잔고(Jango)는 단식 가계부처럼 쉽게 입력하면서 속은 복식부기로 기록되는 무료 가계부 서비스. 자산·부채·순자산을 한눈에 보고, 월별 수입/지출 흐름과 카테고리 트렌드까지 자동 정리.',
    ogTitle: 'Jango(잔고) | 쉽게 쓰는 복식부기 가계부',
    ogDescription:
      '단식처럼 입력, 속은 복식부기. 자산·부채·순자산 시각화와 월별 흐름 자동 분석까지. 무료.',
  },
  {
    route: 'help',
    title: '도움말 · Jango(잔고) — 복식부기 가계부 가이드',
    description:
      '잔고 가계부 사용 가이드 — 첫 거래 입력, CSV 가져오기, 신용카드 청구 기간 설정, 예산 운영, Whooing 마이그레이션 매핑까지.',
  },
  {
    route: 'privacy',
    title: '개인정보 처리방침 · Jango(잔고)',
    description:
      '잔고(Jango) 가계부 서비스 개인정보 처리방침. 수집·이용 항목, 보관 기간, 제3자 제공, 이용자 권리.',
  },
  {
    route: 'terms',
    title: '이용약관 · Jango(잔고)',
    description:
      '잔고(Jango) 가계부 서비스 이용약관. 회원의 권리·의무, 서비스 이용 범위, 책임의 한계.',
  },
  {
    route: 'tools/salary-planner',
    title: '월급 배분 계산기 · Jango(잔고)',
    description:
      '월급, 고정비, 생활비, 저축, 상환 계획을 입력하고 다음 월급일까지 하루 예산과 현금흐름 위험도를 확인하세요.',
    ogTitle: '월급 배분 계산기 · Jango(잔고)',
    ogDescription:
      '로그인 없이 월급 배분표를 만들고, 잔고에서 매달 예산과 지출 흐름을 이어서 관리하세요.',
  },
  {
    route: 'ko/tools/salary-planner',
    title: '월급 배분 계산기 · Jango(잔고)',
    description:
      '월급, 고정비, 생활비, 저축, 상환 계획을 입력하고 다음 월급일까지 하루 예산과 현금흐름 위험도를 확인하세요.',
    ogTitle: '월급 배분 계산기 · Jango(잔고)',
    ogDescription:
      '로그인 없이 월급 배분표를 만들고, 잔고에서 매달 예산과 지출 흐름을 이어서 관리하세요.',
  },
  {
    route: 'en/tools/salary-planner',
    title: 'Paycheck Budget Calculator · Jango',
    description:
      'Plan your paycheck across fixed costs, spending, savings, and debt. See what is left and how much you can spend each day until payday.',
    ogTitle: 'Paycheck Budget Calculator · Jango',
    ogDescription:
      'Build a paycheck plan without signing in, then track monthly budgets and cash flow in Jango.',
  },
  {
    route: 'ja/tools/salary-planner',
    title: '給料振り分け計算機 · Jango',
    description:
      '給料、固定費、生活費、貯金、返済額を入力して、次の給料日までの1日予算と家計の余裕を確認できます。',
    ogTitle: '給料振り分け計算機 · Jango',
    ogDescription:
      'ログインなしで給料の配分を作り、Jangoで毎月の予算と支出の流れを管理できます。',
  },
];

const indexPath = new URL('index.html', DIST_DIR);
const template = await readFile(indexPath, 'utf8');

for (const page of pages) {
  const canonical = `${BASE_URL}/${page.route}`;
  const html = renderSeoPage(template, {
    ...page,
    canonical,
    ogTitle: page.ogTitle ?? page.title,
    ogDescription: page.ogDescription ?? page.description,
  });
  const outputPath = new URL(`seo/${page.route}.html`, DIST_DIR);
  await mkdir(dirname(fileURLToPath(outputPath)), { recursive: true });
  await writeFile(outputPath, html);
}

function renderSeoPage(
  html,
  { title, description, canonical, ogTitle, ogDescription },
) {
  return html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeAttr(description)}" />`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${canonical}" />`,
    )
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${escapeAttr(ogTitle)}" />`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${escapeAttr(ogDescription)}" />`,
    )
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${canonical}" />`,
    )
    .replace(
      /<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${escapeAttr(ogTitle)}" />`,
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${escapeAttr(ogDescription)}" />`,
    );
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
