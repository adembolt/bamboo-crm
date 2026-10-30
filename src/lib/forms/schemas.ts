/* Bamboo Danışan Formları — şemalar (eski "Bamboo Danışan Formları" sayfasından taşındı).
   Metinler Türkçe; EN/RU çevirileri src/lib/forms/i18n.ts içinde Türkçe metin anahtarıyla tutulur. */

export type FieldType = "text" | "tel" | "date" | "textarea" | "radio" | "multi" | "yesno" | "rating" | "scale" | "bodymap" | "consent" | "info" | "grid";
export type Field = {
  id?: string; label?: string; type: FieldType; text?: string; bullets?: string[]; muted?: boolean;
  options?: string[]; items?: string[]; rows?: string[]; cols?: string[]; num?: boolean; vertical?: boolean;
  half?: boolean; req?: boolean; warnOnYes?: boolean; client?: "name" | "phone" | "birth" | "nat" | "email" | "address" | "emergency";
};
export type Section = { title: string; staffOnly?: boolean; fields: Field[] };
export type FormSchema = { title: string; short: string; group: string; sign: boolean; staffForm?: boolean; sections: Section[] };
export type FormKey = "intake" | "laser" | "hifu" | "peel" | "massage" | "assess";
type ConsentOpts = { name: string; about: string; results: string[]; effects: string[]; contra: string[]; extra: string[] };

export const HEALTH_YESNO = [
  'Hamile misiniz, hamilelik planınız var mı veya emziriyor musunuz?', 'Kalp rahatsızlığı, kalp pili veya ritim bozukluğu', 'Yüksek / düşük tansiyon',
  'Diyabet (şeker hastalığı)', 'Epilepsi veya nöbet geçmişi', 'Kanser tanısı veya devam eden tedavi (kemoterapi / radyoterapi)',
  'Tiroid veya hormonal rahatsızlık (PCOS dahil)', 'Otoimmün hastalık (lupus, romatoid artrit vb.)', 'Kan pıhtılaşma bozukluğu veya kan sulandırıcı kullanımı',
  'Uçuk (herpes) geçmişi', 'Egzama, sedef, rozasea, vitiligo veya başka cilt hastalığı', 'Keloid / kalın iz bırakma eğilimi',
  'Varis, damar tıkanıklığı veya tromboz geçmişi', 'Vücutta metal implant, protez, vida veya platin', 'Son 6 ayda geçirilmiş ameliyat',
  'Bulaşıcı cilt veya tırnak enfeksiyonu (mantar vb.)', 'Bel, boyun fıtığı veya kas-iskelet sorunu'];
export const HEALTH_SHORT = ['Hamile / emziriyor', 'Kalp / kalp pili', 'Tansiyon', 'Diyabet', 'Epilepsi', 'Kanser tedavisi', 'Tiroid / hormonal', 'Otoimmün hastalık', 'Kan sulandırıcı', 'Uçuk geçmişi', 'Cilt hastalığı', 'Keloid eğilimi', 'Varis / tromboz', 'Metal implant', 'Yakın ameliyat', 'Bulaşıcı enfeksiyon', 'Fıtık / kas-iskelet'];
export const MED_SHORT = ['Düzenli ilaç', 'Roaccutane (6 ay)', 'Işığa duyarlılık ilacı', 'Retinoid / asit', 'İlaç alerjisi', 'Kozmetik alerjisi', 'Lateks / nikel / besin alerjisi'];
export const MED_YESNO = ['Düzenli kullandığınız ilaç var mı?', 'Son 6 ayda isotretinoin (Roaccutane vb.) kullandınız mı?', 'Işığa duyarlılık yapan ilaç kullanıyor musunuz? (bazı antibiyotikler vb.)',
  'Retinol, retinoid, AHA/BHA içeren ürün kullanıyor musunuz?', 'İlaç alerjisi', 'Kozmetik, parfüm veya esansiyel yağ alerjisi', 'Lateks, nikel veya besin alerjisi'];
export const PERSONAL: Field[] = [
  { id: 'name', label: 'Ad Soyad', type: 'text', client: 'name', req: true, half: true },
  { id: 'phone', label: 'Telefon / WhatsApp', type: 'tel', client: 'phone', half: true },
  { id: 'birth', label: 'Doğum tarihi', type: 'date', client: 'birth', half: true },
  { id: 'nat', label: 'Uyruk / Dil', type: 'text', client: 'nat', half: true },
];

