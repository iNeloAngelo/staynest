import type { UserDto } from '@staynest/shared';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authErrorKey, useLogout, useMe } from '../../features/auth';
import { ModeSwitchControl } from '../../features/mode-switch';
import { PushToggle, detachCurrentDevicePush } from '../../features/notifications';
import { PasswordCard, ProfileAvatar, ProfileForm, useUpdateProfile } from '../../features/profile';
import { useLocale } from '../../shared/i18n';
import { Badge, Button, Select, useToast } from '../../shared/ui';

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
      <dt className="text-small text-ink-muted">{label}</dt>
      <dd className="text-small font-medium break-all text-ink">{children}</dd>
    </div>
  );
}

function AccountCard({ user }: { user: UserDto }) {
  const { t } = useTranslation();

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <h2 className="border-b border-border px-4 py-3 font-serif text-h3 text-ink sm:px-6">
        {t('profile.accountTitle')}
      </h2>

      <dl className="divide-y divide-border">
        <InfoRow label={t('profile.email')}>{user.email}</InfoRow>
        <InfoRow label={t('profile.emailStatus')}>
          <Badge tone={user.emailVerified ? 'success' : 'warning'}>
            {t(user.emailVerified ? 'profile.verified' : 'profile.notVerified')}
          </Badge>
        </InfoRow>
      </dl>
    </section>
  );
}

function SettingsCard() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const { data: user } = useMe();
  const update = useUpdateProfile();
  const toast = useToast();

  async function onLanguage(value: string): Promise<void> {
    const next = value === 'en' ? 'en' : 'ru';
    setLocale(next);
    if (!user) return;

    try {
      await update.mutateAsync({ locale: next });
    } catch {
      toast.show({ title: t('profile.saveError'), tone: 'error' });
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
      <Select
        label={t('profile.language')}
        value={locale}
        onChange={(event) => void onLanguage(event.target.value)}
        options={[
          { value: 'ru', label: 'Русский' },
          { value: 'en', label: 'English' },
        ]}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-small font-medium text-ink">{t('profile.mode')}</span>
        <ModeSwitchControl fullWidth className="sm:w-fit" />
      </div>
    </section>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const logout = useLogout();
  const toast = useToast();
  const navigate = useNavigate();

  if (!user) return null;

  async function onLogout(): Promise<void> {
    try {
      await detachCurrentDevicePush();
      await logout.mutateAsync();
      toast.show({ title: t('toast.logoutSuccess'), tone: 'success' });
      navigate('/', { replace: true });
    } catch (error) {
      toast.show({ title: t(authErrorKey(error)), tone: 'error' });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-h1 text-ink">{t('profile.title')}</h1>
        <p className="mt-1 text-small text-ink-muted">{t('profile.subtitle')}</p>
      </header>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
        <ProfileAvatar user={user} />
      </section>

      <ProfileForm key={user.id} user={user} />
      <AccountCard user={user} />
      <SettingsCard />

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
        <PushToggle enabled userId={user.id} />
      </section>

      <PasswordCard />

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="font-serif text-h3 text-ink">{t('profile.logout')}</h2>
          <p className="mt-1 text-small text-ink-muted">{t('profile.logoutDescription')}</p>
        </div>

        <Button
          variant="danger"
          leftIcon={<LogOut className="size-5" aria-hidden="true" />}
          onClick={() => void onLogout()}
          loading={logout.isPending}
        >
          {logout.isPending ? t('profile.loggingOut') : t('profile.logout')}
        </Button>

        <p className="text-caption text-ink-muted">{t('profile.sessionHint')}</p>
      </section>
    </div>
  );
}
