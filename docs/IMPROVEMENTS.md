# Improvements — baad mein karne wale kaam

Internal list, client ko nahi dena. Last updated: 2 November 2026.

Ye wo cheezein hain jo abhi user ko samjhani padti hain (pehle user guide ke "Common questions" mein thi). Inhe app mein hi theek kar dena hai, taaki user ko kuch samjhana na pade.

## User guide ke sawaal → app mein sudhaar

| # | Abhi kya hota hai | Kya sudhaarna hai |
| --- | --- | --- |
| 1 | Jis tab ki permission nahi hai, wo sidebar mein dikhta hi nahi. User ko pata nahi chalta ki access maangna hai. | Kisi page ka link khulne pe "Aapko is page ka access nahi hai, Admin se maangiye" jaisa message. Chahein to "Request access" button. |
| 2 | Check-in ke liye browser location permission chahiye. User ko khud taale wale icon se Location: Allow karna padta hai. GPS kamzor ho to check-in flag ho jaata hai. | Location deny hone pe app mein hi step-by-step help dikhe (Chrome / mobile ke liye). GPS kamzor ho to check-in se pehle warning dikhe. |
| 3 | App kaafi der band rahe to pehli baar server jaagne mein ~1 minute lag jaata hai (Render free plan). Tab tak sirf loader ghoomta hai. | Paid plan ya keep-alive ping. Loader 10 second se zyada chale to "Server shuru ho raha hai, thoda ruke" message. API calls pe ~90 second ka timeout, taaki atka hua loader error dikha de. |
| 4 | Page pe dobara aane pe purana (cache) data turant dikhta hai aur peeche se taaza hota hai. User ko lagta hai data purana hai. | Upar "Updated just now / 2 min ago" chhota sa text, ya window pe wapas aane pe auto-refresh. Zaroori screens pe cache ka time kam. |
| 5 | Popup Cancel, bahar click ya Esc se band hota hai. Popup ke upar popup ho to Esc sirf upar wala band karta hai (ye ho chuka hai). | Bacha kaam: popup ke bahar galti se click hone pe bhara hua form na mite — unsaved form pe "Discard changes?" poochhe. |
| 6 | Excel import ke niyam user ko yaad rakhne padte hain: pehli line mein column naam, date 15/08/1975 jaisi, ek baar mein 2,000 line tak. Doctor import dialog se ye hint aur template hata diye gaye the. | Doctor import mein chhota sa "format dekhiye" link wapas, ya galat column / date wali rows ki list import ke baad download ho sake. |
| 7 | Password badalne ke niyam: kam se kam 8 akshar, ek chhota, ek bada akshar aur ek number. | Profile ke Change password mein niyam pehle se dikhte hain. Yahi niyam reset-link wale page aur Users & Hierarchy ke "Starting password" mein bhi live dikhayein. |
| 8 | Dark mode header ke chand wale button se on hota hai. | Pehli baar system ki theme apne aap lagti hai. Koi kaam nahi; sirf onboarding tip mein bata sakte hain. |
| 9 | Shared computer / phone pe logout bhool gaye to account khula rehta hai. | Kuch der kuch na karne pe (jaise 30 minute) apne aap logout, ya logout se pehle "Is device pe yaad rakhein?" ka option. |

## Is session mein mile pending kaam

- **Doctors — Manager ka access:** Manager ko Doctors page pe Add / Edit / Import ke buttons dikhte hain, par server ye kaam sirf Admin ko karne deta hai. Ya to Manager ko server pe permission dein, ya Manager ke liye buttons chhupayein.
- **Har API request pe login-check bhaari:** `authenticate` middleware har request pe user ko do baar padhta hai, phir permissions padhta hai (3–7 DB queries). Login wala sudhaar yahan bhi lagana hai: ek halki query + `resolveFor(user)`.
- **API timeout:** axios mein koi timeout nahi hai. Server jawab na de to loader bahut der ghoomta hai (upar point 3).
- **Render settings:** API ke Environment mein `BCRYPT_SALT_ROUNDS=12` ho to `10` kar dein ya hata dein. Render service ka region Neon (us-east-2 / Ohio) ke paas ho to har query tez hogi.
- **npm vulnerabilities (server):** zod, multer, morgan, express ke andar `proxy-addr` / `body-parser` / `qs`, aur prisma ka fix maujood hai. `prisma` aur `@prisma/client` ko saath mein 7.10.x pe le jaana hai, phir typecheck aur test.
- **Dashboard charts:** charts pe abhi skeleton (grey patti) hai, JL loader nahi. Zaroorat ho to badal sakte hain.
- **Migrations squash:** dev phase khatam hone pe saari migrations ek fresh baseline mein milaani hain, aur prod ka `_prisma_migrations` naye sire se set karna hai (`server/scripts/db-deploy.cjs` mein baselining pehle se hai).
