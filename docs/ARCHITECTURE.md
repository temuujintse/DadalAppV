# Family Habit — Архитектур ба хөгжүүлэлтийн төлөвлөгөө

> Төлөв: **Phase 1–10 хэрэгжсэн (Foundation, Auth, Family, Habit engine, Gamification, Pet, Quest & Reward, Offline sync, UI polish, Testing & release).** Огноо: 2026-11-22.
> Эх сурвалж: `family_habit_spec.tex` (v1.2), master prompt, AI master prompt.

## 1. Эхлэлийн үнэлгээ

Workspace-д зөвхөн тодорхойлолтын баримт (`family_habit_spec.tex/.pdf`, backup) байсан: код, git repository, Firebase интеграц **байгаагүй**. Тиймээс architecture-ийг шинээр, spec-д нийцүүлэн босгосон. Firebase байхгүй тул authentication нь NestJS-ийн өөрийн JWT дээр (spec 15-р бүлгийн “Authentication provider” нээлттэй асуултыг ингэж хаасан).

## 2. Ерөнхий бүтэц

```
Dadal/
  docker-compose.yml        PostgreSQL 16 (host 5433) + family_habit_test DB
  backend/                  NestJS modular monolith
    prisma/                 schema.prisma, migrations/, seed.ts
    src/
      config/               env schema (Zod) — буруу тохиргоотой бол асахгүй
      database/             PrismaService (Prisma 7 + @prisma/adapter-pg)
      common/               errors, filter, envelope interceptor, validation, audit, utils
      auth/                 register/login/refresh/logout/me, global JwtAuthGuard
      users/                /users/me профайл
      families/             гэр бүл, гишүүд, эрх (family-policy.ts), FamilyAccessService
      invites/              урилгын код, нэгдэх
      habits/               дадал CRUD, оноолт, хуваарь, календарь, habit-policy.ts
      completions/          биелэлт (transaction + idempotency), undo, түүх
      streaks/              streak-calculator.ts (цэвэр логик) + StreaksService
      gamification/         XP ledger, level, achievements, leaderboard, read API
      pets/                 pet-rules.ts (care, happiness, cooldown), PetsService, accessories
      quests/               quest-period.ts (өдөр/долоо хоног), QuestsService (дахин тоолох engine, claim)
      rewards/              шагналын каталог, хүсэлт → зөвшөөрөл → олгох
      health/               /health
    test/                   e2e (supertest + бодит PostgreSQL)
  mobile/                   Expo SDK 58, Expo Router
    app/                    route-ууд: index (hub), (auth), (onboarding), (tabs), invite, profile
    src/components/ui/      design-system component-ууд
    src/features/*          auth, family, profile, gamification (api hooks, schemas, components)
    src/services/           API client (single-flight refresh), query client, SecureStore
    src/store/              Zustand session store
    src/theme/              өнгө, typography, spacing, motion tokens
```

Үлдсэн module-ууд (`pets`, `quests`, `rewards`, `notifications`, `sync`, `analytics`, `ai`) тухайн phase-дээ нэмэгдэнэ — хоосон placeholder module үүсгээгүй.

## 3. Гол шийдвэрүүд

