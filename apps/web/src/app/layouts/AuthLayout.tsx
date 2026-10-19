import { Outlet } from 'react-router-dom';
import { LanguageToggle } from './LanguageToggle';
import { LogoLink } from './LogoLink';

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe">
        <div className="mx-auto flex h-16 max-w-page items-center justify-between px-4 lg:px-8">
          <LogoLink />
          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 pb-safe">
        <Outlet />
      </main>
    </div>
  );
}
