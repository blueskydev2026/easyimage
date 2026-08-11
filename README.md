# ניהול תמונות

אפליקציית ווב מקומית לצפייה וניהול תמונות, עם PWA להתקנה ו-file handlers בדפדפני Chrome/Edge תומכים.

ה־PWA משתמש ב־`manifest.webmanifest` יחיד, כולל אייקונים רגילים ו־maskable, ופועל גם במצב offline לאחר הביקור הראשון. התקנה דורשת HTTPS (או localhost לפיתוח); פתיחה ישירה דרך `file://` אינה ניתנת להתקנה.

מספר הגרסה מוגדר פעם אחת בקובץ `version.js`, מוצג תמיד בפינת המסך ומשמש גם לגרסת ה־cache. בכל שחרור יש לעדכן את `EASYIMAGE_VERSION` לפי Semantic Versioning.

בעת פתיחת האפליקציה מתבצעת בדיקת service worker ללא cache. כשגרסה חדשה מקבלת שליטה, החלון מתרענן פעם אחת אוטומטית כדי להציג את הקבצים המעודכנים.

גם התקנת cache חדש עוקפת במפורש את HTTP cache של הדפדפן. כך גרסה חדשה אינה יכולה לשמור מחדש HTML, CSS או JavaScript ישנים שקיבלה מ-cache זמני של GitHub Pages.

אירוע `beforeinstallprompt` אינו מבוטל, ולכן Edge/Chrome רשאים להציג את הצעת ההתקנה הטבעית שלהם. במקביל האירוע נשמר לשימוש בכפתור "התקנה כאפליקציה" שבתוך הממשק.

## התקנה כמו daily-pdf-reader

כדי שהדפדפן יציע התקנה באופן טבעי, האפליקציה צריכה להיפתח מכתובת HTTPS, למשל GitHub Pages:

```text
https://blueskydev2026.github.io/easyimage/
```

הריפו כולל workflow בשם `Deploy PWA` שמפרסם את `dist/web-app` ל-GitHub Pages.

אחרי שהאתר פורסם:

1. פותחים את כתובת GitHub Pages ב-Chrome או Edge.
2. הדפדפן אמור להציג אפשרות התקנה בשורת הכתובת או דרך תפריט הדפדפן.
3. אחרי ההתקנה אפשר לבחור את האפליקציה ידנית ב-Windows תחת Settings > Apps > Default apps.

פתיחה ישירה של `index.html` מכונן מקומי אינה מאפשרת התקנת PWA אמיתית.
