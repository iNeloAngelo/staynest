export const DEMO_PASSWORD = 'StayNest-Demo-2026';
export const HOST_EMAIL = 'host@staynest.demo';
export const GUEST_EMAIL = 'guest@staynest.demo';
export const HOST_ID = '00000000-0000-4000-8000-000000000001';
export const GUEST_ID = '00000000-0000-4000-8000-000000000002';

export const demoUsers = [
  {
    id: HOST_ID,
    email: HOST_EMAIL,
    displayName: 'Мария Соколова',
    phone: '+7 999 123-45-67',
    locale: 'ru',
  },
  {
    id: GUEST_ID,
    email: GUEST_EMAIL,
    displayName: 'Алексей Морозов',
    phone: '+7 916 555-12-34',
    locale: 'ru',
  },
];

/** Фото лежат в scripts/demo-photos, лицензия CC0 (см. docs/credits.md). */
export const demoListings = [
  {
    title: 'Сказка у озера',
    type: 'house',
    city: 'Суздаль',
    region: 'Владимирская область',
    lat: 56.419,
    lng: 40.449,
    address: 'ул. Лесная, 12',
    guests: 6,
    bedrooms: 3,
    beds: 4,
    bathrooms: 2,
    area: 120,
    base: 12_500,
    weekend: 14_500,
    cleaning: 3_500,
    minNights: 2,
    maxNights: 21,
    rules: 'Можно с детьми. Тихий час после 22:00. Курить в доме нельзя.',
    amenities: ['wifi', 'fireplace', 'lake_view', 'bbq', 'kitchen', 'parking', 'kids_friendly'],
    photos: ['house-lake', 'living-room-warm', 'bedroom-white', 'kitchen-bright'],
    description:
      'Тёплый дом в сосновом бору в десяти минутах от Суздаля. Панорамные окна выходят на озеро, а вечером можно растопить камин и слушать, как шумит лес. Внутри три спальни, большая кухня и терраса с креслами. Идеально для семьи или двух пар.',
  },
  {
    title: 'Дом с камином в сосновом бору',
    type: 'cabin',
    city: 'Суздаль',
    region: 'Владимирская область',
    lat: 56.431,
    lng: 40.421,
    address: 'Сосновый проезд, 4',
    guests: 4,
    bedrooms: 2,
    beds: 3,
    bathrooms: 1,
    area: 78,
    base: 9_800,
    weekend: 11_500,
    cleaning: 2_500,
    minNights: 2,
    maxNights: 14,
    rules: 'Можно с питомцами по согласованию. Мангал только на площадке.',
    amenities: ['wifi', 'fireplace', 'pets_allowed', 'sauna', 'kitchen', 'parking', 'bbq'],
    photos: ['cabin-log', 'living-room-fireplace', 'bedroom-wood', 'kitchen-white'],
    description:
      'Настоящий бревенчатый дом с дровяной печью и маленькой сауной. Здесь пахнет деревом и хвоей, а у окна стоит кресло, из которого удобно смотреть на закат. До центра Суздаля пятнадцать минут на машине, до лесной тропы — две минуты пешком.',
  },
  {
    title: 'Сосновый берег',
    type: 'house',
    city: 'Плёс',
    region: 'Ивановская область',
    lat: 57.462,
    lng: 41.514,
    address: 'Набережная, 27',
    guests: 8,
    bedrooms: 4,
    beds: 5,
    bathrooms: 2,
    area: 165,
    base: 16_000,
    weekend: 18_500,
    cleaning: 4_500,
    minNights: 3,
    maxNights: 30,
    rules: 'Субаренда запрещена. Шумные вечеринки не проводим.',
    amenities: ['wifi', 'lake_view', 'sauna', 'kitchen', 'washer', 'tv', 'parking', 'bbq'],
    photos: ['house-river', 'living-room-neutral', 'bedroom-grey'],
    description:
      'Просторный дом на берегу Волги с видом на Плёс и колокольню. Большая гостиная, четыре спальни и терраса с подогревом — гостям хватает места и в дождливый день. Утром видно туман над водой, вечером — огни на противоположном берегу.',
  },
  {
    title: 'Тихий плёс',
    type: 'cottage',
    city: 'Плёс',
    region: 'Ивановская область',
    lat: 57.469,
    lng: 41.523,
    address: 'ул. Заречная, 9',
    guests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    area: 64,
    base: 8_200,
    weekend: 9_600,
    cleaning: 2_000,
    minNights: 2,
    maxNights: 12,
    rules: 'Тихий посёлок: после 22:00 просим не шуметь.',
    amenities: ['wifi', 'kitchen', 'lake_view', 'parking', 'pets_allowed'],
    photos: ['house-red-lake', 'living-room-bright', 'bedroom-cozy'],
    description:
      'Небольшой дом в двух шагах от воды. Внутри светло и просто: две спальни, кухня-гостиная и окно, из которого видно лодки. Летом можно завтракать на маленькой террасе, зимой — гулять по набережной и возвращаться греться.',
  },
  {
    title: 'Дом у реки',
    type: 'house',
    city: 'Кострома',
    region: 'Костромская область',
    lat: 57.755,
    lng: 40.928,
    address: 'ул. Волжская, 18',
    guests: 6,
    bedrooms: 3,
    beds: 4,
    bathrooms: 2,
    area: 132,
    base: 11_000,
    weekend: 13_000,
    cleaning: 3_000,
    minNights: 2,
    maxNights: 20,
    rules: 'Дом в жилом переулке. Парковка во дворе, не на улице.',
    amenities: ['wifi', 'fireplace', 'kitchen', 'washer', 'ac', 'tv', 'parking'],
    photos: ['cabin-a-frame', 'living-room-brick', 'bedroom-white', 'kitchen-bright'],
    description:
      'Дом-шалаш с панорамным остеклением и видом на Кострому через реку. Внутри тёплый минимализм: кирпичная стена, камин и большой стол для ужинов. Удобно зимой: после прогулки возвращаетесь в тепло и готовите глинтвейн.',
  },
  {
    title: 'Лесной причал',
    type: 'cabin',
    city: 'Кострома',
    region: 'Костромская область',
    lat: 57.781,
    lng: 40.892,
    address: 'Боровское шоссе, 3',
    guests: 5,
    bedrooms: 2,
    beds: 3,
    bathrooms: 1,
    area: 86,
    base: 8_900,
    weekend: 10_400,
    cleaning: 2_500,
    minNights: 2,
    maxNights: 14,
    rules: 'Можно с собакой до 20 кг. Кошка — по согласованию.',
    amenities: ['wifi', 'sauna', 'fireplace', 'kitchen', 'parking', 'pets_allowed', 'bbq'],
    photos: ['house-coast', 'living-room-warm', 'bedroom-wood', 'kitchen-white'],
    description:
      'Домик на краю леса с собственной сауной и маленьким причалом. Интерьер собран из дерева и льна, есть всё для долгих завтраков. Днём — лыжи или лесные тропы, вечером — сауна и звёзды над крышей.',
  },
  {
    title: 'Дача на холме',
    type: 'cottage',
    city: 'Тверь',
    region: 'Тверская область',
    lat: 56.858,
    lng: 35.911,
    address: 'ул. Верхняя, 21',
    guests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    area: 72,
    base: 7_600,
    weekend: 8_900,
    cleaning: 2_000,
    minNights: 1,
    maxNights: 10,
    rules: 'Садовый участок общий с хозяевами соседнего дома.',
    amenities: ['wifi', 'kitchen', 'parking', 'tv', 'kids_friendly'],
    photos: ['house-hills', 'living-room-neutral', 'bedroom-grey'],
    description:
      'Светлая дача на холме с видом на Тверцу. Здесь нет телевизора в спальнях, зато есть гамак, большой сад и место для костра. Хороший вариант на выходные, когда хочется читать, гулять и никуда не спешить.',
  },
  {
    title: 'Амбар с панорамой',
    type: 'villa',
    city: 'Тверь',
    region: 'Тверская область',
    lat: 56.842,
    lng: 35.879,
    address: 'деревня Старое, 7',
    guests: 8,
    bedrooms: 4,
    beds: 6,
    bathrooms: 3,
    area: 210,
    base: 18_000,
    weekend: 21_000,
    cleaning: 5_000,
    minNights: 3,
    maxNights: 30,
    rules: 'Мероприятия и фотосессии — только по отдельному согласованию.',
    amenities: ['wifi', 'fireplace', 'sauna', 'kitchen', 'washer', 'ac', 'tv', 'parking', 'bbq'],
    photos: ['valley', 'living-room-fireplace', 'bedroom-cozy'],
    description:
      'Бывший амбар, превращённый в дом для больших компаний. Огромная гостиная с камином, четыре спальни и стеклянная стена с видом на долину. Утром солнце само будит, а вечером здесь особенно хорошо собираться за длинным столом.',
  },
  {
    title: 'Сруб у Волги',
    type: 'cabin',
    city: 'Плёс',
    region: 'Ивановская область',
    lat: 57.451,
    lng: 41.531,
    address: 'ул. Нижняя, 5',
    guests: 4,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    area: 54,
    base: 7_200,
    weekend: 8_500,
    cleaning: 2_000,
    minNights: 2,
    maxNights: 10,
    rules: 'Дом рассчитан на 4 гостей, гости на диване не размещаются.',
    amenities: ['wifi', 'lake_view', 'kitchen', 'parking', 'fireplace'],
    photos: ['forest', 'living-room-brick', 'bedroom-white'],
    description:
      'Маленький сруб для двоих или семьи с ребёнком. Внутри одна спальня, кухня-гостиная и печь. Из окна видно Волгу, до пляжа — пять минут пешком. Просто, тепло и без лишнего.',
  },
  {
    title: 'Дом с террасой',
    type: 'house',
    city: 'Суздаль',
    region: 'Владимирская область',
    lat: 56.408,
    lng: 40.462,
    address: 'ул. Луговая, 33',
    guests: 6,
    bedrooms: 3,
    beds: 3,
    bathrooms: 2,
    area: 118,
    base: 13_400,
    weekend: 15_200,
    cleaning: 3_000,
    minNights: 2,
    maxNights: 21,
    rules: 'На террасе можно курить, в доме нельзя.',
    amenities: ['wifi', 'fireplace', 'bbq', 'kitchen', 'washer', 'parking', 'kids_friendly'],
    photos: ['house-lake', 'terrace', 'bedroom-grey', 'kitchen-bright'],
    description:
      'Дом с большой деревянной террасой, выходящей в яблоневый сад. Внутри три спальни и уютная гостиная с камином. Летом терраса становится главной комнатой: здесь завтракают, читают и ужинают до позднего вечера.',
  },
  {
    title: 'Усадьба на опушке',
    type: 'villa',
    city: 'Кострома',
    region: 'Костромская область',
    lat: 57.802,
    lng: 40.871,
    address: 'Ипатьевская слобода, 14',
    guests: 10,
    bedrooms: 5,
    beds: 7,
    bathrooms: 3,
    area: 240,
    base: 22_000,
    weekend: 25_000,
    cleaning: 6_000,
    minNights: 3,
    maxNights: 30,
    rules: 'С животными можно. Для мероприятий нужен отдельный договор.',
    amenities: [
      'wifi',
      'sauna',
      'fireplace',
      'kitchen',
      'washer',
      'ac',
      'tv',
      'parking',
      'bbq',
      'pets_allowed',
    ],
    photos: ['mountain-lake', 'living-room-warm', 'bedroom-white', 'kitchen-white'],
    description:
      'Большая усадьба на опушке леса: пять спален, сауна, каминная и просторная кухня. Подойдёт для семейного праздника или встречи друзей. Вокруг — лес, а до Костромы можно доехать за двадцать минут.',
  },
  {
    title: 'Дом у леса',
    type: 'house',
    city: 'Тверь',
    region: 'Тверская область',
    lat: 56.871,
    lng: 35.948,
    address: 'Лесной тупик, 2',
    guests: 5,
    bedrooms: 2,
    beds: 3,
    bathrooms: 1,
    area: 90,
    base: 9_200,
    weekend: 10_800,
    cleaning: 2_500,
    minNights: 2,
    maxNights: 14,
    rules: 'Костёр только в специальной чаше. Убирайте за собой.',
    amenities: ['wifi', 'fireplace', 'sauna', 'kitchen', 'parking', 'bbq', 'kids_friendly'],
    photos: ['lake-dusk', 'living-room-bright', 'bedroom-wood'],
    description:
      'Дом стоит на границе леса, поэтому из окон видно только сосны. Внутри две спальни, печь и маленькая сауна. Отличное место, чтобы выключить телефон: до ближайшего магазина десять минут на машине.',
  },
  {
    title: 'Речная дача',
    type: 'cottage',
    city: 'Плёс',
    region: 'Ивановская область',
    lat: 57.474,
    lng: 41.509,
    address: 'ул. Речная, 11',
    guests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    area: 68,
    base: 8_800,
    weekend: 10_100,
    cleaning: 2_200,
    minNights: 2,
    maxNights: 12,
    rules: 'После 23:00 музыка только в наушниках.',
    amenities: ['wifi', 'kitchen', 'lake_view', 'parking', 'washer'],
    photos: ['house-river', 'armchair', 'bedroom-cozy', 'kitchen-bright'],
    description:
      'Компактная дача с террасой и видом на реку. Две спальни, кухня-гостиная и кресло у окна, в котором особенно хорошо читать дождливым утром. До центра Плёса — пятнадцать минут пешком вдоль воды.',
  },
  {
    title: 'Красный дом на берегу',
    type: 'house',
    city: 'Суздаль',
    region: 'Владимирская область',
    lat: 56.425,
    lng: 40.437,
    address: 'ул. Береговая, 6',
    guests: 7,
    bedrooms: 3,
    beds: 4,
    bathrooms: 2,
    area: 140,
    base: 14_600,
    weekend: 17_000,
    cleaning: 3_800,
    minNights: 2,
    maxNights: 21,
    rules: 'Дом не сдаётся под вечеринки и фотосессии.',
    amenities: [
      'wifi',
      'fireplace',
      'lake_view',
      'bbq',
      'kitchen',
      'washer',
      'parking',
      'kids_friendly',
    ],
    photos: ['house-red-lake', 'living-room-neutral', 'bedroom-grey', 'kitchen-white'],
    description:
      'Заметный красный дом прямо у воды. Внутри три спальни, большая гостиная и кухня, где удобно готовить на всю компанию. Из окон видно лодки и противоположный берег, а до исторического центра — десять минут на велосипеде.',
  },
];