| Сэдэв | Шийдвэр | Шалтгаан |
|---|---|---|
| Хувилбарууд | NestJS **11.2** (12 биш), Prisma **7.10**, Expo SDK **58** | NestJS 11 нь идэвхтэй patch авч байгаа, ecosystem (swagger/jwt/throttler) бүрэн нийцтэй. Prisma 8 нь `latest` tag-тай ч RC. Expo-гийн хувилбаруудыг `expo install`-ээр SDK-д нийцүүлсэн. |
| Response | `{ success, data, meta? }` / `{ success:false, error:{ code, message, details?, requestId } }` | Mobile нэг загвараар parse хийнэ; `code` тогтвортой, `message` монголоор. |
| Offline sync | Mobile: SQLite outbox (`operationId` UUID + `idempotencyKey`), серверийн хариуны кэш (хэрэглэгч тус бүр), NetInfo + `/health` probe (2→30с backoff), TanStack `onlineManager`. Backend: `POST /sync/push` үйлдэл бүрийг тусад нь (partial success), `SyncOperation`-д бүртгэж replay-д хадгалсан хариуг буцаана. Үр дүн: PROCESSED / CONFLICT / REJECTED (эцсийн) · FAILED (backoff 2с→5мин, 12 оролдлого). | Онлайн/офлайн хоёулаа нэг `CompletionsService`-ээр явдаг тул XP/streak/quest дүрэм ижил; ижил idempotencyKey тул хүрсэн хүсэлт давхар тоологдохгүй. XP зөвхөн сервер баталгаажуулсны дараа харагдана. Зөрчлийн тайлбар нь серверийн монгол мессеж. |
| Motion | Бүх Reanimated анимаци `ReduceMotion.System` дүрмээр; аппын доторх "Хөдөлгөөн багасгах" сонголт (Profile, төхөөрөмж дээр хадгална) `ReducedMotionConfig`-оор бүх анимацид (layout анимаци ч) үйлчилнэ. `useReduceMotion()` = систем ∨ апп. Дадал биелэхэд checkmark pop + 8 particle (зөвхөн төлөв өөрчлөгдөхөд, mount-д биш). | Spec 6.5: "Reduced Motion сонголттой байна". Нэг газраас удирдана. |
| Текстийн өнгө | Палитрын өнгө дүүргэлт/icon-д хэвээр; жижиг текстэд бараан хувилбар: `primaryText #C2410C`, `successText #15803D`, `errorText #B91C1C`, `purpleText #6D28D9` (WCAG AA ≥ 4.5:1, `a11y.test.ts` хамгаална). | #F97316 текст 2.7:1, #22C55E 2.3:1 байсан — уншихад хэцүү. |
| Loading | Жагсаалт ачаалахад skeleton (pulse, Reduce Motion-д статик); офлайн үед skeleton/spinner биш "Холбогдмогц ачаална" тайлбар; хэсгийн алдаа `InlineError`. | Spec 6.5/Phase 9. Офлайн үед query pause хийдэг тул төгсгөлгүй ачаалал гарахаас сэргийлнэ. |
| Production | Multi-stage Dockerfile (`runtime`: зөвхөн prod deps, Prisma CLI/Studio/TypeScript хасагдсан, non-root, healthcheck; `migrate`: migrate deploy + seed). `docker-compose.prod.yml`: API 127.0.0.1-д, read-only FS, Postgres гадагш хаалттай. Mobile: `eas.json` (development/preview/production), `app.config.ts` release build-д https API URL шаардана. | Нэг командаар гаргах, нууцгүй image, буруу API URL-тэй store build гаргахгүй. |
| Auth | Access JWT 15 мин (`sub`, `sid`) + opaque refresh `<sessionId>.<secret>` (SHA-256 hash), rotation бүрт солигдоно | Хуучин refresh token дахин ирвэл бүх session хүчингүй (theft detection). Guard хүсэлт бүрт session шалгадаг тул logout шууд хүчинтэй. |
| Нууц үг | Argon2id (m=19 MiB, t=2, p=1) | Spec + OWASP. Байхгүй имэйлд ч dummy hash шалгаж timing-ээр enumeration хийхээс сэргийлсэн. |
| Family isolation | `FamilyAccessService` нь familyId-г зөвхөн DB membership-ээс авна; өөр гэр бүлийн id → 404 | Client-ийн familyId/role-д итгэхгүй. |
| Нэг гэр бүл | `FamilyMember.userId UNIQUE` | Concurrent create/join → P2002 → 409 `ALREADY_IN_FAMILY` (e2e-ээр шалгасан). |
| Урилга | 10 тэмдэгт Crockford base32 код (50 bit), **HMAC-SHA256** (pepper) hash, хугацаа + maxUses + revoke + rate limit | Кодыг хүн бичиж болохуйц, DB алдагдсан ч offline brute-force боломжгүй. `usedCount`-ийг conditional update-ээр нэмдэг тул зэрэг join maxUses-ээс хэтрэхгүй. |
| Owner гарах | Бусад гишүүнтэй бол эхлээд эрх шилжүүлнэ; ганцаараа бол гэр бүл soft-delete | Түүх (completion, XP, audit) устахгүй. |
| XP ledger | `XPTransaction` append-only — UPDATE/DELETE-г **DB trigger** хориглоно; wallet owner/sign-ийг CHECK constraint шалгана | Залруулга зөвхөн REVERSAL мөрөөр. |
| Completion uniqueness | `completionKey` UNIQUE: `habit:user:date` эсвэл `habit:shared:date`; idempotencyKey нь `(completedById, key)`-ээр scope-логдсон | Prisma-д partial index байхгүй, drift үүсгэхгүйгээр DB түвшинд баталгаажна. |
| CHECK constraints | Habit type/mode хэлбэр, weekday, XP sign, invite role ≠ OWNER гэх мэт 19 constraint migration-д | Prisma migrate эдгээрийг introspect хийдэггүй тул дараагийн migration устгахгүй (drift шалгасан). |
| Streak | Spec v1.2: habit-ийн timezone дахь local date; зөвхөн хуваарьт өдөр шаардана; өнөөдөр дуусаагүй бол тасрахгүй. Биелэлт/undo бүрт **түүхээс бүрэн дахин тооцно** (давхар тоолох боломжгүй); уншихдаа "алдсан хуваарьт өдөр байна уу" шалгаж 0 болгоно. | Нэмэлт event/cron шаардлагагүй, undo-д ч зөв. |
| Completion | Нэг transaction: idempotency → эрх → өнөөдөр + хуваарь шалгах → insert (unique `completionKey`) → streak. Давхар хүсэлт: ижил key → анхны хариу (200, `replayed`), өөр key → 409 `ALREADY_COMPLETED` (SHARED үед хэн биелүүлснийг хэлнэ). | XP/quest-ийг Phase 5-д мөн энэ transaction-д нэмнэ. |
| Habit эрх | PERSONAL — зөвхөн үүсгэгч; FAMILY — гэр бүлийн бүх гишүүн харна, OWNER/PARENT удирдана, зөвхөн оноогдсон гишүүн биелүүлнэ (`habit-policy.ts`). Төрөл ба горим үүсгэсний дараа өөрчлөгдөхгүй. | Uniqueness-ийн утга өөрчлөгдөхөөс сэргийлнэ. |
| XP engine | `XpLedgerService` — XP-г бичдэг цорын ганц газар. Ledger мөр + aggregate нэг transaction-д; `idempotencyKey` (`completion:<id>:PERSONAL` г.м.) давхардвал `ON CONFLICT DO NOTHING`. Completion-ий transaction: completion → streak → personal XP → family XP → статистик → achievement. | Completion-гүй XP, давхар XP боломжгүй. |
| Level | Үргэлж lifetime XP-ээс тооцно (`level.ts`). Reward зарцуулалт (SPEND) lifetime-г буулгахгүй. | Level-ийг тусад нь хадгалахгүй тул зөрөхгүй. |
| Undo ба XP | REVERSAL мөр (ledger засагдахгүй). Тухайн биелэлтээр ахисан бол level буцна. Зарцуулсан XP-г буцаахгүй (409 `XP_ALREADY_SPENT`). Нээгдсэн achievement үлдэнэ. | Хэрэглэгч шийдээгүй тул ийм default; өөрчилж болно. |
| Family XP | PER_MEMBER: гишүүн бүрийн биелэлт тус бүр нэмнэ. SHARED: өдөрт нэг биелэлт тул нэг удаа. Personal XP зөвхөн биелүүлсэн гишүүнд. | Spec 3.2. |
| Leaderboard | Зөвхөн нэг гэр бүлийн дотор; 7 хоног (Даваагаас, гэр бүлийн timezone) / сар / бүх цаг; EARN+REVERSAL (зарцуулалт тооцохгүй). `Family.leaderboardEnabled` (OWNER/PARENT унтраана) — хүүхдэд дарамт болохоос сэргийлэх. | Spec 5.5. |
| Pet XP | PET wallet нь ижил ledger-ээр (`postPet`); completion transaction-д difficulty-ийн XP + аз жаргал +5; undo нь Pet XP-г REVERSAL-аар буцаана (аз жаргал, нээгдсэн чимэглэл үлдэнэ). | Давхар Pet XP боломжгүй. |
| Pet care | PET 5 / FEED 10 / PLAY 15 / BATH 10 XP (spec 5–15), төрөл бүр өөрийн cooldown (30 мин – 12 цаг). Pet мөрийг `SELECT … FOR UPDATE`-ээр түгжиж давхар товшилтоос хамгаална; idempotencyKey-тэй. | Зэрэг 2 хүсэлт → 1 амжилт (e2e). |
| Аз жаргал | Уншихдаа цагт 1.5 оноогоор аажим буурна, **25-аас доош хэзээ ч буурахгүй**; XP, level, чимэглэлийг хэзээ ч хасахгүй; "LONELY" үед "чамайг санасан" гэх зөөлөн текст (буруутгахгүй). | Spec 3.5 — шийтгэлгүй. |
| Чимэглэл | DEFAULT / Pet level / хэрэглэгчийн level / achievement-аар нээгдэнэ, нэг удаа нээгдвэл үүрд; slot бүрт нэг (`@@unique(petId, equippedSlot)`). | |
| Pet animation | **Rive-ийн оронд одоохондоо react-native-svg + Reanimated** (Expo Go-д ажиллана, Rive нь dev build шаардана). State machine (`pet-animation.ts`: IDLE, HAPPY, SAD, EATING, CARE, LEVEL_UP, SLEEPING, CELEBRATE, UNLOCK) нь renderer-ээс тусдаа — business код зөвхөн `emitPetEvent('HABIT_COMPLETED')` гэх мэт event илгээнэ. Reduced Motion үед хөдөлгөөнгүй, зөвхөн царай солигдоно. 21:00–07:00 унтана. | Rive asset бэлэн болоход зөвхөн renderer солино. |
| Quest engine | Явцыг үргэлж эх өгөгдлөөс **дахин тоолно** (биелэлт, арчилгаа, XP) — completion, undo, care-ийн transaction дотор болон уншихад. Undo хийвэл COMPLETED → IN_PROGRESS буцна; CLAIMED хэзээ ч буцахгүй. Өдөр/7 хоног (Даваа) нь хэрэглэгч эсвэл гэр бүлийн timezone-оор. | Явц хэзээ ч буруу үлдэхгүй. |
| Quest claim | Гараар "Шагнал авах" (compare-and-swap → зэрэг 2 claim-аас 1 нь). Хувийн quest → personal XP; гэр бүлийн quest → family XP + `questsCompleted++`, "Хамтын хүч" achievement бүх гишүүнд. | Spec: Daily 20, Family 50 XP. |
| Гэр бүлийн quest | "Гэр бүлээрээ 5 дадал" = одоогийн гишүүдийн **бүх** биелэлт (хувийн + гэр бүлийн). | Гэр бүлийн дадал цөөн үед ч хүрэх боломжтой. |
| Reward | OWNER/PARENT каталог удирдана. Хүсэлт гаргахад XP хасахгүй ч "зарцуулах боломжтой = balance − хүлээгдэж буй хүсэлтүүд" шалгана (давхар амлалтаас сэргийлнэ). **XP зөвхөн зөвшөөрөхөд нэг удаа** (`redemption:<id>:spend`); lifetime XP/level буурахгүй. Татгалзах/цуцлахад XP хөдлөхгүй. Өөрийн хүсэлтийг өөр эцэг эх шийднэ (ганц эцэг эх бол өөрөө). Шагнал устгах эсвэл гэр бүлээс гарахад хүлээгдэж буй хүсэлт цуцлагдана. | Spec 5.6. |
| Transaction доторх query | Нэг transaction = нэг холболт: манай код tx дотор `Promise.all` ашиглахгүй (дараалсан). Prisma 7-ийн query interpreter өөрөө nested include-ыг зэрэг ажиллуулж `pg` deprecation анхааруулга өгдөг — upstream асуудал, pg 8-д хоргүй; pg 9 руу шилжихээс өмнө Prisma-г шинэчилнэ. | |
| Mobile routing | `Stack.Protected` + үргэлж нээлттэй `app/index.tsx` redirect hub | Guard солигдох үед (login/logout/join) “Unmatched route” гарахаас сэргийлнэ (simulator дээр олдсон алдаа). |
| Token хадгалалт | Зөвхөн SecureStore (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) | SQLite/AsyncStorage-д plaintext token хадгалахгүй. |

