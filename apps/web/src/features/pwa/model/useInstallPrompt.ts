import { useCallback, useEffect, useState } from 'react';
import { canPromptInstall, promptInstall, subscribeInstallPrompt } from './install-prompt';
import { isIosDevice, isStandalone } from './install-eligibility';

export function useInstallPrompt() {
  const [available, setAvailable] = useState(canPromptInstall);
  const [ios] = useState(() => isIosDevice() && !isStandalone());

  useEffect(() => subscribeInstallPrompt(setAvailable), []);

  const install = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome !== 'unavailable') setAvailable(false);
    return outcome;
  }, []);

  return { available, ios, install };
}
