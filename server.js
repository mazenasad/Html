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

const queue = async.queue(async (task) => await task(), 1);

app.use(express.static('public'));
app.use(express.json());

// الرابط الرئيسي (الواجهة)
app.get('/', (req, res) => {
    res.send(`
        <body style="background:#020617; color:white; font-family:sans-serif; text-align:center; padding:50px;">
            <div style="border:1px solid #38bdf8; padding:40px; border-radius:20px; display:inline-block; box-shadow:0 0 20px #38bdf844;">
                <h1 style="color:#38bdf8;">🚀 Mazen Pro Hosting</h1>
                <p>استضافة ذكية | رابط مشفر | داشبورد تحكم</p>
                <form action="/upload" method="post" enctype="multipart/form-data">
                    <input type="file" name="files" multiple required style="margin:20px 0;"><br>
                    <button style="padding:15px 30px; background:#38bdf8; border:none; border-radius:10px; cursor:pointer; font-weight:bold; color:#020617;">إطلاق الموقع</button>
                </form>
            </div>
        </body>
    `);
});

// عرض المواقع المرفوعة
app.use('/v', (req, res) => {
    const siteId = req.path.split('/')[1];
    const filePath = path.join(TEMP_DIR, siteId, 'index.html');
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send("<h1>الموقع غير موجود أو انتهت صلاحيته</h1>");
});

// الرفع الأول
app.post('/upload', upload.array('files', 10), async (req, res) => {
    const sites = await fs.readdir(TEMP_DIR);
    if (sites.length >= MAX_SITES) return res.send("السيرفر ممتلئ (50/50)");

    const id = crypto.randomBytes(15).toString('hex'); // رابط طويل 30 حرف
    const token = crypto.randomBytes(16).toString('hex');
    const sitePath = path.join(TEMP_DIR, id);
    
    queue.push(async () => {
        await fs.ensureDir(sitePath);
        for (const file of req.files) {
            if (path.extname(file.originalname) === '.zip') new zip(file.path).extractAllTo(sitePath, true);
            else await fs.move(file.path, path.join(sitePath, file.originalname));
            await fs.remove(file.path);
        }
        await fs.writeFile(path.join(sitePath, '.token'), token);
    }, () => {
        const url = `https://${req.get('host')}/v/${id}`;
        const dash = `https://${req.get('host')}/dashboard/${id}/${token}`;
        res.send(`
            <body style="background:#020617; color:white; text-align:center; padding:50px; font-family:sans-serif;">
                <h2 style="color:#22c55e;">✅ مبروك! موقعك أونلاين</h2>
                <p>الرابط العام (للمشاهدة): <br><a href="${url}" style="color:#38bdf8;">${url}</a></p>
                <div style="background:#1e293b; padding:20px; border-radius:10px; margin-top:20px; border:1px dashed #f59e0b;">
                    <p style="color:#f59e0b;">⚠️ رابط التحكم (سرى لك فقط):</p>
                    <a href="${dash}" style="color:#38bdf8; font-size:0.8em;">${dash}</a>
                </div>
            </body>
        `);
    });
});

// لوحة التحكم (Dashboard)
app.get('/dashboard/:id/:token', async (req, res) => {
    const { id, token } = req.params;
    const sitePath = path.join(TEMP_DIR, id);
    if (!fs.existsSync(sitePath)) return res.send("الموقع غير موجود");
    res.send(`
        <body style="background:#020617; color:white; text-align:center; font-family:sans-serif; padding:50px;">
            <h1>🛠️ لوحة تحكم مازن</h1>
            <div style="border:1px solid #38bdf8; padding:30px; border-radius:15px; display:inline-block;">
                <p>حالة الموقع: شغال ✅</p>
                <button onclick="deleteSite()" style="background:#ef4444; color:white; border:none; padding:10px 20px; cursor:pointer; border-radius:5px;">مسح الموقع نهائياً</button>
            </div>
            <script>
                async function deleteSite() {
                    if(confirm('هل تريد المسح؟')) {
                        await fetch('/delete/${id}/${token}', {method:'DELETE'});
                        window.location.href='/';
                    }
                }
            </script>
        </body>
    `);
});

// مسار المسح
app.delete('/delete/:id/:token', async (req, res) => {
    const { id, token } = req.params;
    const sitePath = path.join(TEMP_DIR, id);
    const savedToken = await fs.readFile(path.join(sitePath, '.token'), 'utf8');
    if (token === savedToken) { await fs.remove(sitePath); res.sendStatus(200); }
    else res.sendStatus(403);
});

app.listen(process.env.PORT || 10000);