## 4. Database (эхний migration `20261121065950_init`)

28 хүснэгт: User, UserProfile, AuthSession, Family, FamilyMember, FamilyInvite, Habit, HabitAssignment, HabitScheduleDay, HabitCompletion, HabitStreak, FamilyHabitStreak, UserGamification, FamilyGamification, XPTransaction, Achievement, UserAchievement, UserPet, PetCareAction, PetAccessory, UserPetAccessory, Quest, QuestProgress, Reward, RewardRedemption, Notification, SyncOperation, AuditLog.

- Spec-ийн жагсаалтаас гадна нэмсэн: **AuthSession** (refresh rotation/logout-д заавал хэрэгтэй).
- `UserGamification.lifetimeXP` (level тооцох, хэзээ ч буурахгүй) ба `balanceXP` (reward-д зарцуулах) тусдаа — spec 5.6.
- `Family.plan` + `memberLimit` (null = хязгааргүй) — subscription-д бэлэн.
- AuditLog FK-гүй — түүх нь холбогдох мөрөөсөө удаан амьдарна.
- Seed: 9 achievement, 7 pet accessory, 5 system quest (idempotent upsert).

## 5. API (хэрэгжсэн)

`/api/v1` — бүгд JWT шаардана (`@Public` биш бол), DTO validation (whitelist + forbidNonWhitelisted), Swagger баримттай.

