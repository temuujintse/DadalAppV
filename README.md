# Family Habit

**Build better habits together.** Хувь хүн болон гэр бүлд зориулсан, gamification болон animated pet бүхий дадал хэвшүүлэх mobile app.

| Хэсэг | Технологи |
|---|---|
| `backend/` | NestJS 11 · Prisma 7 · PostgreSQL 16 · JWT (access + rotating refresh) · Swagger |
| `mobile/` | Expo SDK 58 · React Native 0.88 · Expo Router · TanStack Query · Zustand · RHF + Zod · Reanimated 4 |
| `docker-compose.yml` | Local PostgreSQL (host port **5433**) + `family_habit_test` DB |
| `docs/ARCHITECTURE.md` | Архитектур, шийдвэрүүд, roadmap, AI интеграцийн төлөвлөгөө |
| `docs/DEPLOYMENT.md` | Production: Docker stack, нөөц, хяналт, EAS build/submit, шалгах хуудас |
| `docker-compose.prod.yml` | Production stack (Postgres + migrate job + API) |
| `.github/workflows/ci.yml` | CI: backend lint/typecheck/unit/e2e/audit, Docker image, mobile checks |
| `family_habit_spec.tex/.pdf` | Бүтээгдэхүүний тодорхойлолт (v1.2) |

## Шаардлага

- Node.js ≥ 22 (24 дээр туршсан), npm
- Docker Desktop
- iOS: Xcode + Simulator (эсвэл утсан дээрх Expo Go), Android: Android Studio emulator

## Эхлүүлэх

```bash
docker compose up -d
```

```bash
cd backend && cp .env.example .env   # дараа нь JWT_ACCESS_SECRET, INVITE_TOKEN_SECRET-ийг солино
```

```bash
cd backend && npm install && npx prisma migrate deploy && npm run db:seed
```

```bash
cd backend && npm run start:dev
```

API: `http://localhost:3000/api/v1` · Swagger: `http://localhost:3000/api/v1/docs`

```bash
cd mobile && npm install && npx expo start
```

Development үед app нь Metro host-оос API хаягийг автоматаар тодорхойлно (`http://<host>:3000/api/v1`). Өөр сервер ашиглах бол `mobile/.env`-д `EXPO_PUBLIC_API_URL` тохируулна (`mobile/.env.example`-ийг үз).

## Шалгалт

| Команд | Юуг шалгах |
|---|---|
| `cd backend && npm run lint && npm run typecheck` | ESLint + TypeScript |
| `cd backend && npm test` | Unit tests |
| `cd backend && cp .env.test.example .env.test && npm run test:e2e` | Бодит PostgreSQL (`family_habit_test`) дээрх e2e: auth, family, isolation, concurrency |
| `cd mobile && npm run lint && npm run typecheck && npm test` | Expo lint, TypeScript, unit tests |

> `test:e2e` нь `DATABASE_URL`-д `_test` ороогүй бол ажиллахаас татгалзана — development өгөгдлийг санамсаргүй устгахаас хамгаална.
