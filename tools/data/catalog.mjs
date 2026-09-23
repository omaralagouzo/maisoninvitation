// Single source of truth for the starter catalogue.
//
// Used by:
//   * tools/preview      – mock store data for the offline preview
//   * tools/images       – which demo invitations to screenshot into product images
//   * tools/shopify-setup – seeds the real Shopify store (products, metaobjects, pages)
//
// Everything here is *starter content*: designs, prices, add-ons and copy are
// placeholders to edit in Shopify admin once the store is live.

export const CURRENCY = 'USD';

/** Metaobject definition for a live invitation web page (/pages/invitation/<handle>). */
export const INVITATION_DEFINITION = {
  type: 'invitation',
  name: 'Invitation',
  urlHandle: 'invitation',
  displayNameKey: 'title',
  fields: [
    { key: 'title', name: 'Internal title', type: 'single_line_text_field', description: 'e.g. "Leila & Adam — English". Shown in admin (and as the SEO title); guests see the couple\'s names.', required: true },
    { key: 'design', name: 'Design', type: 'single_line_text_field', required: true, choices: ['ivoire', 'minuit', 'jardin', 'sable', 'ete'], description: 'Which Maison design to render.' },
    { key: 'language', name: 'Language', type: 'single_line_text_field', required: true, choices: ['en', 'ar'], description: 'en = English (left-to-right), ar = Arabic (right-to-left).' },
    { key: 'partner_one', name: 'First name shown', type: 'single_line_text_field', required: true },
    { key: 'partner_two', name: 'Second name shown', type: 'single_line_text_field', required: true },
    { key: 'intro_line', name: 'Opening line', type: 'multi_line_text_field', description: 'e.g. "Together with their families" or a verse. Each line break is kept.' },
    { key: 'hosts', name: 'Hosts', type: 'multi_line_text_field', description: 'Optional — the families or people hosting.' },
    { key: 'invitation_message', name: 'Invitation wording', type: 'multi_line_text_field' },
    { key: 'event_date', name: 'Date', type: 'date', required: true },
    { key: 'event_time', name: 'Start time (24h)', type: 'single_line_text_field', description: 'e.g. 19:30. Stored as text so it never shifts between time zones.', validations: [{ name: 'regex', value: '^([01][0-9]|2[0-3]):[0-5][0-9]$' }] },
    { key: 'date_note', name: 'Date note', type: 'single_line_text_field', description: 'Optional extra line under the date (overrides the automatic Hijri date on Arabic invitations).' },
    { key: 'show_hijri', name: 'Show Hijri date', type: 'boolean', description: 'Arabic invitations: show the Umm al-Qura Hijri date under the date.' },
    { key: 'venue_name', name: 'Venue', type: 'single_line_text_field', required: true },
    { key: 'venue_address', name: 'Venue address', type: 'multi_line_text_field' },
    { key: 'map_url', name: 'Map link', type: 'url', description: 'Google Maps / Apple Maps share link.' },
    { key: 'show_map', name: 'Embed map', type: 'boolean' },
    { key: 'schedule', name: 'Programme', type: 'multi_line_text_field', description: 'One item per line: "7:00 PM | Guest arrival".' },
    { key: 'celebrations', name: 'Celebrations (Été design)', type: 'multi_line_text_field', description: 'One event card per line: "Title | Venue | YYYY-MM-DD | HH:MM | Map link | Note", e.g. "The Hen | The Grand Hotel | 2027-09-30 | 15:00 | https://maps.app.goo.gl/… | ladies welcome". Leave a part empty to use the main venue, date, time or map link. Blank field = one card for the wedding.' },
    { key: 'gifts_note', name: 'Gifts note (Été design)', type: 'multi_line_text_field', description: 'Optional gifts message. Leave blank to hide the Gifts section.' },
    { key: 'dress_code', name: 'Dress code', type: 'single_line_text_field' },
    { key: 'story', name: 'A note from the couple', type: 'multi_line_text_field' },
    { key: 'closing_line', name: 'Closing line', type: 'single_line_text_field' },
    { key: 'cover_photo', name: 'Photo', type: 'file_reference', description: 'Été design: the venue photo guests scratch to reveal.', validations: [{ name: 'file_type_options', value: '["Image"]' }] },
    { key: 'rsvp_mode', name: 'RSVP method', type: 'single_line_text_field', choices: ['form', 'sheet', 'whatsapp', 'link', 'none'], description: 'form = Shopify form (emails you) · sheet = Google Sheet endpoint · whatsapp · link · none' },
    { key: 'rsvp_deadline', name: 'RSVP by', type: 'date' },
    { key: 'rsvp_max_guests', name: 'Max guests per reply', type: 'number_integer' },
    { key: 'rsvp_whatsapp', name: 'RSVP WhatsApp number', type: 'single_line_text_field', description: 'International format without + or spaces, e.g. 971501234567.' },
    { key: 'rsvp_link', name: 'RSVP link / Google Sheet endpoint', type: 'url' },
    { key: 'music_url', name: 'Background music (mp3 URL)', type: 'url', description: 'Upload the mp3 in Content → Files and paste its link.' },
    { key: 'alternate_invitation', name: 'Other-language version', type: 'metaobject_reference', description: 'For bilingual orders: link the English and Arabic versions to each other.' },
    { key: 'is_demo', name: 'Demo invitation', type: 'boolean', description: 'Demo invitations never send RSVPs.' },
  ],
};