| Method | Path | Тайлбар |
|---|---|---|
| POST | /auth/register, /auth/login, /auth/refresh | rate limit (RATE_LIMIT_AUTH/мин) |
| POST | /auth/logout | одоогийн session-ийг цуцлах |
| GET | /auth/me, /users/me · PATCH /users/me | профайл, onboarding |
| POST | /families | үүсгэх (OWNER) |
| GET/PATCH | /families/current | харах / засах (OWNER, PARENT) |
| GET | /families/current/members | гишүүд |
| PATCH | /families/current/members/:id | эрх солих (OWNER) |
| DELETE | /families/current/members/:id | хасах, эсвэл өөрийн id бол гарах |
| POST | /families/current/transfer-ownership | эзэмшигч солих (audit) |
| POST/GET | /families/current/invites · DELETE /families/current/invites/:id | урилга |
| POST | /families/join | кодоор нэгдэх (rate limit) |
| POST/GET | /habits (`?scope=all|personal|family|today&status=`) | үүсгэх / жагсаалт (өнөөдрийн төлөв, streak-тэй) |
| GET/PATCH/DELETE | /habits/:id | дэлгэрэнгүй (PER_MEMBER: өнөөдөр хэн хийсэн) / засах / soft delete |
| POST | /habits/:id/assignments | гишүүн оноолт солих (FAMILY) |
| GET | /habits/:id/calendar?month=YYYY-MM | сарын харагдац |
| POST/GET | /habits/:id/completions | биелүүлэх (idempotent) / түүх (pagination) |
| DELETE | /completions/:id | өнөөдрийн биелэлтийг буцаах |
| GET | /gamification/me · /gamification/family | level, XP, статистик / гэр бүлийн level, 7 хоногийн XP |
| GET | /gamification/me/transactions | XP ledger (pagination) |
| GET | /gamification/leaderboard?period=week\|month\|all | гэр бүлийн тэргүүлэгчид |
| GET | /gamification/achievements | achievement + явц |
| GET/PATCH | /pet/me | pet (анх хандахад үүснэ) / нэр, дүр (FOX, SNOW_FOX, NIGHT_FOX) |
| POST | /pet/me/care | PET/FEED/PLAY/BATH (cooldown, idempotent) |
| GET | /pet/me/accessories · POST /pet/me/accessories/:id/equip\|unequip | чимэглэл, нээгдэх нөхцөл, явц |
| GET | /pet/me/history | Pet XP түүх |
| GET | /quests · /quests/:id | идэвхтэй quest + одоогийн үеийн явц, `resetsAt` |
| POST | /quests/:id/claim | шагнал авах (үе бүрт нэг удаа) |
| GET/POST | /rewards · PATCH/DELETE /rewards/:id | каталог (OWNER/PARENT удирдана) |
| POST | /rewards/:id/redeem | хүсэлт (idempotent, XP хасахгүй) |
| GET | /redemptions?scope=mine\|family&status= | хүсэлтүүд |
| POST | /redemptions/:id/approve\|reject\|complete\|cancel | шийдвэр (XP зөвхөн approve-д) |
| POST | /sync/push | офлайн үйлдлүүд (1–100): HABIT_COMPLETION {habitId, localDate, idempotencyKey} · COMPLETION_UNDO {completionId} · PET_CARE {type, idempotencyKey}; үр дүн илгээсэн дарааллаар |
| GET | /sync/pull | reconcile snapshot: идэвхтэй дадлууд, XP, гэр бүл, гишүүд |
| GET | /sync/status | серверт синк хийгдсэн үйлдлийн тоо, сүүлийн 20, офлайн цонх |
| GET | /health | DB ping |

