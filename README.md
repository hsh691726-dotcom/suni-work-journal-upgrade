# 경영지원팀 업무일지 업그레이드

기존 Streamlit 업무일지를 Vercel + Supabase 배포에 맞게 새로 만든 React 웹앱입니다.

## 지금 되는 기능

- 첫 화면 달력 보기
- 날짜 클릭 후 업무 추가
- 한 날짜에 여러 업무 등록
- 업무 수정, 삭제, 상태 변경
- 오늘/이번주/이달 대시보드
- 매월 같은 날짜 반복 업무 자동 표시
- 전체 업무 목록
- 검색, 상태 필터, 업무유형 필터
- 샘플 데이터 넣기
- CSV 다운로드
- Supabase 연결 전에는 브라우저 localStorage 저장
- Supabase 환경변수를 넣으면 Supabase DB 저장

## 로컬 실행

```powershell
pnpm install
pnpm dev
```

브라우저에서 표시되는 주소를 엽니다. 보통 아래 주소입니다.

```text
http://127.0.0.1:5173
```

## Supabase 환경변수

`.env.example` 파일을 복사해 `.env.local` 파일을 만들고 값을 넣습니다.

```text
VITE_SUPABASE_URL=Supabase Project URL
VITE_SUPABASE_ANON_KEY=Supabase anon public key
```

주의:

- `.env.local`은 GitHub에 올리면 안 됩니다.
- service role key는 사용하지 않습니다.
- database password도 코드에 넣지 않습니다.

## Supabase 테이블 만들기

Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.

## 배포

Vercel에서 GitHub repository를 연결하면 자동 배포할 수 있습니다.

Vercel 환경변수에도 아래 두 값을 넣어야 Supabase 저장이 작동합니다.

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
