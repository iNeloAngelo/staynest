import type { Locale } from '@staynest/shared';

export type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function link(baseUrl: string, path: string, token: string): string {
  return `${baseUrl}${path}?token=${encodeURIComponent(token)}`;
}

function layout(title: string, bodyHtml: string, footer: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">
<h1 style="font-size:20px">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="color:#667085;font-size:13px">${escapeHtml(footer)}</p>
</body></html>`;
}

export function verificationEmail(locale: Locale, baseUrl: string, token: string): EmailContent {
  const url = link(baseUrl, '/verify-email', token);

  if (locale === 'en') {
    return {
      subject: 'Confirm your StayNest email',
      text: `Confirm your email within 24 hours: ${url}\nYou will be asked to set a password on that page.\n\nIf you did not sign up, ignore this email.`,
      html: layout(
        'Confirm your email',
        `<p><a href="${escapeHtml(url)}">Confirm email</a>. The link is valid for 24 hours; you will set a password on that page.</p>`,
        'If you did not sign up, ignore this email.',
      ),
    };
  }

  return {
    subject: 'Подтвердите email в StayNest',
    text: `Подтвердите email в течение 24 часов: ${url}\nНа странице нужно будет задать пароль.\n\nЕсли вы не регистрировались, просто проигнорируйте письмо.`,
    html: layout(
      'Подтвердите email',
      `<p><a href="${escapeHtml(url)}">Подтвердить email</a>. Ссылка действует 24 часа, на странице нужно задать пароль.</p>`,
      'Если вы не регистрировались, просто проигнорируйте письмо.',
    ),
  };
}

export function resetPasswordEmail(locale: Locale, baseUrl: string, token: string): EmailContent {
  const url = link(baseUrl, '/reset-password', token);

  if (locale === 'en') {
    return {
      subject: 'Reset your StayNest password',
      text: `Reset your password within 1 hour: ${url}\n\nIf you did not request it, ignore this email.`,
      html: layout(
        'Reset password',
        `<p><a href="${escapeHtml(url)}">Choose a new password</a>. The link is valid for 1 hour.</p>`,
        'If you did not request it, ignore this email.',
      ),
    };
  }

  return {
    subject: 'Сброс пароля в StayNest',
    text: `Сбросьте пароль в течение 1 часа: ${url}\n\nЕсли вы не запрашивали сброс, просто проигнорируйте письмо.`,
    html: layout(
      'Сброс пароля',
      `<p><a href="${escapeHtml(url)}">Задать новый пароль</a>. Ссылка действует 1 час.</p>`,
      'Если вы не запрашивали сброс, просто проигнорируйте письмо.',
    ),
  };
}

export function accountExistsEmail(locale: Locale, baseUrl: string): EmailContent {
  if (locale === 'en') {
    return {
      subject: 'Your StayNest account already exists',
      text: `Someone tried to register with this email. If it was you, sign in: ${baseUrl}/login\nIf you forgot your password, use "Forgot password" on the sign-in page.`,
      html: layout(
        'Account already exists',
        `<p>Someone tried to register with this email. If it was you, <a href="${escapeHtml(`${baseUrl}/login`)}">sign in</a>.</p>`,
        'If it was not you, no action is needed.',
      ),
    };
  }

  return {
    subject: 'Аккаунт StayNest уже существует',
    text: `Кто-то попытался зарегистрироваться с этим email. Если это были вы, войдите: ${baseUrl}/login\nЕсли забыли пароль, воспользуйтесь ссылкой "Забыли пароль" на странице входа.`,
    html: layout(
      'Аккаунт уже существует',
      `<p>Кто-то попытался зарегистрироваться с этим email. Если это были вы, <a href="${escapeHtml(`${baseUrl}/login`)}">войдите</a>.</p>`,
      'Если это были не вы, ничего делать не нужно.',
    ),
  };
}
