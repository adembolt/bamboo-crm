/* Birden çok bölümde geçen anahtarlar için tek, bağlama uyan karşılık (en son uygulanır) */
const d: Record<string, [string, string]> = {
  "Pasif": ["Inactive", "Неактивен"],
  "Diğer": ["Other", "Другое"],
  "{n} seans": ["{n} sessions", "Сеансов: {n}"],
  "{n} hizmet": ["{n} services", "Услуг: {n}"],
  "Ad gerekli.": ["Name is required.", "Укажите имя."],
  "Atanmamış": ["Unassigned", "Не назначен"],
  "{n} açık ziyaret": ["{n} open visits", "Открытых визитов: {n}"],
  "onay bekliyor": ["awaiting confirmation", "не подтверждено"],
  "Ortalama fiş": ["Average bill", "Средний чек"],
  "Müşteri kartı": ["Client card", "Карточка клиента"],
  "{n} puan": ["{n} points", "Баллов: {n}"],
  "Son kullanma": ["Expiry date", "Действует до"],
  "Satış oluşturulamadı": ["Could not create the sale", "Не удалось создать продажу"],
  "Satış": ["Sale", "Продажа"],
  "Kullanım": ["Usage", "Использование"],
  "Adet": ["Qty", "Кол-во"],
  "Kaldır": ["Remove", "Убрать"],
  "Kalanı doldur": ["Fill remaining", "Внести остаток"],
};
export default d;