function consentForm(o: ConsentOpts): FormSchema {
  return {
    title: o.name + ' Onam Formu', short: o.name, group: 'Onam formları', sign: true,
    sections: [
      { title: 'Danışan', fields: [PERSONAL[0], PERSONAL[1], { id: 'area', label: 'Uygulama bölgesi', type: 'text', half: true }] },
      { title: 'İşlem Hakkında', fields: [
        { type: 'info', text: o.about },
        { type: 'info', label: 'Beklenen sonuçlar', bullets: o.results },
        { type: 'info', label: 'Olası geçici yan etkiler', bullets: o.effects } ] },
      { title: 'Güvenlik Kontrolü', fields: [
        { type: 'info', text: 'Aşağıdakilerden herhangi biri sizin için geçerliyse işlem ertelenebilir veya uygulanmayabilir.', muted: true },
        { id: 'contra', type: 'yesno', items: o.contra, warnOnYes: true } ] },
      { title: 'Onay ve Sorumluluklar', fields: [{ id: 'consent', type: 'consent', items: [
        'İşlemin nasıl yapılacağı, beklenen sonuçlar ve olası yan etkiler bana açıklandı; sorularım yanıtlandı.',
        'Sonuçların kişiden kişiye değiştiğini, kesin sonuç garantisi verilmediğini anlıyorum.',
        ...o.extra,
        'İşlem sonrası bakım talimatlarını aldım; uymamam hâlinde oluşabilecek sorunlardan sorumlu olduğumu kabul ediyorum.',
        'Sağlık beyanımın doğru olduğunu onaylıyor ve bu işlemin uygulanmasına kendi isteğimle onay veriyorum.'] }] },
    ],
  };
}

