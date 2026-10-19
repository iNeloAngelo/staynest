# Модуль users

## Зачем

Владелец таблицы `users`: создание пользователя, чтение профиля и обновление
разрешённых полей. Хэш пароля и служебные отметки наружу не отдаются.

## Публичный API

Модуль не регистрирует HTTP-маршруты. `auth` вызывает `usersService` и передаёт
исполнитель запроса (`db.kysely` или транзакцию):

- `findById(executor, id)` — строка пользователя для guard и профиля;
- `findAuthByEmail(executor, email)` — строка с `password_hash` только для входа;
- `create(executor, input)` — создать пользователя (email уже нормализован zod);
- `updateProfile(executor, id, input)` — имя, телефон, язык;
- `markEmailVerified(executor, id, at)`;
- `setPasswordHash(executor, id, hash)`;
- `toUserDto(row)` — публичный DTO (`emailVerified`, без хэша и `deleted_at`).

## Таблицы

`users`. Другие модули не пишут в неё напрямую (правило владения из
`docs/ARCHITECTURE.md`).

## События

Не публикует. `auth` публикует `user.registered` после создания пользователя.

## Как тестировать

Покрыто интеграционными тестами модуля `auth`:

```bash
pnpm --filter @staynest/api test
```