function dateFromOffset(offset) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function nightsBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function quoteFor(listing, from, to, guests) {
  const nightly = [];
  const totals = new Map();

  for (let offset = 0; offset < nightsBetween(from, to); offset += 1) {
    const date = new Date(`${from}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    const iso = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    const weekend = (weekday === 5 || weekday === 6) && listing.weekend;
    const priceMinor = (weekend ? listing.weekend : listing.base) * 100;
    const source = weekend ? 'weekend' : 'base';
    nightly.push({ date: iso, priceMinor, source, ruleId: null });

    const key = `${source}:${priceMinor}`;
    const group = totals.get(key) ?? {
      priceMinor,
      nights: 0,
      source,
      ruleId: null,
      ruleName: null,
    };
    group.nights += 1;
    totals.set(key, group);
  }

  const nightlyTotalMinor = nightly.reduce((sum, night) => sum + night.priceMinor, 0);
  const cleaningFeeMinor = listing.cleaning * 100;
  const totalMinor = nightlyTotalMinor + cleaningFeeMinor;

  return {
    checkIn: from,
    checkOut: to,
    nights: nightly.length,
    guests,
    currency: 'RUB',
    minNightsApplied: listing.minNights,
    maxNights: listing.maxNights,
    nightly,
    groups: [...totals.values()],
    nightlyTotalMinor,
    cleaningFeeMinor,
    serviceFeeMinor: 0,
    totalMinor,
  };
}

export const demoBookings = [
  {
    listing: 0,
    status: 'pending',
    from: 12,
    to: 15,
    guests: 4,
    message: 'Приедем семьёй на выходные, хотим посмотреть Суздаль. Можно поздний заезд?',
  },
  {
    listing: 1,
    status: 'confirmed',
    from: 5,
    to: 8,
    guests: 2,
    message: 'Отмечаем годовщину, ищем тишину и камин.',
  },
  {
    listing: 2,
    status: 'confirmed',
    from: 30,
    to: 34,
    guests: 6,
    message: 'Компания друзей, нужна сауна и парковка на две машины.',
  },
  {
    listing: 3,
    status: 'confirmed',
    from: 45,
    to: 48,
    guests: 2,
    message: 'Хотим поработать удалённо неделю, нужен стабильный Wi-Fi.',
  },
  { listing: 4, status: 'completed', from: -35, to: -31, guests: 5 },
  { listing: 5, status: 'completed', from: -80, to: -76, guests: 3 },
  {
    listing: 6,
    status: 'declined',
    from: 22,
    to: 24,
    guests: 4,
    hostResponse: 'К сожалению, на эти даты уже запланирован ремонт террасы.',
  },
  {
    listing: 7,
    status: 'cancelled_by_guest',
    from: 28,
    to: 31,
    guests: 6,
    reason: 'Изменились планы поездки.',
  },
  { listing: 8, status: 'expired', from: 18, to: 20, guests: 2 },
  {
    listing: 9,
    status: 'confirmed',
    from: 60,
    to: 63,
    guests: 5,
    message: 'Планируем приехать с собакой.',
  },
  {
    listing: 10,
    status: 'cancelled_by_host',
    from: 40,
    to: 43,
    guests: 8,
    reason: 'Плановый ремонт котельной. Приносим извинения.',
  },
  {
    listing: 11,
    status: 'pending',
    from: 90,
    to: 93,
    guests: 4,
    message: 'Хотим встретить Новый год в лесу.',
  },
  { listing: 12, status: 'completed', from: -20, to: -17, guests: 4 },
];

export const demoBlocks = [
  { listing: 2, from: 100, to: 103, reason: 'Личный отпуск хозяев' },
  { listing: 5, from: 120, to: 123, reason: 'Ремонт сауны' },
  { listing: 9, from: 140, to: 142, reason: 'Генеральная уборка' },
];

export const demoPriceRules = [
  {
    listing: 0,
    name: 'Новогодние праздники',
    from: 180,
    to: 210,
    price: 19_500,
    priority: 2,
    minNights: 3,
  },
  {
    listing: 1,
    name: 'Летний сезон',
    from: 200,
    to: 240,
    price: 14_500,
    priority: 1,
    minNights: 2,
  },
  {
    listing: 10,
    name: 'Новогодние праздники',
    from: 180,
    to: 210,
    price: 32_000,
    priority: 2,
    minNights: 3,
  },
];

export const demoFavorites = [0, 2, 4, 9];

export const demoBookingInputs = demoBookings.map((booking) => {
  const listing = demoListings[booking.listing];
  const from = dateFromOffset(booking.from);
  const to = dateFromOffset(booking.to);

  return {
    ...booking,
    from,
    to,
    listingIndex: booking.listing,
    listing,
    quote: quoteFor(listing, from, to, booking.guests),
  };
});

export { dateFromOffset };
