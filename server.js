const express = require('express');
const multer = require('multer');
const zip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

const TEMP_DIR = path.join(__dirname, 'public/sites');
fs.ensureDirSync(TEMP_DIR);

app.use(express.static('public'));
app.use('/view', express.static(TEMP_DIR));

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>مازن هوسط | المطور الذكي</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: white; text-align: center; padding: 20px; }
                .container { background: #1e293b; max-width: 600px; margin: 50px auto; padding: 40px; border-radius: 20px; border: 1px solid #334155; }
                h1 { color: #38bdf8; }
                .upload-box { border: 2px dashed #38bdf8; padding: 30px; border-radius: 15px; margin-top: 20px; }
                button { background: #38bdf8; color: #0f172a; border: none; padding: 15px 30px; font-weight: bold; border-radius: 10px; cursor: pointer; margin-top: 20px; }
                .info { color: #94a3b8; font-size: 0.9em; margin-top: 15px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 مازن هوسط Pro</h1>
                <p>ارفع (ZIP, HTML, JS, JSON, PY) وشغلها فوراً</p>
                <div class="upload-box">
                    <form action="/upload" method="post" enctype="multipart/form-data">
                        <input type="file" name="file" required><br>
                        <button type="submit">رفع وتشغيل الرابط</button>
                    </form>
                </div>
                <p class="info">الرابط شغال 10 دقائق (يتجدد عند الدخول عليه)</p>
            </div>
        </body>
        </html>
    `);
});

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.send("لم يتم اختيار ملف!");

    const siteId = Math.random().toString(36).substring(7);
    const sitePath = path.join(TEMP_DIR, siteId);
    await fs.ensureDir(sitePath);

    try {
        const ext = path.extname(req.file.originalname).toLowerCase();
        let fileName = 'index.html';

        if (ext === '.zip') {
            const zipFile = new zip(req.file.path);
            zipFile.extractAllTo(sitePath, true);
        } else {
            // لو رفع ملف بايثون أو جيسون أو غيره، هيعرضه كملف نصي أو يشغله لو ويب
            fileName = (ext === '.html' || ext === '.htm') ? 'index.html' : req.file.originalname;
            await fs.move(req.file.path, path.join(sitePath, fileName));
        }

        await fs.remove(req.file.path);

        const fullUrl = `${req.get('host')}/view/${siteId}/${fileName}`;
        
        res.send(`
            <body style="background: #0f172a; color: white; text-align: center; padding: 50px; font-family: sans-serif;">
                <h2 style="color: #22c55e;">✅ تم الرفع بنجاح!</h2>
                <p>رابط الملف الخاص بك:</p>
                <a href="https://${fullUrl}" style="color: #38bdf8; font-size: 1.2em;">${fullUrl}</a>
                <p style="color: #94a3b8;">سيتم الحذف بعد 10 دقائق من الخمول</p>
                <button onclick="window.location.href='/'">رفع ملف آخر</button>
            </body>
        `);

        // نظام الحذف الذكي
        const deleteFiles = () => {
            fs.remove(sitePath).catch(err => console.log("Error deleting:", err));
        };
        let timer = setTimeout(deleteFiles, 10 * 60 * 1000);

    } catch (err) {
        res.send("خطأ في معالجة الملف: " + err.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`سيرفر مازن جاهز على بورت ${PORT}`));
