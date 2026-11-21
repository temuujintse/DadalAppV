# Family Habit — Deployment runbook

Энэ баримт backend-ийг Docker-оор production-д гаргах, mobile аппыг EAS-ээр build хийх алхмуудыг агуулна. Бүх нууц утга зөвхөн серверийн `.env.production` болон EAS environment-д хадгалагдана — git-д хэзээ ч орохгүй.

## 1. Backend (Docker)

### 1.1 Шаардлага
- Docker 24+ ба Docker Compose v2 бүхий Linux сервер
- Домэйн (жишээ: `api.familyhabit.example`) ба TLS терминал хийх reverse proxy (Caddy, nginx эсвэл cloud load balancer)

### 1.2 Анхны суулгалт
```bash
git clone <repo> family-habit && cd family-habit
cp .env.production.example .env.production
# Нууц утга бүрийг шинээр үүсгэнэ:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
chmod 600 .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
Эхлэх дараалал: `postgres` (healthy) → `migrate` (`prisma migrate deploy` + лавлах өгөгдлийн idempotent seed) → `api` (healthcheck `/api/v1/health`).

API зөвхөн `127.0.0.1:${API_PORT}` дээр сонсоно. Reverse proxy-ийн жишээ (Caddy):
```
api.familyhabit.example {
  reverse_proxy 127.0.0.1:3000
}
```
API нь production-д `trust proxy = 1` тул rate limit жинхэнэ клиентийн IP-ээр ажиллана — proxy-г API-ийн өмнө яг нэг давхар байлгана.

### 1.3 Шинэ хувилбар гаргах
```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps   # api: healthy
```
Migration нь API эхлэхээс өмнө ажиллана; амжилтгүй бол API шинэчлэгдэхгүй (хуучин container ажилласаар).

### 1.4 Буцаах (rollback)
- Код: өмнөх commit/tag руу `git checkout` хийгээд 1.3-ыг давтана.
- Migration-ууд зөвхөн нэмэлт (additive) байхаар бичигдсэн. Схемийг буцаах шаардлагатай бол нөөцөөс сэргээнэ (1.5).

### 1.5 Нөөц (backup)
```bash
# Өдөр бүр (cron), 14 хоног хадгална
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backup-$(date +%F).dump
find . -name 'backup-*.dump' -mtime +14 -delete
# Сэргээх
docker compose ... exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean' < backup-YYYY-MM-DD.dump
```
Нөөцийг серверээс гадна (object storage) хуулж, сард нэг удаа сэргээх туршилт хийнэ.

### 1.6 Хяналт (monitoring)
- `GET /api/v1/health` — DB холболт шалгана (uptime monitor-т холбох).
- Лог production-д JSON (`docker compose logs api`) — log shipping-д бэлэн. 5xx алдаа бүр `requestId`-тай; клиентийн хариунд ч мөн `requestId` байдаг.
- `XPTransaction`, `AuditLog` хүснэгтүүд append-only (DB trigger) — засвар хийх оролдлого алдаа өгнө.

### 1.7 Аюулгүй байдлын тохиргоо (бэлэн)
- Container: non-root `node` хэрэглэгч, read-only файлын систем, `no-new-privileges`, Postgres port гадагш нээгдээгүй.
- API: helmet header (HSTS, nosniff, frame-options), CORS зөвхөн `CORS_ORIGINS`, Swagger production-д хаалттай, нэвтрэлт минутад 10 оролдлого (IP-ээр), JSON body 100KB хязгаар (413), stack trace клиент рүү гардаггүй.
- Нууц үг argon2id, access token 15 мин, refresh token rotation + дахин ашиглалт илэрвэл session хүчингүй.

## 2. Mobile (EAS)

### 2.1 Анхны тохиргоо (нэг удаа)
```bash
cd mobile
eas login
eas init                      # Expo project үүсгэж app.json-д projectId нэмнэ
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.familyhabit.example/api/v1 --visibility plaintext
eas env:create --environment preview    --name EXPO_PUBLIC_API_URL --value https://staging-api.familyhabit.example/api/v1 --visibility plaintext
```
`app.config.ts` нь `preview`/`production` build-д `EXPO_PUBLIC_API_URL` https биш бол build-ийг зогсооно.

### 2.2 Build
| Profile | Зорилго | Команд |
|---|---|---|
| development | Dev client (simulator), Rive зэрэг native модуль туршихад | `eas build -p ios --profile development` |
| preview | Дотоод тест (TestFlight-гүй ad-hoc / Android APK) | `eas build -p all --profile preview` |
| production | Store build, build дугаар автоматаар өснө | `eas build -p all --profile production` |

### 2.3 Store-д илгээх
```bash
eas submit -p ios --profile production       # App Store Connect (Apple developer account)
eas submit -p android --profile production   # Google Play (service account JSON)
```
Хувилбар нэмэхдээ `app.json`-ийн `expo.version`-ийг өсгөнө; build дугаарыг EAS удирдана (`appVersionSource: remote`).

## 3. Гаргахаас өмнөх шалгах хуудас
- [ ] CI ногоон (backend lint/typecheck/unit/e2e, image build, mobile typecheck/lint/test)
- [ ] `.env.production` бүх нууц утга шинэ, `CORS_ORIGINS` тодорхой, `SWAGGER_ENABLED=false`
- [ ] Нөөц cron ажиллаж, нэг удаа сэргээж туршсан
- [ ] `https://…/api/v1/health` → `{"status":"ok","database":"up"}`
- [ ] EAS `production` environment-д `EXPO_PUBLIC_API_URL` (https)
- [ ] Preview build дээр: бүртгэл → гэр бүл → дадал → офлайн тэмдэглэл → синк
- [ ] Privacy policy ба store-ын хүүхдийн өгөгдлийн мэдүүлэг (CHILD role байгаа тул) бэлэн