export const FORMS: Record<FormKey, FormSchema> = {
  intake: {
    title: 'Danışan Kabul Formu', short: 'Kabul formu', group: 'Kayıt', sign: true,
    sections: [
      { title: 'Kişisel Bilgiler', fields: [...PERSONAL,
        { id: 'job', label: 'Meslek', type: 'text', half: true },
        { id: 'email', label: 'E-posta', type: 'text', client: 'email', half: true },
        { id: 'address', label: 'Adres / Konakladığınız otel', type: 'text', client: 'address' },
        { id: 'emergency', label: 'Acil durum kişisi ve telefonu', type: 'text', client: 'emergency' },
        { id: 'source', label: 'Bizi nereden duydunuz?', type: 'radio', options: ['Instagram', 'Google', 'Tavsiye', 'Otel', 'Yat / Marina', 'Diğer'] },
        { id: 'returning', label: 'Daha önce salonumuza geldiniz mi?', type: 'radio', options: ['Evet', 'Hayır'] }] },
      { title: 'Sağlık Geçmişi', fields: [
        { type: 'info', text: 'Size uyan durumları işaretleyin. Bu bilgiler hangi işlemlerin sizin için güvenli olduğunu belirlememizi sağlar.', muted: true },
        { id: 'health', type: 'yesno', items: HEALTH_YESNO, warnOnYes: true }] },
      { title: 'İlaçlar ve Alerjiler', fields: [{ id: 'meds', type: 'yesno', items: MED_YESNO, warnOnYes: true }] },
      { title: 'Cilt ve Yaşam Tarzı', fields: [
        { id: 'skin', label: 'Cilt tipiniz', type: 'radio', options: ['Normal', 'Kuru', 'Yağlı', 'Karma', 'Hassas', 'Bilmiyorum'] },
        { id: 'sun', label: 'Güneşe maruz kalma', type: 'radio', options: ['Az', 'Orta', 'Çok'] },
        { id: 'tan', label: 'Son 4 haftada güneşlendiniz / solaryuma girdiniz mi?', type: 'radio', options: ['Evet', 'Hayır'] },
        { id: 'smoke', label: 'Sigara', type: 'radio', options: ['Hayır', 'Ara sıra', 'Düzenli'] },
        { id: 'water', label: 'Günlük su tüketimi', type: 'radio', options: ['1 L altı', '1–2 L', '2 L üzeri'] },
        { id: 'stress', label: 'Stres seviyesi', type: 'radio', options: ['Düşük', 'Orta', 'Yüksek'] },
        { id: 'routine', label: 'Günlük cilt bakım rutininiz', type: 'multi', options: ['Temizleyici', 'Tonik', 'Serum', 'Nemlendirici', 'Güneş kremi (SPF)', 'Makyaj', 'Hiçbiri'] },
        { id: 'products', label: 'Kullandığınız ürünler', type: 'text' },
        { id: 'prev', label: 'Daha önce yaptırdığınız estetik işlemler (botoks, dolgu, peeling, lazer, HIFU… ve yaklaşık tarihleri)', type: 'textarea' }] },
      { title: 'Beklentileriniz', fields: [
        { id: 'goalsSkin', label: 'Cilt', type: 'multi', options: ['Akne / sivilce', 'Leke', 'Kırışıklık', 'Sıkılaşma', 'Nem / canlılık', 'Gözenek'] },
        { id: 'goalsBody', label: 'Vücut', type: 'multi', options: ['İstenmeyen tüy', 'Selülit / sıkılaşma', 'Rahatlama', 'Ağrı / gerginlik'] },
        { id: 'goalsHand', label: 'El / ayak', type: 'multi', options: ['Manikür', 'Pedikür', 'Akıllı ayak bakımı', 'Nasır / topuk çatlağı'] },
        { id: 'goalText', label: 'Hedefinizi kendi cümlelerinizle yazın', type: 'textarea' }] },
      { title: 'Beyan ve KVKK Açık Rıza', fields: [
        { type: 'info', text: 'Verdiğim bilgilerin doğru ve eksiksiz olduğunu, sağlık durumumda veya kullandığım ilaçlarda değişiklik olursa salonu bilgilendireceğimi beyan ederim. 6698 sayılı KVKK kapsamında kimlik, iletişim ve sağlık verilerimin yalnızca hizmet sunumu, randevu takibi ve yasal yükümlülükler amacıyla Bamboo Beauty Lifes tarafından işlenmesine ilişkin bilgilendirildim.' },
        { id: 'kvkk', type: 'consent', items: ['Sağlık verilerimin hizmet güvenliği amacıyla işlenmesine açık rıza veriyorum.', 'Beyanımın doğru olduğunu onaylıyorum.'] },
        { id: 'optin', label: 'İsteğe bağlı izinler', type: 'multi', options: ['Tedavi takibi için önce / sonra fotoğrafımın çekilmesine izin veriyorum', 'Yüzüm görünmeyecek şekilde fotoğraflarımın sosyal medyada paylaşılmasına izin veriyorum', 'Kampanya ve hatırlatmalar için WhatsApp / SMS / e-posta ile iletişime izin veriyorum'] }] },
      { title: 'Salon Kullanımı', staffOnly: true, fields: [
        { id: 'plan', label: 'Önerilen işlem(ler)', type: 'text' }, { id: 'warn', label: 'Kontrendikasyon / uyarı', type: 'text' }, { id: 'staffNote', label: 'Notlar', type: 'textarea' }] },
    ],
  },
  laser: consentForm({
    name: 'Lazer Epilasyon',
    about: 'Lazer epilasyon, lazer ışığının kıl kökündeki pigment tarafından emilerek kıl köklerinin zayıflatılması esasına dayanır. Kıllar farklı büyüme evrelerinde olduğundan kalıcı azalma için genellikle 6–10 seans gerekir. Seans aralıkları bölgeye göre 4–8 hafta arasında değişir.',
    results: ['Kıl yoğunluğunda kademeli ve kalıcı azalma', 'Kalan kılların incelmesi ve açılması', 'Batık kıl sorununda azalma'],
    effects: ['Kızarıklık, hafif şişlik ve sıcaklık hissi (birkaç saat – 2 gün)', 'Kıl kökü etrafında kabarıklık', 'Nadiren geçici renk değişikliği, kabuklanma veya su toplaması', 'Açık renkli (sarı, beyaz, kızıl) kıllarda etkinlik düşüktür'],
    contra: ['Hamilelik veya emzirme', 'Son 4 haftada güneşlenme, solaryum veya bronzlaştırıcı kullanımı', 'Son 6 ayda isotretinoin (Roaccutane) kullanımı', 'Işığa duyarlılık yapan ilaç kullanımı', 'Uygulama bölgesinde dövme, açık yara, aktif uçuk veya enfeksiyon', 'Son 4 haftada ağda, cımbız veya epilatör kullanımı', 'Epilepsi, keloid eğilimi veya vitiligo'],
    extra: ['İşlemden önce bölgeyi tıraş etmem, ağda / cımbız kullanmamam gerektiğini biliyorum.', 'Seanslar arasında ve tedavi süresince güneşten korunacağımı ve SPF 50 kullanacağımı kabul ediyorum.'],
  }),
  hifu: consentForm({
    name: 'HIFU',
    about: 'HIFU (Yüksek Yoğunluklu Odaklanmış Ultrason), ultrason enerjisini cildin alt katmanlarına odaklayarak kolajen üretimini destekler. Ameliyatsız bir sıkılaştırma yöntemidir. Sonuçlar kademeli olarak ortaya çıkar ve genellikle 2–3 ayda belirginleşir.',
    results: ['Ciltte sıkılaşma ve toparlanma', 'Yüz hatlarında belirginleşme', 'İnce çizgilerde yumuşama'],
    effects: ['Uygulama sırasında sıcaklık, batma veya hafif ağrı hissi', 'Kızarıklık, hafif şişlik (birkaç saat – birkaç gün)', 'Dokunma hassasiyeti veya geçici uyuşukluk', 'Nadiren çizgi şeklinde geçici iz veya morarma'],
    contra: ['Hamilelik veya emzirme', 'Uygulama bölgesinde metal implant, dolgu veya iplik (son 6 ay)', 'Kalp pili veya elektronik implant', 'Bölgede açık yara, akne alevlenmesi veya enfeksiyon', 'Kanser tedavisi veya ciddi kronik hastalık', 'Son 2 haftada botoks uygulaması'],
    extra: ['Sonuçların kademeli ortaya çıktığını ve ek seans gerekebileceğini anlıyorum.'],
  }),
  peel: consentForm({
    name: 'Cilt Bakımı ve Kimyasal Peeling',
    about: 'Profesyonel cilt bakımı; temizlik, peeling, gerektiğinde komedon temizliği, serum ve maske uygulamalarını kapsar. Kimyasal peeling, asit içerikli ürünlerle ölü hücrelerin uzaklaştırılması ve cilt yenilenmesinin desteklenmesidir. Ürün ve güç seçimi cilt analizinize göre yapılır.',
    results: ['Daha temiz, pürüzsüz ve canlı cilt görünümü', 'Gözenek ve siyah noktalarda azalma', 'Leke ve ton eşitsizliğinde düzelme (seanslar hâlinde)'],
    effects: ['Kızarıklık, batma veya yanma hissi', 'Birkaç gün süren kuruluk ve pul pul soyulma', 'Geçici sivilce artışı (arınma dönemi)', 'Nadiren leke, kabuklanma veya hassasiyet'],
    contra: ['Hamilelik veya emzirme (peeling için)', 'Son 6 ayda isotretinoin (Roaccutane) kullanımı', 'Son 1 haftada retinol / retinoid kullanımı', 'Aktif uçuk, açık yara veya ciddi güneş yanığı', 'Asit veya kozmetik ürün alerjisi', 'Son 2 haftada ağda, lazer veya başka peeling'],
    extra: ['İşlemden sonra en az 1 hafta güneşten korunacağımı ve SPF kullanacağımı kabul ediyorum.', 'Soyulan cildi elle koparmayacağımı taahhüt ederim.'],
  }),
  massage: {
    title: 'Masaj Onam ve Değerlendirme Formu', short: 'Masaj', group: 'Onam formları', sign: true,
    sections: [
      { title: 'Danışan', fields: [PERSONAL[0], PERSONAL[1]] },
      { title: 'Masaj Bilgileri', fields: [
        { id: 'before', label: 'Daha önce profesyonel masaj yaptırdınız mı?', type: 'radio', options: ['Evet', 'Hayır'] },
        { id: 'kind', label: 'İstediğiniz masaj', type: 'radio', options: ['Rahatlama', 'Terapötik / derin doku', 'Aromaterapi', 'Spor', 'Lenf drenajı', 'Diğer'] },
        { id: 'pressure', label: 'Bası tercihiniz', type: 'radio', options: ['Hafif', 'Orta', 'Sert'] },
        { id: 'avoid', label: 'Masaj yapılmasını istemediğiniz bölgeler', type: 'multi', options: ['Yüz', 'Baş / saç', 'Karın', 'Göğüs', 'Ayaklar'] },
        { id: 'allergy', label: 'Yağ, krem veya kokulara alerjiniz (varsa yazın)', type: 'text' },
        { id: 'goal', label: 'Bu seanstan beklentiniz', type: 'multi', options: ['Rahatlama / stres', 'Ağrı azaltma', 'Esneklik', 'Uyku kalitesi', 'Dolaşım', 'Spor sonrası'] }] },
      { title: 'Sağlık Bilgileri', fields: [
        { id: 'health', type: 'yesno', warnOnYes: true, items: ['Düzenli kullandığınız ilaç var mı? (adı ve kullanım amacı)', 'Hamile misiniz? (evetse kaç haftalık, risk durumu)', 'Kronik ağrınız var mı? (neyle artıyor, neyle azalıyor?)', 'Ortopedik yaralanma, kırık veya son 6 ayda ameliyat', 'Şu anda ateş, enfeksiyon veya bulaşıcı hastalık'] },
        { id: 'conditions', label: 'Size uyan durumlar', type: 'multi', options: ['Kanser / kanser tedavisi', 'Baş ağrısı / migren', 'Artrit / romatizma', 'Diyabet', 'Eklem protezi', 'Yüksek / düşük tansiyon', 'Nöropati', 'Fibromiyalji', 'İnme (felç) geçmişi', 'Kalp hastalığı / kalp pili', 'Böbrek rahatsızlığı', 'Kan pıhtısı / tromboz', 'Uyuşma / karıncalanma', 'Burkulma / incinme', 'Varis', 'Bel / boyun fıtığı', 'Cilt hastalığı / açık yara', 'Epilepsi'] },
        { id: 'condNote', label: 'İşaretlediğiniz durumları açıklayın', type: 'textarea' }] },
      { title: 'Vücut Haritası — Masaj Öncesi', fields: [
        { type: 'info', text: 'Önce bir işaret seçin, sonra şekil üzerinde ilgili bölgeye dokunun. Bir işareti silmek için üzerine tekrar dokunun.', muted: true },
        { id: 'mapBefore', type: 'bodymap' }, { id: 'painBefore', label: 'Ağrı şiddeti (öncesi)', type: 'scale' },
        { id: 'painDur', label: 'Ağrının süresi / ne zaman artıyor', type: 'text' }] },
      { title: 'Vücut Haritası — Masaj Sonrası', staffOnly: true, fields: [
        { id: 'mapAfter', type: 'bodymap' }, { id: 'painAfter', label: 'Ağrı şiddeti (sonrası)', type: 'scale' },
        { id: 'feedback', label: 'Danışan geri bildirimi', type: 'radio', options: ['Çok rahatladım', 'Rahatladım', 'Değişiklik yok', 'Ağrı arttı'] },
        { id: 'technique', label: 'Uygulanan teknik / süre / bası', type: 'text' }, { id: 'oil', label: 'Kullanılan yağ / ürün', type: 'text', half: true },
        { id: 'next', label: 'Sonraki seans önerisi', type: 'text', half: true }, { id: 'home', label: 'Evde öneriler', type: 'textarea' }] },
      { title: 'Bilgilendirme', fields: [
        { type: 'info', text: 'Masaj uygulamaları; rahatlama, kas gerginliğinin azaltılması ve kan dolaşımının desteklenmesi amacıyla yapılır. Teknik ve bası tercihlerinize göre ayarlanır. Masaj tıbbi bir tedavi değildir ve doktor tedavisinin yerine geçmez.' },
        { type: 'info', label: 'Olası geçici etkiler', bullets: ['Ertesi gün hafif kas hassasiyeti', 'Yorgunluk veya uyku hâli', 'Kullanılan yağlara karşı nadiren cilt tepkisi'] },
        { type: 'info', label: 'Masajın ertelenmesi gereken durumlar', bullets: ['Ateş, enfeksiyon veya bulaşıcı hastalık', 'Tromboz / damar tıkanıklığı, ileri derece varis', 'Yeni kırık, burkulma veya ameliyat', 'Hamilelik (özel hamile masajı hariç)', 'Doktorunuzun masajı önermediği durumlar'] }] },
      { title: 'Onay ve Sorumluluklar', fields: [{ id: 'consent', type: 'consent', items: [
        'Masajın nasıl yapılacağı ve olası etkileri bana açıklandı; sorularım yanıtlandı.',
        'Masaj sırasında rahatsızlık hissedersem hemen uzmanı bilgilendireceğimi kabul ediyorum.',
        'Masajın tıbbi tedavi yerine geçmediğini ve sonuçların kişiden kişiye değiştiğini anlıyorum.',
        'Sağlık bilgilerimin doğru olduğunu, değişiklik olursa bildireceğimi beyan ederim.',
        'Vücut haritasına kaydedilen bilgilerin seanslarımı planlamak için kullanılmasına izin veriyorum (KVKK).'] }] },
    ],
  },
  assess: {
    title: 'Cilt ve Vücut Değerlendirme Formu', short: 'Değerlendirme', group: 'Uzman formları', sign: false, staffForm: true,
    sections: [
      { title: 'Cilt Fototipi (Fitzpatrick)', fields: [{ id: 'fitz', type: 'radio', vertical: true, options: [
        'I — Çok açık, çilli · her zaman yanar, bronzlaşmaz', 'II — Açık · kolay yanar, zor bronzlaşır', 'III — Açık-buğday · bazen yanar, yavaş bronzlaşır',
        'IV — Buğday-esmer · nadiren yanar, kolay bronzlaşır', 'V — Koyu esmer · çok nadir yanar', 'VI — Çok koyu · hiç yanmaz'] }] },
      { title: 'Cilt Analizi', fields: [
        { id: 'type', label: 'Cilt tipi', type: 'radio', options: ['Normal', 'Kuru', 'Yağlı', 'Karma', 'Hassas'] },
        { id: 'moist', label: 'Nem düzeyi', type: 'radio', options: ['Düşük', 'Normal', 'Yüksek'] },
        { id: 'glogau', label: 'Yaşlanma (Glogau)', type: 'radio', options: ['I – Kırışıklık yok', 'II – Hareketle', 'III – Durağan', 'IV – Yaygın'] },
        { id: 'find', label: 'Bulgular', type: 'rating', options: ['Yok', 'Hafif', 'Orta', 'Yoğun'], items: ['Akne / sivilce', 'Siyah / beyaz nokta', 'Gözenek genişliği', 'Leke / hiperpigmentasyon', 'Kızarıklık / kılcal damar', 'İnce çizgi / kırışıklık', 'Sarkma / elastikiyet kaybı', 'Akne izi', 'Hassasiyet / reaktivite'] }] },
      { title: 'Yüz Haritası', fields: [
        { type: 'info', text: 'Kısaltmalar: A akne · L leke · K kırışıklık · G gözenek · D damar · S sarkma', muted: true },
        { id: 'face', type: 'grid', rows: ['Alın', 'Göz çevresi', 'Burun', 'Dudak çevresi', 'Sağ yanak', 'Sol yanak', 'Çene', 'Boyun / dekolte'], cols: ['Bulgular'] }] },
      { title: 'Vücut Değerlendirmesi ve Ölçümler', fields: [
        { id: 'cell', label: 'Selülit derecesi', type: 'radio', options: ['0', '1', '2', '3'] },
        { id: 'firm', label: 'Cilt sıkılığı', type: 'radio', options: ['İyi', 'Orta', 'Zayıf'] },
        { id: 'edema', label: 'Ödem / su tutulumu', type: 'radio', options: ['Yok', 'Var'] },
        { id: 'meas', label: 'Ölçümler (cm / kg)', type: 'grid', rows: ['Kilo', 'Göğüs altı', 'Bel', 'Göbek', 'Basen', 'Sağ uyluk', 'Sol uyluk', 'Sağ üst kol', 'Sol üst kol'], cols: ['Başlangıç', '4. seans', '8. seans', '12. seans'], num: true },
        { id: 'photos', label: 'Önce / sonra fotoğrafı çekildi', type: 'multi', options: ['Ön', 'Yan', 'Arka', 'Yüz'] }] },
      { title: 'Tedavi Planı', fields: [
        { id: 'goal', label: 'Ana hedef', type: 'text' }, { id: 'program', label: 'Önerilen program', type: 'text', half: true },
        { id: 'freq', label: 'Seans sayısı / aralık', type: 'text', half: true }, { id: 'home', label: 'Evde bakım önerileri', type: 'textarea' },
        { id: 'progress', label: 'Genel ilerleme', type: 'radio', options: ['Beklenenin üzerinde', 'Beklendiği gibi', 'Yavaş', 'Plan revize edilmeli'] },
        { id: 'sat', label: 'Danışan memnuniyeti (1–5)', type: 'radio', options: ['1', '2', '3', '4', '5'] }] },
    ],
  },
};