/** Starter designs (one Shopify product each, variants by invitation language). */
export const DESIGNS = [
  {
    handle: 'ivoire',
    title: 'Ivoire',
    name_ar: 'إيفوار',
    type: 'Classic',
    subtitle: 'Cream, brass & an arched frame',
    subtitle_ar: 'عاجيّ ونحاسيّ بإطار مقوّس',
    palette: ['#F7F3EC', '#1F1D1A', '#A9824F'],
    description:
      '<p>Timeless and quietly luxurious. Ivoire sets your names in flowing script beneath a hand-drawn arch, finished in warm brass on ivory — the digital equivalent of heavy cotton card and a wax seal.</p><p>Guests open a sealed envelope, then scroll through your day: the countdown, the programme, the venue with directions, and a one-tap RSVP.</p>',
    description_ar:
      '<p>أناقة كلاسيكية هادئة. تُكتب أسماؤكما بخطٍّ منساب تحت قوسٍ مرسوم باليد، بلمساتٍ نحاسية دافئة على لونٍ عاجيّ — كأنها بطاقة قطنية فاخرة مختومة بالشمع.</p><p>يفتح ضيوفكم ظرفًا مختومًا، ثم يتنقّلون بين تفاصيل يومكم: العدّ التنازلي، والبرنامج، والموقع مع الاتجاهات، وتأكيد الحضور بلمسة واحدة.</p>',
  },
  {
    handle: 'minuit',
    title: 'Minuit',
    name_ar: 'مينوي',
    type: 'Evening',
    subtitle: 'Midnight blue, gold & starlight',
    subtitle_ar: 'أزرق ليليّ وذهبيّ وضوء النجوم',
    palette: ['#141A2E', '#C9A96A', '#EDE6D6'],
    description:
      '<p>Made for evening celebrations. Minuit pairs deep midnight blue with gold foil tones, a crescent moon and a scattering of stars — dramatic, romantic and unmistakably formal.</p>',
    description_ar:
      '<p>صُمّمت لحفلات المساء. يجمع تصميم مينوي بين الأزرق الليلي العميق ولمسات الذهب، مع هلالٍ ونجومٍ متناثرة — فخامة رومانسية ورسمية لا تُخطئها العين.</p>',
  },
  {
    handle: 'jardin',
    title: 'Jardin',
    name_ar: 'جاردان',
    type: 'Botanical',
    subtitle: 'Sage, blush & hand-drawn greenery',
    subtitle_ar: 'أخضر مريميّ ووردي هادئ وأغصان مرسومة',
    palette: ['#FBFAF6', '#7D8B6A', '#E8CFC4'],
    description:
      '<p>Soft, fresh and full of life. Jardin frames your invitation with delicate line-drawn botanicals in sage and blush — perfect for garden ceremonies, daytime weddings and spring celebrations.</p>',
    description_ar:
      '<p>ناعم ومنعش ومفعم بالحياة. يحيط تصميم جاردان دعوتكم بأغصانٍ رقيقة مرسومة بالخط بألوان المريمية والوردي الهادئ — مثاليّ لحفلات الحدائق والأعراس النهارية واحتفالات الربيع.</p>',
  },
  {
    handle: 'sable',
    title: 'Sable',
    name_ar: 'سابل',
    type: 'Modern',
    subtitle: 'Desert sand, terracotta & sunset arcs',
    subtitle_ar: 'رمال الصحراء والتراكوتا وأقواس الغروب',
    palette: ['#EADCC8', '#B5654A', '#3B2A20'],
    description:
      '<p>Warm, modern and graphic. Sable draws on desert sunsets — layered arcs, terracotta and sand, with bold contemporary type. Made for destination weddings and couples who like a clean, confident look.</p>',
    description_ar:
      '<p>دافئ وعصري وجريء. يستلهم تصميم سابل غروب الصحراء — أقواسٌ متدرّجة وألوان التراكوتا والرمال مع خطوطٍ معاصرة واضحة. مثاليّ لأعراس الوجهات وللأزواج الذين يفضّلون الطابع العصري الواثق.</p>',
  },
  {
    handle: 'ete',
    title: 'Été',
    name_ar: 'إيتيه',
    type: 'Botanical',
    subtitle: 'Pearl-beaded trees, lace & a summer garden',
    subtitle_ar: 'أشجار مطرّزة باللؤلؤ ودانتيل وحديقة صيفية',
    palette: ['#FBF6F4', '#937C67', '#7C8466'],
    description:
      '<p>A summer garden in pearl embroidery. Été opens from a real paper envelope onto swaying beaded trees, then counts down the days beneath strings of pearl lanterns. Guests scratch a lace frame to reveal your venue, and a beaded fan opens as they scroll through the day.</p><p>Every celebration gets its own card with a map link, and the RSVP collects dietary needs, companions and song requests.</p>',
    description_ar:
      '<p>حديقة صيفية مطرّزة باللؤلؤ. يُفتح تصميم إيتيه من ظرفٍ ورقيٍّ حقيقي على أشجارٍ مطرّزة تتمايل، ثم يعدّ الأيام تحت عناقيد من الفوانيس اللؤلؤية. يمسح ضيوفكم إطارًا من الدانتيل ليكتشفوا المكان، وتنفتح مروحة مطرّزة وهم يتصفّحون برنامج اليوم.</p><p>لكل مناسبة بطاقتها مع رابط الخريطة، ويجمع تأكيد الحضور المتطلبات الغذائية والمرافقين وطلبات الأغاني.</p>',
  },
];

