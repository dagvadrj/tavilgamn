# Google, Apple болон удирдлагын бүртгэл

`/login`, `/register`, `/auth/callback` нь дэлгүүрийн header/footer-гүй тусдаа
нэвтрэх орчинтой. Merchant-ийн бүртгэл `/merchant?tab=profile`, admin-ийнх
`/admin?tab=profile` дээр нээгдэнэ. `/account` нь худалдан авалт, хадгалсан
өрөөний загвар, захиалгын хэрэглэгчийн хэсэг хэвээр.

Энгийн нэвтрэлтийн дараа `profiles.role`-оос эрхийг шалгаж merchant-ийг
`/merchant`, admin-ийг `/admin`, бусад хэрэглэгчийг `/account` руу оруулна.
Checkout болон зөвшөөрсөн dashboard tab-ын `next` чиглэлийг хадгалдаг.
Google/Apple бүртгэл үүсгэх нь удирдлагын эрх автоматаар олгохгүй.

## Supabase provider тохиргоо

Provider-ийн нууц түлхүүрүүдийг Supabase Dashboard дээр оруулна.
`NEXT_PUBLIC_*` хувьсагч болон repository-д нууц түлхүүр нэмж болохгүй.

1. Authentication → URL Configuration хэсэгт production Site URL-ээ тохируулна.
2. Redirect URLs-д `https://<site>/auth/callback` болон
   `https://<site>/auth/callback?next=*` нэмнэ. Хөгжүүлэлтийн үед
   `http://localhost:3000/auth/callback` ба
   `http://localhost:3000/auth/callback?next=*` нэмнэ.
3. Имэйл баталгаажуулалтын одоогийн `/login?next=*` redirect-ийг мөн зөвшөөрнө.

### Google

Google Cloud-д Web application OAuth client үүсгэж Client ID, Client Secret-ийг
Supabase Authentication → Sign In / Providers → Google хэсэгт оруулаад идэвхжүүлнэ.
Google-ийн Authorized redirect URI нь **Supabase-ийн callback**:
`https://<project-ref>.supabase.co/auth/v1/callback`.
Authorized JavaScript origins-д сайтын production origin болон хэрэгтэй бол
`http://localhost:3000` нэмнэ.

[Албан ёсны Google/Supabase заавар](https://supabase.com/docs/guides/auth/social-login/auth-google)

### Apple

Apple Developer дээр Sign in with Apple идэвхтэй App ID, түүнд холбосон Services
ID болон signing key үүсгэнэ. Website domain ба Return URL-ийг тохируулж Return
URL-д Supabase-ийн `https://<project-ref>.supabase.co/auth/v1/callback`-ийг ашиглана.
Services ID болон signing key-ээр үүсгэсэн client secret-ийг Supabase Apple
provider хэсэгт оруулаад идэвхжүүлнэ. OAuth client secret-ийг 6 сар тутам шинэчилнэ.

Apple-ийн web OAuth-аар нэр үргэлж ирдэггүй. Dashboard-ийн “Миний бүртгэл” хэсэгт
хэрэглэгч нэрээ оруулж хадгалж болно.

[Албан ёсны Apple/Supabase заавар](https://supabase.com/docs/guides/auth/social-login/auth-apple)

## Нэвтрэлтийн ажиллагаа ба шалгалт

Одоогийн Supabase browser client нь implicit OAuth redirect-ийн session-ийг SDK-аар
авч хадгална. Callback хуудас shared auth initialization дууссаны дараа DB-ийн эрхийг
шалган чиглүүлнэ. API-ууд bearer token-ийг сервер дээр баталгаажуулсаар байна.
Provider идэвхгүй үед товчийг дарахад энэ тухай Монгол тайлбар харуулж имэйлээр
нэвтрэх боломжийг үлдээнэ. Цуцалсан/хугацаа дууссан callback-аас дахин оролдож болно.

Идэвхжүүлсний дараа production дээр Google, Apple тус бүрээр шинэ болон хуучин
бүртгэлээр нэвтрэх, цуцлах, checkout руу буцах, merchant/admin эрхтэй бүртгэлийг
зөв самбарт оруулахыг бодитоор шалгана. Ижил имэйлтэй account linking behavior нь
Supabase-ийн identity linking тохиргооноос хамаарна.

2026-10-10-ны public Auth settings шалгалтаар Google, Apple хоёулаа идэвхгүй байсан.
Кодын mock шалгалт нь provider-ийн бодит credentials болон live нэвтрэлтийг орлохгүй.