/* session templates (Seans kaydı) */
export const SESSIONS: Record<string, { name: string; fields: [string, string][] }> = {
  laser: { name: 'Lazer epilasyon', fields: [['bolge', 'Bölge'], ['cihaz', 'Cihaz / dalga boyu'], ['enerji', 'Enerji (J)'], ['spot', 'Spot / puls'], ['tepki', 'Cilt tepkisi']] },
  hifu: { name: 'HIFU', fields: [['bolge', 'Bölge'], ['kartus', 'Kartuş (mm)'], ['enerji', 'Enerji'], ['atis', 'Atış sayısı'], ['tepki', 'Tepki / not']] },
  skin: { name: 'Cilt bakımı / peeling', fields: [['uygulama', 'Uygulama'], ['urun', 'Ürün / asit %'], ['sure', 'Süre'], ['tepki', 'Cilt tepkisi']] },
  massage: { name: 'Masaj', fields: [['tur', 'Masaj türü'], ['sure', 'Süre'], ['basi', 'Bası'], ['odak', 'Odak bölge'], ['agri1', 'Ağrı öncesi (0–10)'], ['agri2', 'Ağrı sonrası (0–10)']] },
  body: { name: 'Vücut / ölçüm', fields: [['islem', 'İşlem'], ['kilo', 'Kilo'], ['bel', 'Bel (cm)'], ['basen', 'Basen (cm)'], ['not', 'Not']] },
  other: { name: 'Diğer işlem', fields: [['islem', 'İşlem'], ['not', 'Not']] },
};

