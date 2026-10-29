export type Lang = "tr" | "en" | "ru";
export const LANGS: Lang[] = ["tr", "en", "ru"];

const dict = {
  tr: {
    title: "Online Randevu",
    subtitle: "Bamboo Beauty Lifes · Beauty & Wellness · Marmaris",
    stepService: "Hizmet", stepStaff: "Uzman", stepTime: "Tarih & saat", stepDetails: "Bilgiler", stepDone: "Tamam",
    search: "Hizmet ara…", allCategories: "Tüm kategoriler", min: "dk",
    anyStaff: "Fark etmez", anyStaffHint: "Müsait olan ilk uzman",
    pickDate: "Tarih seçin", noSlots: "Bu gün için uygun saat yok.", loading: "Yükleniyor…",
    firstName: "Ad", lastName: "Soyad", phone: "Telefon", email: "E-posta (isteğe bağlı)", notes: "Not (isteğe bağlı)",
    consent: "Randevu hatırlatmaları için WhatsApp/SMS ile iletişime geçilmesini kabul ediyorum.",
    back: "Geri", next: "Devam", submit: "Randevu talebi gönder", sending: "Gönderiliyor…",
    summary: "Özet", total: "Fiyat",
    doneTitle: "Talebiniz alındı",
    doneApproval: "Salonumuz randevunuzu kısa süre içinde onaylayıp WhatsApp üzerinden bilgilendirecek.",
    doneConfirmed: "Randevunuz oluşturuldu. Sizi bekliyoruz!",
    newBooking: "Yeni randevu",
    closed: "Online randevu şu anda kapalı. Lütfen WhatsApp üzerinden yazın.",
    errPhone: "Geçerli bir telefon girin.", errName: "Adınızı girin.", errSlot: "Bu saat az önce doldu, lütfen başka bir saat seçin.", errGeneric: "Bir hata oluştu, lütfen tekrar deneyin.",
    weekdays: ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"],
    whatsapp: "WhatsApp ile yazın",
    duration: "Süre",
  },
  en: {
    title: "Online Booking",
    subtitle: "Bamboo Beauty Lifes · Beauty & Wellness · Marmaris",
    stepService: "Service", stepStaff: "Specialist", stepTime: "Date & time", stepDetails: "Your details", stepDone: "Done",
    search: "Search services…", allCategories: "All categories", min: "min",
    anyStaff: "No preference", anyStaffHint: "First available specialist",
    pickDate: "Choose a date", noSlots: "No available times on this day.", loading: "Loading…",
    firstName: "First name", lastName: "Last name", phone: "Phone", email: "Email (optional)", notes: "Note (optional)",
    consent: "I agree to be contacted via WhatsApp/SMS for appointment reminders.",
    back: "Back", next: "Continue", submit: "Send booking request", sending: "Sending…",
    summary: "Summary", total: "Price",
    doneTitle: "Request received",
    doneApproval: "Our beauty salon will confirm your appointment shortly and let you know via WhatsApp.",
    doneConfirmed: "Your appointment is booked. See you soon!",
    newBooking: "New booking",
    closed: "Online booking is currently closed. Please message us on WhatsApp.",
    errPhone: "Enter a valid phone number.", errName: "Enter your name.", errSlot: "This time slot has just been taken. Please choose another one.", errGeneric: "Something went wrong. Please try again.",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    whatsapp: "Message us on WhatsApp",
    duration: "Duration",
  },
  ru: {
    title: "Онлайн-запись",
    subtitle: "Bamboo Beauty Lifes · Beauty & Wellness · Мармарис",
    stepService: "Услуга", stepStaff: "Специалист", stepTime: "Дата и время", stepDetails: "Ваши данные", stepDone: "Готово",
    search: "Поиск услуг…", allCategories: "Все категории", min: "мин",
    anyStaff: "Не важно", anyStaffHint: "Первый свободный специалист",
    pickDate: "Выберите дату", noSlots: "На этот день свободного времени нет.", loading: "Загрузка…",
    firstName: "Имя", lastName: "Фамилия", phone: "Телефон", email: "Email (необязательно)", notes: "Комментарий (необязательно)",
    consent: "Я согласен(-на) получать напоминания о записи через WhatsApp/SMS.",
    back: "Назад", next: "Далее", submit: "Отправить заявку", sending: "Отправка…",
    summary: "Сводка", total: "Стоимость",
    doneTitle: "Заявка получена",
    doneApproval: "Наш салон красоты подтвердит запись в ближайшее время и сообщит вам об этом в WhatsApp.",
    doneConfirmed: "Вы записаны. Ждём вас!",
    newBooking: "Новая запись",
    closed: "Онлайн-запись сейчас недоступна. Пожалуйста, напишите нам в WhatsApp.",
    errPhone: "Введите корректный номер телефона.", errName: "Введите имя.", errSlot: "Это время только что заняли, выберите другое.", errGeneric: "Произошла ошибка, попробуйте ещё раз.",
    weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    whatsapp: "Написать в WhatsApp",
    duration: "Длительность",
  },
} satisfies Record<Lang, Record<string, string | string[]>>;

export type Dict = (typeof dict)["tr"];
export function t(lang: Lang): Dict {
  return (dict[lang] ?? dict.tr) as Dict;
}

export function pickName(row: { name_tr: string; name_en?: string; name_ru?: string }, lang: Lang) {
  if (lang === "en" && row.name_en) return row.name_en;
  if (lang === "ru" && row.name_ru) return row.name_ru;
  return row.name_tr || row.name_en || "";
}

export function normalizeLang(v: string | undefined | null): Lang {
  return (LANGS as string[]).includes(v ?? "") ? (v as Lang) : "tr";
}