/** Variant options — the option value text is what customers see. */
export const LANGUAGE_OPTION = 'Language';
export const VARIANTS = [
  { value: 'English', code: 'en', price: '95.00', ar: 'الإنجليزية' },
  { value: 'Arabic', code: 'ar', price: '95.00', ar: 'العربية' },
  { value: 'Bilingual', code: 'both', price: '135.00', ar: 'ثنائية اللغة' },
];

/** Optional extras offered on the product page. */
export const ADDONS = [
  {
    handle: 'express-delivery',
    title: 'Express delivery',
    title_ar: 'تسليم سريع',
    price: '35.00',
    description: '<p>Your first preview within 48 hours of receiving your details.</p>',
    description_ar: '<p>أول معاينة لدعوتكم خلال ٤٨ ساعة من استلام التفاصيل.</p>',
  },
  {
    handle: 'rsvp-guest-list',
    title: 'RSVP guest list',
    title_ar: 'قائمة الضيوف وتأكيد الحضور',
    price: '25.00',
    description: '<p>We connect your RSVPs to a private live spreadsheet you can share with family.</p>',
    description_ar: '<p>نربط ردود ضيوفكم بجدول بيانات خاص ومباشر يمكنكم مشاركته مع العائلة.</p>',
  },
];

const T = (s) => s.replace(/^\n/, '');