/* Bakım rehberleri */
export const GUIDES: Record<string, { name: string; first: string[]; later: string[]; avoid: string; call: string }> = {
  skin: { name: 'Cilt Bakımı ve Kimyasal Peeling', first: ['Yüzünüzü yalnızca ılık su ve nazik temizleyiciyle yıkayın', 'Makyaj yapmamaya çalışın', 'Önerilen nemlendiriciyi düzenli kullanın', 'Dışarı çıkarken SPF 50 güneş kremi sürün'], later: ['Soyulan cildi koparmayın, kendiliğinden dökülmesini bekleyin', 'Güneş kremini her 2–3 saatte bir yenileyin', 'Bol su için', 'Retinol / asitli ürünlere 5–7 gün ara verin'], avoid: 'Sauna, hamam, havuz, deniz, yoğun spor ve doğrudan güneş (en az 3 gün).', call: 'Şiddetli yanma, kabarcık veya 3 günden uzun süren kızarıklık olursa.' },
  laser: { name: 'Lazer Epilasyon', first: ['Bölgeye aloe vera veya önerilen yatıştırıcı krem sürün', 'Kızarıklık için soğuk (buzsuz) kompres uygulayabilirsiniz', 'Bol, pamuklu kıyafetler tercih edin', 'Bölgeye parfüm / deodorant sürmeyin'], later: ['1–3 hafta içinde kılların dökülmesi normaldir', 'Seanslar arasında yalnızca tıraş kullanın', 'Güneşe çıkacaksanız SPF 50 sürün', 'Bir sonraki seansı aksatmayın'], avoid: 'Güneşlenme, solaryum, sıcak banyo, sauna, havuz ve peeling (en az 48 saat); ağda, cımbız, epilatör (tedavi süresince).', call: 'Su toplaması, kabuklanma veya renk değişikliği fark ederseniz.' },
  hifu: { name: 'HIFU', first: ['Hafif kızarıklık ve şişlik normaldir', 'Bölgeye sert masaj yapmayın', 'Bol su için', 'Nazik temizleyici ve nemlendirici kullanın'], later: ['Sonuçlar 4–12 hafta içinde kademeli belirginleşir', 'Düzenli SPF kullanımı sonuçları korur', 'Kolajen desteği için dengeli beslenin', 'Kontrol randevunuza gelin'], avoid: 'Sauna, hamam, yoğun spor ve alkol (ilk 24 saat); agresif peeling ve lazer (ilk 2 hafta).', call: 'Morarma, uyuşukluk veya hassasiyet 1 haftadan uzun sürerse.' },
  massage: { name: 'Masaj', first: ['Bol su için', 'İlk birkaç saat ağır yemekten kaçının', 'Dinlenin ve vücudunuzu dinleyin', 'Yağın emilmesi için duşu 1–2 saat erteleyin'], later: ['Hafif kas hassasiyeti 1–2 gün içinde geçer', 'Hafif esneme egzersizleri yapın', 'Düzenli masaj etkisini artırır', 'Duruşunuza dikkat edin'], avoid: 'İlk birkaç saat alkol ve yoğun spor.', call: 'Ağrı artarsa veya uyuşma / karıncalanma hissederseniz.' },
  nails: { name: 'Manikür, Pedikür ve Akıllı Ayak Bakımı', first: ['Kalıcı ojede ilk saatlerde çok sıcak su temasını en aza indirin', 'Ayaklarınızı kuru ve temiz tutun', 'Açık veya rahat ayakkabı tercih edin'], later: ['Tırnak eti yağı ve el / ayak kremini her gün kullanın', 'Temizlik yaparken eldiven takın', 'Topuklara haftada 2–3 kez nemlendirici sürün', 'Tırnaklarınızı koparmayın veya kazımayın'], avoid: 'Kalıcı ojeyi zorla sökmek, tırnakları alet gibi kullanmak.', call: 'Kızarıklık, şişlik veya ağrı gibi enfeksiyon belirtileri olursa.' },
};