## 6. Тест (2026-11-22-ны байдлаар)

- Backend e2e: 103 ✓ (+ security 9: хуурамч/өөр issuer/`alg:none`/хугацаа дууссан JWT, logout-ын дараах token, security header, 100KB+ body → 413, буруу JSON → 400 (өмнө нь 500 байсан — засав), нууц талбар гарахгүй, injection текстийг өгөгдөл гэж хадгална)
- Гараар: нэвтрэлтийн rate limit 10 оролдлого → 429; production Docker stack (migrate + seed → healthy → бүртгэл/гэр бүл/дадал/XP), Swagger 404, JSON лог; slim image read-only FS дээр login.
- Ачаалал (локал Mac, 1 процесс, 20 зэрэг холболт, 12 дадалтай хэрэглэгч): `/habits?scope=today` 676 req/s p99 90ms · `/gamification/me` 897 · `/quests` 1895 · `/pet/me` 1231 · `/sync/pull` 374 req/s p99 144ms · алдаа 0.
- Dependency audit: backend prod 0 эмзэг байдал (`effect` → 3.22.5 override); mobile prod-д 3 moderate — Expo-гийн build хэрэгсэл (`@expo/fingerprint` → minimatch), аппын bundle-д ордоггүй.
- Mobile unit: 41 ✓ (+ a11y 8: текстийн өнгө ба tinted banner-ын contrast ≥ 4.5:1)
- iOS Simulator, Phase 9: Нүүр (биелсэн картууд mount-д "pop" хийхгүй) → биелүүлэх (checkmark + particle, toast, даалгаврын modal, "Дараа" бараан өнгө) → Дадал таб: segmented pill гулсах + haptic → Profile: "Хөдөлгөөн багасгах" асаах (бүх анимацид), дахин нээхэд хадгалагдсан → унтраах → Dynamic Type `accessibility-large`: Нүүрний текст ороож, тасрахгүй.
- Backend e2e: 94 ✓ (+ sync 11: офлайн completion XP/streak/quest, replay XP давхардахгүй, онлайн хүсэлттэй ижил idempotencyKey, 3 хоногийн backfill + streak, цонхноос гадуур/ирээдүй REJECTED (хэсэгчилсэн амжилт), SHARED зөрчил тайлбартай, офлайн undo + payload validation, pet care cooldown CONFLICT, хэрэглэгч тусгаарлалт, envelope validation, pull/status)
- Mobile unit: 33 ✓ (+ offline 8: backoff, огноо/гараг, үр дүн ангилах, XP нийлбэр, queue overlay, өдөр шилжих, JWT sub)
- iOS Simulator, Phase 8: backend зогсоох → "Офлайн горим" banner, кэшээс бүх хуудас → дадал тэмдэглэх ("Синк хүлээж байна", XP өөрчлөгдөхгүй) → дараалалд байгааг цуцлах → pet "Тоглох" → апп бүрэн хааж дахин нээх (кэш + 2 үйлдэл хадгалагдсан) → backend асаах → автоматаар синк (DB: PERSONAL +30, PET +30, PET +15 нэг удаа, source OFFLINE_SYNC) → "3-р түвшин" level-up → SHARED дадал: Бат онлайн, Сараа офлайн → CONFLICT, "Бат өнөөдөр гэр бүлийн өмнөөс аль хэдийн биелүүлсэн байна" → кэшгүй хуудас офлайн тайлбартай, холбогдмогц ачаална.
- Backend unit: 52 ✓ (+ quest period: өдөр/7 хоног, timezone, claimed төлөв)
- Backend e2e: 83 ✓ (+ quests 8: явц, undo-оор буцах, зэрэг claim, care quest, гэр бүлийн quest + family XP + бүх гишүүнд achievement, тусгаарлалт; rewards 8: каталогийн эрх, хүсэлт XP хасахгүй, давхар амлалт, зөвшөөрөх нэг удаа (зэрэг), level буурахгүй, зарцуулсан XP undo хориг, татгалзах/цуцлах, өөрийн хүсэлт, устгах/гарахад цуцлах)
- Backend unit (Phase 6 хүртэл): 48 ✓ (+ pet rules: care XP 5–15, аз жаргалын бууралт ба доод хязгаар, cooldown)
- Backend e2e: 67 ✓ (+ pet 11: анх үүсэх, нэр/дүр, care XP + cooldown + replay, зэрэг care, түүх, completion → Pet XP + undo, level-ээр нээгдэх, slot солих, түгжээтэй чимэглэл, тусгаарлалт)
- Backend e2e (Phase 5 хүртэл): 56 ✓ (+ gamification 10: XP + achievement нэг transaction-д, replay XP давхардахгүй, undo REVERSAL, зарцуулсан XP, level-up босго, PER_MEMBER/SHARED family XP, leaderboard тусгаарлалт, leaderboard унтраах)
- Backend e2e (Phase 4 хүртэл): 46 ✓ — бодит PostgreSQL дээр: auth/family (29) + habits/completions (17): idempotent replay, ALREADY_COMPLETED, зэрэг completion, өнөөдрөөс бусад огноо, хуваарьт бус өдөр, undo, түүхээс streak сэргээх, PER_MEMBER/SHARED, оноогдоогүй гишүүн, архив/устгах, isolation.
- Mobile unit: 25 ✓ (+ quest celebration)
- Mobile unit (Phase 6 хүртэл): 24 ✓ (+ pet state machine, priority, sleep time, expressions, зөөлөн текст)
- Mobile unit (Phase 5 хүртэл): 18 ✓ (+ celebration queue)
- Mobile unit (Phase 4 хүртэл): 16 ✓ (schemas, level math, огноо, хуваарийн тайлбар, permission mirror, error mapping)
- iOS Simulator, Phase 7: 5 tab (Нүүр, Дадал, Даалгавар, Гэр бүл, Шагнал) → Даалгавар: өмнөх биелэлтээс тоологдсон явц → "Шагнал авах" (+20 XP, ногоон ✓) → Шагнал: "Кино сонгох эрх" санаа товчоор үүсгэх → "Авах" (зарцуулах 185 → 85, XP хасагдаагүй) → Зөвшөөрөх (DB: SPEND −100, lifetime 185, level 2 хэвээр) → "Олгосон" (REDEEMED).
- iOS Simulator, Phase 6: Нүүрэнд амьд үнэг (амьсгалах, сүүл, нүд ирмэх) → дадал биелүүлэх → "+30 XP · Pet +30" → Pet дэлгэц → Хооллох (идэх animation, 🍎, +10 Pet XP, аз жаргал 100%, "4 цаг" cooldown) → Тоглох → "Бамбаа 2-р түвшинд хүрлээ" → "Баярын малгай" нээгдэх → ороолт + малгай өмсгөх → нэр ба дүр (3 өнгө) → түүх.
- iOS Simulator, Phase 5: биелүүлэх → "+30 XP" toast → "2-р түвшин" level-up → "Анхны алхам", "Дадал бүтээгч" achievement дэлгэцүүд → Нүүрний XP тоолуур (105 XP) → Миний ахиц (статистик, achievement явц, XP түүх) → Гэр бүлийн тэргүүлэгчид → тохиргооноос нуух.
- iOS Simulator (Expo Go 58), Phase 4: дадал үүсгэх (FAMILY/SHARED, хамааралтай талбарууд) → Home "Өнөөдрийн дадлууд" → биелүүлэх (✓ + streak 1 + 1/1) → Habits tab (кирилл гарчиг, амралтын өдөр 🌙) → дэлгэрэнгүй + календарь → undo → дахин биелүүлэх → засах.
- iOS Simulator (Expo Go 58) дээр гараар: login (буруу/зөв нууц үг) → onboarding → гэр бүл үүсгэх → урилгын код → өөр хэрэглэгч кодоор нэгдэх → гишүүний эрх солих → owner гарах хамгаалалт → профайл засах → logout.

