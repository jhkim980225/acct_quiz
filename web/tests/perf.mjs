// 속도 하네스. 실행: node tests/perf.mjs [BASE]
// 기본 BASE=https://acct-quiz.vercel.app, 로컬은 node tests/perf.mjs http://localhost:3100
// 주요 페이지 TTFB·전체 응답시간 중앙값을 재고 임계 초과 시 exit 1.
const BASE = process.argv[2] ?? "https://acct-quiz.vercel.app";
const RUNS = 5;

// [경로, TTFB 임계(ms), 총시간 임계(ms)] — 정적(SSG/ISR)은 빡빡하게, 동적은 여유
const TARGETS = [
  ["/", 800, 3000],
  ["/전산회계1급/재고자산", 800, 3000],
  ["/전산회계1급/분개", 800, 3000],
  ["/quiz", 1500, 4000], // dynamic
  ["/api/wrong-stats", 2500, 4000], // 서버 집계(캐시 미스 포함)
  ["/sitemap.xml", 1500, 3000],
];

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

let fail = 0;
for (const [path, ttfbLimit, totalLimit] of TARGETS) {
  const ttfbs = [], totals = [];
  let status = 0;
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const res = await fetch(BASE + encodeURI(path), { redirect: "follow" });
    const ttfb = performance.now() - t0;
    await res.arrayBuffer();
    const total = performance.now() - t0;
    status = res.status;
    if (res.status !== 200) break;
    ttfbs.push(ttfb);
    totals.push(total);
  }
  if (status !== 200) {
    console.log(`FAIL ${path} — HTTP ${status}`);
    fail++;
    continue;
  }
  const t = Math.round(median(ttfbs));
  const tot = Math.round(median(totals));
  const over = t > ttfbLimit || tot > totalLimit;
  if (over) fail++;
  console.log(
    `${over ? "FAIL" : " ok "} ${path}  TTFB ${t}ms (≤${ttfbLimit})  total ${tot}ms (≤${totalLimit})`,
  );
}
console.log(fail ? `\n${fail}개 경로 임계 초과` : "\n전체 통과");
process.exit(fail ? 1 : 0);