export const MARKS: [string, string, string][] = [['X', 'Ağrı', '#C0392B'], ['O', 'Gerginlik', '#B7790B'], ['≈', 'Uyuşma', '#3B6FB6'], ['●', 'Dokunulmasın', '#14261A'], ['↻', 'Odak bölge', '#0A7A1E']];
export const VIEWS: [string, string][] = [['on', 'ÖN'], ['arka', 'ARKA'], ['sag', 'SAĞ YAN'], ['sol', 'SOL YAN']];
export const RAMP = ['#DCEFE0', '#DCEFE0', '#E7F2D6', '#F1F1CF', '#F8EDC9', '#FBE4C1', '#FBDABA', '#F8CDB3', '#F4C1AE', '#EFB3A8', '#EAA5A2'];

/* ---------------- yardımcılar ---------------- */
export const FORM_KEYS = Object.keys(FORMS) as FormKey[];
export const isFormKey = (k: string): k is FormKey => k in FORMS;

export type YesNo = Record<string, { a?: "y" | "n"; n?: string }>;
export type Mark = { v: string; x: number; y: number; t: string };
export type FormData = Record<string, unknown>;
export type Signatures = { client?: string; staff?: string };

/** "Evet" denen sağlık / kontrendikasyon maddeleri — kartta ve randevuda uyarı olarak gösterilir. */
export function formFlags(key: FormKey, data: FormData): string[] {
  const out: string[] = [];
  const yes = (field: string, labels: string[]) => {
    const v = (data[field] ?? {}) as YesNo;
    labels.forEach((t, i) => { if (v[i]?.a === "y") out.push(v[i]?.n ? `${t} (${v[i]!.n})` : t); });
  };
  const F = FORMS[key];
  if (key === "intake") { yes("health", HEALTH_SHORT); yes("meds", MED_SHORT); return out; }
  for (const s of F.sections) for (const f of s.fields) {
    if (f.type === "yesno" && f.warnOnYes && f.id && f.items) yes(f.id, f.items);
  }
  if (key === "massage") {
    const cond = (data.conditions ?? []) as number[];
    const opts = F.sections.flatMap((s) => s.fields).find((f) => f.id === "conditions")?.options ?? [];
    cond.forEach((i) => opts[i] && out.push(opts[i]));
  }
  return out;
}