/** Demo invitations — one per design × language. Handles: <design>-<lang>. */
export const DEMO_INVITATIONS = [
  // ---------------------------------------------------------------- Ivoire
  {
    handle: 'ivoire-en',
    design: 'ivoire',
    language: 'en',
    title: 'Demo — Ivoire (English)',
    partner_one: 'Leila',
    partner_two: 'Adam',
    intro_line: 'Together with their families',
    invitation_message: 'request the pleasure of your company\nat the celebration of their marriage',
    event_date: '2027-04-15',
    event_time: '19:30',
    venue_name: 'The Orangery',
    venue_address: 'Al Waha Gardens\nDubai, United Arab Emirates',
    map_url: 'https://maps.google.com/?q=Dubai',
    schedule: T(`
7:30 PM | Guest arrival & welcome
8:30 PM | Ceremony
9:30 PM | Dinner & celebration
12:00 AM | Farewell`),
    dress_code: 'Black tie',
    story: 'We met on a rainy afternoon in a bookshop neither of us meant to visit. Ten years, two cities and one very patient cat later, we can’t wait to celebrate with the people we love most.',
    closing_line: 'We can’t wait to celebrate with you',
    rsvp_mode: 'form',
    rsvp_deadline: '2027-03-15',
    rsvp_max_guests: 2,
    is_demo: true,
    alternate: 'ivoire-ar',
  },
  {
    handle: 'ivoire-ar',
    design: 'ivoire',
    language: 'ar',
    title: 'Demo — Ivoire (Arabic)',
    partner_one: 'آدم',
    partner_two: 'ليلى',
    intro_line: 'بسم الله الرحمن الرحيم\nوَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً',
    hosts: 'يتشرّف\nالسيد خالد المنصور والسيد سامي الأحمد',
    invitation_message: 'بدعوتكم لحضور حفل زفاف نجليهما',
    event_date: '2027-04-15',
    event_time: '19:30',
    show_hijri: true,
    venue_name: 'قاعة الياسمين — فندق قصر الواحة',
    venue_address: 'دبي، الإمارات العربية المتحدة',
    map_url: 'https://maps.google.com/?q=Dubai',
    schedule: T(`
٧:٣٠ مساءً | استقبال الضيوف
٨:٣٠ مساءً | الزفّة
٩:٣٠ مساءً | العشاء
١٢:٠٠ صباحًا | ختام الحفل`),
    dress_code: 'الزيّ الرسمي',
    closing_line: 'وبحضوركم يكتمل فرحنا',
    rsvp_mode: 'form',
    rsvp_deadline: '2027-03-15',
    rsvp_max_guests: 2,
    is_demo: true,
    alternate: 'ivoire-en',
  },
  // ---------------------------------------------------------------- Minuit
  {
    handle: 'minuit-en',
    design: 'minuit',
    language: 'en',
    title: 'Demo — Minuit (English)',
    partner_one: 'Sophia',
    partner_two: 'James',
    intro_line: 'Beneath the evening stars',
    invitation_message: 'invite you to celebrate\ntheir wedding',
    event_date: '2027-06-10',
    event_time: '20:00',
    venue_name: 'The Starlight Terrace',
    venue_address: 'Aurelia Hotel, Corniche Road\nAbu Dhabi, United Arab Emirates',
    map_url: 'https://maps.google.com/?q=Abu+Dhabi',
    schedule: T(`
8:00 PM | Welcome under the stars
8:45 PM | Vows
9:30 PM | Dinner
10:30 PM | First dance & celebration`),
    dress_code: 'Evening formal',
    closing_line: 'Dance with us until midnight',
    rsvp_mode: 'whatsapp',
    rsvp_whatsapp: '971500000000',
    rsvp_deadline: '2027-05-10',
    rsvp_max_guests: 2,
    is_demo: true,
    alternate: 'minuit-ar',
  },
  {
    handle: 'minuit-ar',
    design: 'minuit',
    language: 'ar',
    title: 'Demo — Minuit (Arabic)',
    partner_one: 'يوسف',
    partner_two: 'سلمى',
    intro_line: 'في ليلةٍ يكتمل فيها القمر',
    hosts: 'تتشرّف عائلتا النجّار والخطيب',
    invitation_message: 'بدعوتكم لمشاركتهم فرحة زفاف',
    event_date: '2027-06-10',
    event_time: '20:00',
    show_hijri: true,
    venue_name: 'تراس ستارلايت — فندق أوريليا',
    venue_address: 'طريق الكورنيش، أبوظبي',
    map_url: 'https://maps.google.com/?q=Abu+Dhabi',
    schedule: T(`
٨:٠٠ مساءً | الاستقبال
٨:٤٥ مساءً | الزفّة
٩:٣٠ مساءً | العشاء
١٠:٣٠ مساءً | الرقصة الأولى والاحتفال`),
    dress_code: 'الزيّ الرسمي المسائي',
    closing_line: 'حضوركم يزيدنا فرحًا وسرورًا',
    rsvp_mode: 'whatsapp',
    rsvp_whatsapp: '971500000000',
    rsvp_deadline: '2027-05-10',
    rsvp_max_guests: 2,
    is_demo: true,
    alternate: 'minuit-en',
  },
  // ---------------------------------------------------------------- Jardin
  {
    handle: 'jardin-en',
    design: 'jardin',
    language: 'en',
    title: 'Demo — Jardin (English)',
    partner_one: 'Nadia',
    partner_two: 'Sami',
    intro_line: 'With joy in our hearts',
    invitation_message: 'we invite you to join us in the garden\nas we say “I do”',
    event_date: '2027-05-01',
    event_time: '17:00',
    venue_name: 'The Rose Garden Pavilion',
    venue_address: 'Dabouq\nAmman, Jordan',
    map_url: 'https://maps.google.com/?q=Amman',
    schedule: T(`
5:00 PM | Garden ceremony
6:00 PM | Lemonade & canapés
7:30 PM | Dinner under the trees
9:00 PM | Dancing`),
    dress_code: 'Garden formal — pastels welcome',
    closing_line: 'Love, Nadia & Sami',
    rsvp_mode: 'form',
    rsvp_deadline: '2027-04-01',
    rsvp_max_guests: 4,
    is_demo: true,
    alternate: 'jardin-ar',
  },
  {
    handle: 'jardin-ar',
    design: 'jardin',
    language: 'ar',
    title: 'Demo — Jardin (Arabic)',
    partner_one: 'زيد',
    partner_two: 'نور',
    intro_line: 'بقلوبٍ ملؤها الفرح',
    invitation_message: 'ندعوكم لمشاركتنا فرحة عقد قراننا\nفي حديقة الورد',
    event_date: '2027-05-01',
    event_time: '17:00',
    show_hijri: true,
    venue_name: 'جناح حديقة الورد',
    venue_address: 'دابوق، عمّان، الأردن',
    map_url: 'https://maps.google.com/?q=Amman',
    schedule: T(`
٥:٠٠ مساءً | عقد القران في الحديقة
٦:٠٠ مساءً | ضيافة
٧:٣٠ مساءً | العشاء تحت الأشجار
٩:٠٠ مساءً | الاحتفال`),
    dress_code: 'ألوان ربيعية هادئة',
    closing_line: 'بمحبّة، زيد ونور',
    rsvp_mode: 'form',
    rsvp_deadline: '2027-04-01',
    rsvp_max_guests: 4,
    is_demo: true,
    alternate: 'jardin-en',
  },
  // ---------------------------------------------------------------- Sable
  {
    handle: 'sable-en',
    design: 'sable',
    language: 'en',
    title: 'Demo — Sable (English)',
    partner_one: 'Amira',
    partner_two: 'Daniel',
    intro_line: 'Save the evening',
    invitation_message: 'Join us for a night of love\nand celebration in the desert',
    event_date: '2027-11-18',
    event_time: '18:30',
    venue_name: 'Sahra Desert Camp',
    venue_address: 'Mleiha\nSharjah, United Arab Emirates',
    map_url: 'https://maps.google.com/?q=Mleiha',
    schedule: T(`
6:30 PM | Sunset gathering
7:15 PM | Ceremony on the dunes
8:00 PM | Dinner by firelight
10:00 PM | Music under the stars`),
    dress_code: 'Desert chic — earthy tones',
    story: 'Transport from Dubai departs at 5:00 PM — details will follow closer to the date.',
    closing_line: 'See you at sunset',
    rsvp_mode: 'form',
    rsvp_deadline: '2027-10-18',
    rsvp_max_guests: 2,
    is_demo: true,
    alternate: 'sable-ar',
  },
  {
    handle: 'sable-ar',
    design: 'sable',
    language: 'ar',
    title: 'Demo — Sable (Arabic)',
    partner_one: 'علي',
    partner_two: 'مريم',
    intro_line: 'على موعدٍ مع الفرح',
    invitation_message: 'ندعوكم لمشاركتنا ليلة العمر\nتحت سماء الصحراء',
    event_date: '2027-11-18',
    event_time: '18:30',
    show_hijri: true,
    venue_name: 'مخيّم صحراء',
    venue_address: 'مليحة، الشارقة، الإمارات العربية المتحدة',
    map_url: 'https://maps.google.com/?q=Mleiha',
    schedule: T(`
٦:٣٠ مساءً | لقاء الغروب
٧:١٥ مساءً | الزفّة على الكثبان
٨:٠٠ مساءً | العشاء على ضوء النار
١٠:٠٠ مساءً | أمسية موسيقية تحت النجوم`),
    dress_code: 'ألوان ترابية',
    story: 'تنطلق الحافلات من دبي الساعة ٥:٠٠ مساءً — سنوافيكم بالتفاصيل قبل الموعد.',
    closing_line: 'نلقاكم عند الغروب',
    rsvp_mode: 'form',
    rsvp_deadline: '2027-10-18',
    rsvp_max_guests: 2,
    is_demo: true,
    alternate: 'sable-en',
  },
  // ---------------------------------------------------------------- Été (the "Summer Wedding" Canva design)
  {
    handle: 'ete-en',
    design: 'ete',
    language: 'en',
    title: 'Demo — Été (English)',
    partner_one: 'Sarah',
    partner_two: 'Deen',
    intro_line: 'We’re getting married!',
    event_date: '2027-10-01',
    event_time: '14:00',
    venue_name: 'Amazing Wedding Venue',
    venue_address: 'City, Country',
    map_url: 'https://maps.google.com/?q=The+Magnificent+Hotel',
    celebrations: T(`
The Hen | The Magnificent Hotel | 2027-09-30 | 15:00 | https://maps.google.com/?q=The+Magnificent+Hotel | ladies welcome
The Wedding | The Magnificent Hotel | | | | all welcome`),
    schedule: T(`
11:00 am | Wedding Ceremony
1:00 pm | Wedding Lunch
3:00 pm | Cake Cutting
4:00 pm | Cocktail Hour
5:00 pm | First Dance
8:00 pm | Buffet Dinner
11:00 pm | Fireworks`),
    gifts_note: 'Your presence is our greatest gift.\nIf you wish to honour us with a gift, we kindly prefer monetary contributions upon the start of our new chapter as husband & wife.',
    rsvp_mode: 'form',
    rsvp_max_guests: 6,
    is_demo: true,
    alternate: 'ete-ar',
  },
  {
    handle: 'ete-ar',
    design: 'ete',
    language: 'ar',
    title: 'Demo — Été (Arabic)',
    partner_one: 'دين',
    partner_two: 'سارة',
    intro_line: 'سنحتفل بزفافنا!',
    event_date: '2027-10-01',
    event_time: '14:00',
    show_hijri: true,
    venue_name: 'قاعة الحديقة الصيفية',
    venue_address: 'المدينة، الدولة',
    map_url: 'https://maps.google.com/?q=The+Magnificent+Hotel',
    celebrations: T(`
ليلة الحنّاء | فندق ذا ماغنيفيسنت | 2027-09-30 | 15:00 | https://maps.google.com/?q=The+Magnificent+Hotel | للسيدات
حفل الزفاف | فندق ذا ماغنيفيسنت | | | | الجميع مرحّب بهم`),
    schedule: T(`
١١:٠٠ صباحًا | عقد القران
١:٠٠ مساءً | غداء الزفاف
٣:٠٠ مساءً | تقطيع الكعكة
٤:٠٠ مساءً | الضيافة
٥:٠٠ مساءً | الرقصة الأولى
٨:٠٠ مساءً | العشاء
١١:٠٠ مساءً | الألعاب النارية`),
    gifts_note: 'حضوركم هو أجمل هدية لنا.\nوإن رغبتم في تكريمنا بهدية، فنفضّل المساهمة المالية ونحن نبدأ فصلنا الجديد معًا.',
    rsvp_mode: 'form',
    rsvp_max_guests: 6,
    is_demo: true,
    alternate: 'ete-en',
  },
];

/** Content pages created in Shopify (body can be empty — the templates carry the content). */
export const PAGES = [
  { handle: 'how-it-works', title: 'How it works', title_ar: 'كيف تعمل', templateSuffix: 'how-it-works' },
  { handle: 'faq', title: 'Questions', title_ar: 'الأسئلة الشائعة', templateSuffix: 'faq' },
  { handle: 'about', title: 'About the Maison', title_ar: 'عن الميزون', templateSuffix: 'about' },
  { handle: 'contact', title: 'Contact', title_ar: 'تواصل معنا', templateSuffix: 'contact' },
];

/** Product image files generated by tools/images for each design × language. */
export const productImages = (handle) => ({
  en: `${handle}-en-card.jpg`,
  ar: `${handle}-ar-card.jpg`,
  both: `${handle}-both-card.jpg`,
  envelope: `${handle}-en-envelope.jpg`,
  details: `${handle}-en-details.jpg`,
  envelope_ar: `${handle}-ar-envelope.jpg`,
  details_ar: `${handle}-ar-details.jpg`,
});