## 7. Шийдэгдээгүй / баталгаажуулах асуултууд

1. ~~Streak дүрэм~~ — **ШИЙДСЭН (2026-11-21, хэрэглэгч):** spec v1.2 — habit-ийн timezone дахь local calendar date дээр, зөвхөн schedule-д орсон өдрүүд тооцогдоно; schedule-д ороогүй өдөр streak тасалдуулахгүй; өнөөдөр дуусаагүй байхад streak тасрахгүй.
2. Offline completion-ийн цонх — **default-аар хэрэгжсэн (баталгаажуулаагүй):** өнгөрсөн 3 хоног (`OFFLINE_SYNC_WINDOW_DAYS`, 0–14), ирээдүй хориотой. Онлайн completion зөвхөн "өнөөдөр". Синкийн дараа зөвхөн хувийн level-up модал гарна (pet/гэр бүлийн level-up синкээр гарахгүй).
3. Undo-гийн XP дүрэм (хэрэглэгч баталгаажуулаагүй, default-аар хэрэгжсэн): REVERSAL хийнэ, level тухайн биелэлтээр ахисан бол буцна, achievement үлдэнэ, зарцуулсан XP-г буцаахгүй.
8. Phase 5-аас өмнө бүртгэсэн биелэлтүүдэд XP олгогдоогүй (dev өгөгдөл). Шаардлагатай бол нэг удаагийн backfill script бичнэ.
10. **Rive**: Expo Go-д Rive байхгүй тул pet-ийг код-д суурилсан SVG + Reanimated-аар хийсэн. Rive руу шилжихэд: (a) designer-аас `.riv` (state machine-д ижил 9 state input), (b) `rive-react-native` + dev build (`npx expo run:ios`). `AnimatedPet`-ийн интерфейс (`species`, `state`, `accessories`) өөрчлөгдөхгүй.
11. Simulator-ийн pet level-up шалгалтад dev DB-д нэг `ADMIN_ADJUSTMENT` (+55 Pet XP) ledger мөр нэмсэн — "Залруулга" гэж түүхэнд харагдана (зөвхөн dev өгөгдөл).
9. Hot reload: watchman `~/Desktop` хавтсанд "Recrawl" алдаа өгч, Metro файлын өөрчлөлт илрүүлэхгүй байсан. Төслийг Desktop-оос гадна зөөх эсвэл watchman-д Full Disk Access өгөх хэрэгтэй.
6. Хуваарь өөрчлөгдөхөд streak-ийг шинэ хуваариар (түүхэнд ч) тооцож байна — энгийн, гэхдээ "өнгөрсөн өдрүүдэд хуучин хуваарь" шаардлагатай бол `HabitScheduleDay`-д хүчинтэй хугацаа нэмнэ.
7. Хүүхэд (CHILD) хувийн дадал үүсгэж чадна (spec-д тодорхой хориг байхгүй). Хязгаарлах бол нэг мөр policy өөрчлөлт.
4. Pet animation state-ийн нэрс: үндсэн prompt (IDLE, HAPPY, SAD, EATING, CARE, LEVEL_UP, SLEEPING, CELEBRATE, UNLOCK) ба AI prompt (IDLE, HAPPY, EXCITED, CARING, SLEEPING, CELEBRATE, LEVEL_UP) зөрүүтэй → нэг `PetAnimationState` superset enum болгох санал.
5. AI module-ийн зам: AI prompt `src/modules/ai/` гэсэн ч бусад module `src/<module>/` бүтэцтэй → тууштай байлгахын тулд `src/ai/` болгох санал.

