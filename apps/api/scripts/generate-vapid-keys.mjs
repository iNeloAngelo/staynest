#!/usr/bin/env node
/**
 * Печатает пару VAPID-ключей для Web Push. Ключи попадают только в .env,
 * а публичный ключ отдаётся браузеру через GET /me/push/config.
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('Добавьте в .env (и в окружение сервера):');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:no-reply@staynest.local');
