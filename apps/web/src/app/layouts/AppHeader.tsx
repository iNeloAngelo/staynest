import { useMe } from '../../features/auth';
import { ModeSwitchControl } from '../../features/mode-switch';
import { Skeleton } from '../../shared/ui';
import { LanguageToggle } from './LanguageToggle';
import { LoginLink, ProfileLink } from './ProfileLink';
import { LogoLink } from './LogoLink';

export function AppHeader() {
  const { data: user, isPending } = useMe();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg pt-safe">
      <div className="mx-auto flex h-16 max-w-page items-center gap-3 px-4 lg:px-8">
        <LogoLink />

        <div className="hidden flex-1 justify-center lg:flex">
          <ModeSwitchControl />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <LanguageToggle />

          {isPending ? (
            <Skeleton className="size-11 rounded-full" />
          ) : user ? (
            <ProfileLink user={user} />
          ) : (
            <LoginLink />
          )}
        </div>
      </div>
    </header>
  );
}
