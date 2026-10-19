/**
 * Пользователи и токены аутентификации.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE users (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email             citext NOT NULL UNIQUE,
      password_hash     text,
      display_name      text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
      phone             text,
      avatar_key        text,
      locale            text NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru','en')),
      is_active         boolean NOT NULL DEFAULT true,
      email_verified_at timestamptz,
      created_at        timestamptz NOT NULL DEFAULT now(),
      updated_at        timestamptz NOT NULL DEFAULT now(),
      deleted_at        timestamptz
    );

    CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TABLE refresh_tokens (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  text NOT NULL UNIQUE,
      family_id   uuid NOT NULL,
      user_agent  text,
      ip          inet,
      expires_at  timestamptz NOT NULL,
      revoked_at  timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
    CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);

    CREATE TABLE auth_tokens (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind       text NOT NULL CHECK (kind IN ('verify_email', 'reset_password')),
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at    timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX auth_tokens_user_kind_idx ON auth_tokens (user_id, kind);
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS auth_tokens;
    DROP TABLE IF EXISTS refresh_tokens;
    DROP TABLE IF EXISTS users;
  `);
};
