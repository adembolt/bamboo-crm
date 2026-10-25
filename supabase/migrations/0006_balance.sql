-- Müşteri ön ödeme bakiyesi (balans)
alter type public.pay_method add value if not exists 'balance';