12. ~~Primary товчны contrast~~ — **ШИЙДСЭН (2026-11-22, хэрэглэгч):** товчны дэвсгэр #F97316 хэвээр (цагаан текст 2.8:1). Жижиг текстэд `primaryText #C2410C` ашиглана.
13. Expo Go-гийн tools товч (⚙) баруун дээд буланд UI-г давхарлана — зөвхөн dev, production build-д байхгүй.

## 8. Roadmap (одоогийн кодод тохируулсан)

| Phase | Агуулга | Төлөв |
|---|---|---|
| 1 Foundation | Docker, NestJS, Prisma, migration, seed, Swagger, validation, error envelope, rate limit, logging, Expo app, design system | ✅ |
| 2 Authentication | register/login/refresh/logout/me, SecureStore, session guard | ✅ |
| 3 Family | create/join/invite/roles/transfer/leave, isolation | ✅ |
| 4 Habit engine | habits CRUD, PER_MEMBER/SHARED, schedule, assignments, completion (transaction + idempotency), streak, calendar, **Habits tab**, Home-ийн өнөөдрийн дадлууд | ✅ (reminder → Notifications phase) |
| 5 Gamification | XP ledger (completion transaction-д), level, undo → REVERSAL, achievements, leaderboard (+ нуух тохиргоо), XP toast / level-up / achievement дэлгэц, Миний ахиц | ✅ |
| 6 Pet | pet profile, Pet XP (completion transaction-д), care (cooldown), happiness, accessories (нээгдэх + өмсгөх), animated pet (SVG + Reanimated state machine), Pet дэлгэц, Нүүрний pet | ✅ (Rive asset → dev build) |
| 7 Quest & reward | quest progress (completion/care/undo transaction-д), claim, rewards, redemption approval (XP SPEND), **Quests/Rewards tabs**, Нүүрний өдрийн даалгавар | ✅ (гэр бүлийн өөрийн quest үүсгэх → дараа) |
| 8 Offline | expo-sqlite cache + outbox, sync engine (backoff, partial success, conflict тайлбар, reconcile), офлайн banner/toast, Profile-ийн синк карт, `/sync/push|pull|status` | ✅ |
| 9 UI polish | completion particles, skeleton loading, inline error, segmented/tab/care/claim micro-interaction + haptic, аппын Reduce Motion сонголт, header role, текстийн contrast, 44pt хүрэх талбай | ✅ |
| 10 Release | security e2e + audit, ачааллын хэмжилт, production Docker stack, CI workflow, EAS тохиргоо, deployment runbook (нөөц, хяналт, rollback) | ✅ (бодит сервер/EAS build-ийг хэрэглэгч ажиллуулна) |
| AI 1–6 | AI foundation → Coach → Planner → Pet Companion → Analytics → Security | Phase 4–6-гийн дараа |