/** Hizmet adına göre gereken onam formu / bakım rehberi */
export function formForService(name: string): FormKey | null {
  const n = name.toLocaleLowerCase("tr-TR");
  if (/lazer|laser|epilasyon/.test(n)) return "laser";
  if (/hifu/.test(n)) return "hifu";
  if (/peel|cilt bak|yüz bak|hydra|dermapen|leke|akne/.test(n)) return "peel";
  if (/masaj|massage|drenaj|terapi/.test(n)) return "massage";
  return null;
}
export function guideForService(name: string): string | null {
  const f = formForService(name);
  if (f === "laser") return "laser";
  if (f === "hifu") return "hifu";
  if (f === "peel") return "skin";
  if (f === "massage") return "massage";
  if (/manik|pedik|ayak|tırnak|oje|nail/.test(name.toLocaleLowerCase("tr-TR"))) return "nails";
  return null;
}

/** Zorunlu alan, onay maddeleri ve imza kontrolü; eksik başlıkları döner. */
export function missingFields(key: FormKey, data: FormData, sig: Signatures, opts: { skipStaff?: boolean } = {}): string[] {
  const F = FORMS[key], errs: string[] = [];
  for (const s of F.sections) {
    if (opts.skipStaff && s.staffOnly) continue;
    for (const f of s.fields) {
      if (!f.id) continue;
      if (f.req && !String(data[f.id] ?? "").trim()) errs.push(f.label ?? f.id);
      if (f.type === "consent" && ((data[f.id] ?? []) as number[]).length < (f.items?.length ?? 0)) errs.push("tüm onay maddeleri");
    }
  }
  if (F.sign && !sig.client) errs.push("danışan imzası");
  return [...new Set(errs)];
}

/** Kabul formundaki isteğe bağlı izinlerin indeksleri */
export const OPTIN_PHOTO = 0, OPTIN_SOCIAL = 1, OPTIN_MARKETING = 2;
