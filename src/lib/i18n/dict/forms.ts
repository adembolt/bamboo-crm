/* Danışan formları, seans kayıtları, bakım rehberleri (form içerikleri src/lib/forms/i18n.ts'ten gelir) */
import { FORM_TX } from "@/lib/forms/i18n";

const ui: Record<string, [string, string]> = {
  "Danışan bekleniyor": ["Waiting for client", "Ожидаем клиента"],
  "Danışan imzalı": ["Signed by client", "Подписано клиентом"],
  "Form kaydedildi.": ["Form saved.", "Анкета сохранена."],
  "Merhaba {ad}, randevunuzdan önce formu buradan doldurup imzalayabilirsiniz: {link}": ["Hello {ad}, you can fill in and sign the form here before your appointment: {link}", "Здравствуйте, {ad}! Перед визитом вы можете заполнить и подписать анкету здесь: {link}"],
  "Bu form danışanın kendi telefonundan doldurulacak. Bağlantıyı WhatsApp ile gönderin; doldurduğunda burada imzalı olarak görünür.": ["The client will fill in this form on their own phone. Send the link via WhatsApp; once filled in it appears here as signed.", "Клиент заполнит анкету на своём телефоне. Отправьте ссылку в WhatsApp; после заполнения она появится здесь как подписанная."],
  "Bağlantı iptal edilsin mi?": ["Cancel this link?", "Отменить ссылку?"],
  "İptal et": ["Cancel", "Отменить"],
  "Yazdır / PDF": ["Print / PDF", "Печать / PDF"],
  "Salon bölümünü doldur": ["Fill in salon section", "Заполнить раздел салона"],
  "Bu form kalıcı olarak silinsin mi?": ["Delete this form permanently?", "Удалить анкету безвозвратно?"],
  "Formu sil": ["Delete form", "Удалить анкету"],
  "Danışan beyanı imzalandıktan sonra değiştirilemez. Değişiklik gerekiyorsa yeni form doldurun.": ["The client's declaration cannot be changed after signing. Fill in a new form if changes are needed.", "После подписи заявление клиента изменить нельзя. При необходимости заполните новую анкету."],
  "Salon bölümünü kaydet": ["Save salon section", "Сохранить раздел салона"],
  "Formu danışanla birlikte doldurun; “uzman doldurur” bölümleri salon içindir. Tableti danışana verebilirsiniz.": ["Fill in the form together with the client; “filled in by specialist” sections are for the salon. You can hand the tablet to the client.", "Заполняйте анкету вместе с клиентом; разделы «заполняет специалист» — для салона. Можно передать планшет клиенту."],
  "Formlar ve sağlık": ["Forms & health", "Анкеты и здоровье"],
  "{n} form · {s} seans": ["{n} forms · {s} sessions", "{n} анкет · {s} сеансов"],
  "Bu danışanın kabul formu yok. İlk ziyarette doldurulması önerilir.": ["This client has no intake form. It should be filled in on the first visit.", "У клиента нет анкеты. Рекомендуется заполнить при первом визите."],
  "imzalı": ["signed", "подписано"],
  "kayıtlı": ["saved", "сохранено"],
  "Danışana bağlantı gönder": ["Send link to client", "Отправить ссылку клиенту"],
  "Seans kaydı": ["Session record", "Запись сеанса"],
  "Bakım rehberi ver": ["Give aftercare guide", "Выдать памятку по уходу"],
  "bekleniyor": ["pending", "ожидается"],
  "Seans kaydı silinsin mi?": ["Delete this session record?", "Удалить запись сеанса?"],
  "Verilen bakım rehberleri": ["Aftercare guides given", "Выданные памятки"],
  "Danışan formu kendi telefonundan doldurup imzalar (otel, yat, ön kayıt). Mesaj otomatik gönderilmez; WhatsApp'ı siz açarsınız.": ["The client fills in and signs on their own phone (hotel, yacht, pre-registration). Nothing is sent automatically; you open WhatsApp yourself.", "Клиент заполняет и подписывает на своём телефоне (отель, яхта, предварительная запись). Ничего не отправляется автоматически — WhatsApp открываете вы."],
  "Form": ["Form", "Анкета"],
  "Bağlantı oluştur": ["Create link", "Создать ссылку"],
  "İşlem türü": ["Treatment type", "Вид процедуры"],
  "Rehber": ["Guide", "Памятка"],
  "Karta işlendi": ["Recorded on card", "Записано в карту"],
  "{f} eksik — doldur": ["{f} missing — fill in", "{f} нет — заполнить"],
  "{f}: danışan bekleniyor": ["{f}: waiting for client", "{f}: ожидаем клиента"],
};

const content: Record<string, [string, string]> = {};
for (const [tr, en] of Object.entries(FORM_TX.en)) content[tr] = [en, FORM_TX.ru[tr] ?? en];

const d: Record<string, [string, string]> = { ...content, ...ui };
export default d;