## 9. AI интеграцийн бэлтгэл судалгаа (AI master prompt, 18-р хэсэг)

**Одоогийн байдал:** NestJS modular monolith, Prisma 7, өөрийн JWT auth, Firebase байхгүй. User/Family/FamilyMember/UserPet model бэлэн; Habit, HabitCompletion, XPTransaction schema-д бий (service нь Phase 4–5).

**AI-д шаардлагатай урьдчилсан нөхцөл:** Coach нь habit үүсгэх service (Phase 4), Analytics нь completion/streak өгөгдөл (Phase 4–5), Pet Companion нь pet module (Phase 6)-оос хамаарна. Иймээс AI Phase 1 (foundation)-ийг Phase 4-тэй зэрэг эхлүүлж болох ч Coach/Analytics/Pet нь тэдгээрийн дараа.

**Санал болгох шинэ model (дараагийн migration):**

| Model | Гол талбар / relation |
|---|---|
| AIUserPreference | userId (PK, → User cascade), goals, availableMinutesPerDay, preferredDifficulty, aiEnabled |
| AIConversation | id, userId (→ User cascade), feature, title, lastMessageAt, deletedAt; index (userId, lastMessageAt) |
| AIMessage | conversationId (→ cascade), role (USER/ASSISTANT), content, structured JSONB, createdAt |
| AIRecommendation | userId, status (PENDING/ACCEPTED/REJECTED/EXPIRED), payload JSONB, requestHash UNIQUE(userId, requestHash) — давхардлаас хамгаална, createdHabitId (→ Habit, SetNull) |
| AIRecommendationFeedback | recommendationId UNIQUE, reason, createdAt |
| AIPlan | userId, planDate, status (DRAFT/ACTIVE/COMPLETED/CANCELLED), payload JSONB, UNIQUE(userId, planDate, status=ACTIVE) логикийг service-д |
| AIPlanItem | planId (→ cascade), habitId (→ Habit), startTime, durationMinutes, order |
| AIInsight | userId, periodType (WEEKLY/MONTHLY), periodKey, metrics JSONB (backend тооцоолсон), insight JSONB; UNIQUE(userId, periodType, periodKey) — дахин үүсгэхгүй |
| AIPetInteraction | userId, petId (→ UserPet), event, message, emotion, animation, source (TEMPLATE/AI) |
| AIUsageLog | userId, provider, model, feature, input/output/totalTokens, estimatedCost, latencyMs, status, requestId — prompt/PII хадгалахгүй |

**Хамгаалалт:** OPENAI_API_KEY зөвхөн backend env-д; AI нь XP/streak/completion/role-ийг хэзээ ч шууд өөрчлөхгүй — санал → хэрэглэгч Accept → одоо байгаа business service. Per-user өдрийн quota (`AI_DAILY_USER_LIMIT`) + throttler. Хүүхдийн мэдээллийг хамгийн бага (displayName ч дамжуулахгүй байж болно).
