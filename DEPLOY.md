# Ластівка — деплой в хмару (база даних)

Після деплою всі користувачі підключаються до одного сервера — можна одразу знайти інших у пошуку.

## 1. Безкоштовна база даних (Neon)

1. Зайдіть на https://neon.tech
2. Зареєструйтесь (GitHub)
3. Створіть **New Project** → **Create**
4. Скопіюйте **Connection string** (PostgreSQL)

## 2. Деплой на Render

1. Зайдіть на https://render.com
2. Зареєструйтесь (GitHub)
3. **New** → **Web Service**
4. Підключіть репозиторій з Ластівкою (або завантажте через GitHub)
5. Налаштування:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server/index.js`
   - **Environment** → додайте змінну:
     - **Key:** `DATABASE_URL`
     - **Value:** вставте connection string з Neon

6. **Create Web Service**

7. Після деплою отримаєте URL, наприклад: `https://lastivka-xxx.onrender.com`

## 3. Використання

- Відкрийте браузер на будь-якому ПК
- Введіть URL: `https://ВАШ-URL.onrender.com`
- Зареєструйтесь — всі користувачі побачать одне одного в пошуку

## 4. Локально з хмарною базою (найпростіше для 2+ ПК)

1. Створіть базу на Neon (крок 1 вище), скопіюйте connection string
2. У папці Swallow створіть файл **neon-db.txt** з одним рядком — вашим connection string
3. Скопіюйте цей файл **на обидва ПК** у папку Swallow
4. Запустіть **run-Lastivka.ps1** на обох ПК

Готово. Обидва ПК використовують одну базу — користувачі з’являться в пошуку.

(Файл neon-db.txt.example показує приклад — скопіюйте його в neon-db.txt і вставте свій рядок)
