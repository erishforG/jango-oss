import { useEffect } from 'react';

interface PageSEOOptions {
  title: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
}

/**
 * 라우트 단위로 document.title, meta description, og:title/og:description, canonical을
 * 업데이트해 검색 엔진(SEO)과 AI 응답 엔진(AEO)이 각 페이지를 구분해 인덱싱하게 한다.
 *
 * SPA에서 index.html의 정적 meta는 첫 로드 시점의 값만 갖기 때문에, 페이지 전환 시
 * 이 훅이 호출돼야 검색 결과·소셜 카드에서 페이지별 제목/설명이 보인다.
 *
 * 페이지가 unmount 되어도 명시적인 reset은 하지 않는다. 다음 페이지가 자기 useEffect로
 * 덮어쓰므로 누수 없음.
 */
export function usePageSEO({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
}: PageSEOOptions): void {
  useEffect(() => {
    document.title = title;

    if (description) {
      setMeta('name', 'description', description);
    }

    if (canonical) {
      setLinkRel('canonical', canonical);
    }

    setMeta('property', 'og:title', ogTitle ?? title);
    if (ogDescription ?? description) {
      setMeta('property', 'og:description', (ogDescription ?? description)!);
    }
    if (canonical) {
      setMeta('property', 'og:url', canonical);
    }

    setMeta('name', 'twitter:title', ogTitle ?? title);
    if (ogDescription ?? description) {
      setMeta('name', 'twitter:description', (ogDescription ?? description)!);
    }
  }, [title, description, canonical, ogTitle, ogDescription]);
}

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLinkRel(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}
