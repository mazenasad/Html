const express = require('express');
const multer = require('multer');
const zip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// إعداد الفولدرات
const TEMP_DIR = path.join(__dirname, 'public/sites');
fs.ensureDirSync(TEMP_DIR);

app.use(express.static('public')); // لتشغيل ملفات الـ HTML والصور
app.use('/view', express.static(TEMP_DIR)); // لعرض مواقع المستخدمين

// الواجهة الرئيسية للموقع (شكل احترافي)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>مازن هوسط | استضافة سريعة</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: white; text-align: center; margin: 0; padding: 20px; }
                .container { background: #1e293b; max-width: 600px; margin: 50px auto; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #334155; }
                h1 { color: #38bdf8; font-size: 2.5em; }
                p { color: #94a3b8; }
                .upload-box { border: 2px dashed #38bdf8; padding: 30px; border-radius: 15px; margin-top: 30px; transition: 0.3s; }
                .upload-box:hover { background: #334155; }
                input[type="file"] { margin-bottom: 20px; }
                button { background: #38bdf8; color: #0f172a; border: none; padding: 15px 30px; font-weight: bold; border-radius: 10px; cursor: pointer; font-size: 1.1em; }
                button:hover { background: #7dd3fc; }
                .footer { margin-top: 40px; font-size: 0.8em; color: #475569; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 مازن هوسط</h1>
                <p>ارفع ملف ZIP واحصل على رابط لموقعك في ثوانٍ!</p>
                <div class="upload-box">
                    <form action="/upload" method="post" enctype="multipart/form-data">
                        <input type="file" name="file" accept=".zip" required><br>
                        <button type="submit">رفع وتشغيل الموقع</button>
                    </form>
                </div>
                <div class="footer">المواقع تُحذف تلقائياً بعد 10 دقائق من الخمول</div>
            </div>
        </body>
        </html>
    `);
});

// نظام معالجة الملفات
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.send("الرجاء اختيار ملف ZIP");

    const siteId = Math.random().toString(36).substring(7);
    const sitePath = path.join(TEMP_DIR, siteId);

    try {
        const zipFile = new zip(req.file.path);
        zipFile.extractAllTo(sitePath, true);
        
        // حذف ملف الـ ZIP الأصلي لتوفير مساحة
        await fs.remove(req.file.path);

        // الرابط الجديد
        const fullUrl = `${req.get('host')}/view/${siteId}/index.html`;
        
        res.send(`
            <body style="background: #0f172a; color: white; text-align: center; font-family: sans-serif; padding: 50px;">
                <h2 style="color: #22c55e;">✅ تم إنشاء موقعك بنجاح!</h2>
                <p>رابط الموقع (صالح لمدة 10 دقائق):</p>
                <a href="http://${fullUrl}" style="color: #38bdf8; font-size: 1.5em;">${fullUrl}</a>
                <br><br>
                <button onclick="window.location.href='/'" style="padding: 10px 20px; cursor:pointer;">الرجوع للخلف</button>
            </body>
        `);

        // نظام الحذف التلقائي بعد 10 دقائق
        setTimeout(async () => {
            await fs.remove(sitePath);
            console.log(`تم حذف الموقع: ${siteId}`);
        }, 10 * 60 * 1000);

    } catch (err) {
        res.send("خطأ في فك ضغط الملف. تأكد أنه ملف ZIP سليم.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`سيرفر مازن جاهز على بورت ${PORT}`));

