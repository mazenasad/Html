const express = require('express');
const multer = require('multer');
const zip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const async = require('async');

const app = express();
const upload = multer({ dest: 'uploads/' });

const TEMP_DIR = path.join(__dirname, 'public/sites');
const MAX_SITES = 50;
fs.ensureDirSync(TEMP_DIR);

// طابور معالجة ذكي لحماية الـ CPU
const queue = async.queue(async (task) => await task(), 1);

app.use(express.static('public'));
app.use(express.json());

// عرض الموقع المرفوع
app.use('/v', (req, res) => {
    const siteId = req.path.split('/')[1];
    const filePath = path.join(TEMP_DIR, siteId, 'index.html');
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send("<h1>الموقع غير موجود</h1>");
});

// واجهة التحكم (Dashboard)
app.get('/dashboard/:id/:token', async (req, res) => {
    const { id, token } = req.params;
    const sitePath = path.join(TEMP_DIR, id);
    if (!fs.existsSync(sitePath)) return res.send("انتهت صلاحية الموقع");

    res.send(`
        <body style="background:#020617; color:white; font-family:sans-serif; text-align:center; padding:50px;">
            <h1>🛠️ لوحة تحكم موقعك</h1>
            <p>ID: ${id}</p>
            <div style="border:1px solid #38bdf8; padding:20px; border-radius:15px; display:inline-block;">
                <button onclick="deleteSite()" style="background:#ef4444; color:white; border:none; padding:10px 20px; cursor:pointer; border-radius:5px;">🗑️ مسح الموقع</button>
                <hr style="border:0.5px solid #334155; margin:20px 0;">
                <h3>تحديث الموقع (رفع ملفات جديدة)</h3>
                <form action="/update/${id}/${token}" method="post" enctype="multipart/form-data">
                    <input type="file" name="files" multiple required><br><br>
                    <button style="background:#38bdf8; color:black; border:none; padding:10px 20px; cursor:pointer; border-radius:5px;">🔄 تحديث الآن</button>
                </form>
            </div>
            <script>
                async function deleteSite() {
                    if(confirm('هل أنت متأكد؟')) {
                        const res = await fetch('/delete/${id}/${token}', {method:'DELETE'});
                        if(res.ok) { alert('تم المسح'); window.location.href='/'; }
                    }
                }
            </script>
        </body>
    `);
});

// مسار الرفع الأول وتوليد الـ Token
app.post('/upload', upload.array('files', 10), async (req, res) => {
    const sites = await fs.readdir(TEMP_DIR);
    if (sites.length >= MAX_SITES) return res.send("السيرفر ممتلئ");

    const id = crypto.randomBytes(10).toString('hex');
    const token = crypto.randomBytes(16).toString('hex');
    const sitePath = path.join(TEMP_DIR, id);
    
    queue.push(async () => {
        await fs.ensureDir(sitePath);
        for (const file of req.files) {
            if (path.extname(file.originalname) === '.zip') new zip(file.path).extractAllTo(sitePath, true);
            else await fs.move(file.path, path.join(sitePath, file.originalname));
            await fs.remove(file.path);
        }
        // حفظ التوكن في ملف مخفي داخل فولدر الموقع
        await fs.writeFile(path.join(sitePath, '.token'), token);
    }, () => {
        const url = `https://${req.get('host')}/v/${id}`;
        const dash = `https://${req.get('host')}/dashboard/${id}/${token}`;
        res.send(`<h2>✅ نجح الرفع</h2><p>رابط الموقع: <a href="${url}">${url}</a></p><p>رابط التحكم (لا تشاركه!): <a href="${dash}">${dash}</a></p>`);
    });
});

// مسار التحديث
app.post('/update/:id/:token', upload.array('files', 10), async (req, res) => {
    const { id, token } = req.params;
    const sitePath = path.join(TEMP_DIR, id);
    const savedToken = await fs.readFile(path.join(sitePath, '.token'), 'utf8');

    if (token !== savedToken) return res.status(403).send("خطأ في المفتاح!");

    queue.push(async () => {
        // مسح القديم ووضع الجديد للتحديث اللحظي
        const files = await fs.readdir(sitePath);
        for (const f of files) if(f !== '.token') await fs.remove(path.join(sitePath, f));
        
        for (const file of req.files) {
            if (path.extname(file.originalname) === '.zip') new zip(file.path).extractAllTo(sitePath, true);
            else await fs.move(file.path, path.join(sitePath, file.originalname));
            await fs.remove(file.path);
        }
    }, () => res.redirect(`/dashboard/${id}/${token}`));
});

// مسار المسح
app.delete('/delete/:id/:token', async (req, res) => {
    const { id, token } = req.params;
    const sitePath = path.join(TEMP_DIR, id);
    const savedToken = await fs.readFile(path.join(sitePath, '.token'), 'utf8');
    if (token === savedToken) {
        await fs.remove(sitePath);
        res.sendStatus(200);
    } else res.sendStatus(403);
});

app.listen(process.env.PORT || 10000);
