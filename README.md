# AI Tartalom Elemző / Javítóasztal

Magyarázható AI-stíluselemző dokumentum-műhely. A rendszer nem állítja biztosan, hogy egy szöveget AI írt: nyelvi mintázatokat, kockázati jeleket és bizonytalanságot mutat.

## V2 funkciók
- TXT és DOCX bevitel
- bekezdésenkénti kockázattérkép
- indokolt AI-szerűségi jelzések
- bizonyossági szint a szöveghossz alapján
- Javítóasztal javítási irányokkal
- opcionális saját stílusprofil
- helyi projektmentés
- automatikus korábbi verziók (max. 12)
- működő DOCX export
- betűtípus, méret, sorköz és margó beállítás
- mobil/iPad optimalizált dark tech felület

## Adatkezelés
A V2 projektmentése és stílusprofilja böngésző-localStorage alapú, ezért ezen az eszközön marad. A felhőszinkron későbbi fázis.

## Fontos
A pontszám nem szerzőségi bizonyíték, és önmagában nem alkalmas oktatási szankció vagy plágiumdöntés meghozatalára.

## Deployment
GitHub main → Vercel automatikus deploy. A fejlesztés idején a Vercel build-rate limit miatt a kód GitHubon gyűlik, és a következő elérhető buildablakban egyben kerül productionbe.

## Rollback
A fejlesztés előtti állapot: `backup/v1-initial` branch.


<!-- redeploy-trigger: 2026-10-06 -->
