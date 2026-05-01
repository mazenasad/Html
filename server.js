const express = require('express');
const multer = require('multer');
const zip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const app = express();
const upload = multer({ dest: 'uploads/' });

const TEMP_DIR = path.join(__dirname, 'public/sites');
const MAX_SITES = 50; // الحد الأقصى الصارم
fs.ensureDirSync(TEMP_DIR);

app.use(express.static('public'));
app.use(express.json());

// واجهة الدخول
app.get('/', async (req, res) => {
    const currentSites = (await fs.readdir(TEMP_DIR)).length;
    const isFull = currentSites >= MAX_SITES;

    res.send(`
        <body style="background:#020617; color:white; font-family:sans-serif; text-align:center; padding:50px;">
            <div style="border:2px solid ${isFull ? '#ef4444' : '#38bdf8'}; padding:40px; border-radius:20px; display:inline-block;">
                <h1 style="color:${isFull ? '#ef4444' : '#38bdf8'};">🚀 Mazen Pro Host</h1>
                <p>عدد المواقع الحالية: ${currentSites} / ${MAX_SITES}</p>
                
                ${isFull ? 
                    `<h2 style="color:#ef4444;">⚠️ لا يوجد مكان في الاستضافة حالياً</h2>
                     <p>انتظر حتى يقوم مستخدم آخر بحذف موقعه</p>` :
                    `<form action="/upload" method="post" enctype="multipart/form-data">
                        <input type="file" name="files" multiple required><br><br>
                        <button style="padding:15px 30px; background:#38bdf8; border:none; border-radius:10px; cursor:pointer; font-weight:bold;">إنشاء موقعك الآن</button>
                    </form>`
                }
            </div>
        </body>
    `);
});

// الرفع مع فحص السعة
app.post('/upload', upload.array('files', 20), async (req, res) => {
    const sites = await fs.readdir(TEMP_DIR);
    if (sites.length >= MAX_SITES) {
        return res.send("<h1>عذراً، الاستضافة ممتلئة تماماً!</h1>");
    }

    const id = crypto.randomBytes(15).toString('hex');
    const token = crypto.randomBytes(16).toString('hex');
    const sitePath = path.join(TEMP_DIR, id);

    try {
        await fs.ensureDir(sitePath);
        for (const file of req.files) {
            if (path.extname(file.originalname) === '.zip') {
                const zipFile = new zip(file.path);
                zipFile.extractAllTo(sitePath, true);
            } else {
                await fs.move(file.path, path.join(sitePath, file.originalname));
            }
            await fs.remove(file.path);
        }
        await fs.writeFile(path.join(sitePath, '.token'), token);

        const url = `https://${req.get('host')}/v/${id}`;
        const dash = `https://${req.get('host')}/dashboard/${id}/${token}`;
        res.send(`<h2>✅ نجح الرفع!</h2><p>موقعك: <a href="${url}">${url}</a></p><p>الداشبورد: <a href="${dash}">${dash}</a></p>`);
    } catch (e) {
        res.send("خطأ في السيرفر");
    }
});

// عرض المواقع
app.use('/v', (req, res) => {
    const siteId = req.path.split('/')[1];
    const sitePath = path.join(TEMP_DIR, siteId);
    const indexFile = path.join(sitePath, 'index.html');
    if (fs.existsSync(indexFile)) res.sendFile(indexFile);
    else res.status(404).send("الموقع غير موجود");
});

// لوحة التحكم والمسح
app.get('/dashboard/:id/:token', (req, res) => {
    const { id, token } = req.params;
    res.send(`
        <body style="background:#020617; color:white; text-align:center; padding:50px;">
            <h1>🛠️ لوحة التحكم</h1>
            <button onclick="del()" style="background:#ef4444; color:white; padding:15px; border:none; border-radius:10px; cursor:pointer;">حذف الموقع نهائياً (لتوفير مكان لغيرك)</button>
            <script>
                async function del() {
                    if(confirm('هل أنت متأكد؟')) {
                        await fetch('/delete/${id}/${token}', {method:'DELETE'});
                        alert('تم الحذف بنجاح!');
                        window.location.href='/';
                    }
                }
            </script>
        </body>
    `);
});

app.delete('/delete/:id/:token', async (req, res) => {
    const { id, token } = req.params;
    const sitePath = path.join(TEMP_DIR, id);
    const tokenPath = path.join(sitePath, '.token');
    
    if (fs.existsSync(tokenPath)) {
        const savedToken = await fs.readFile(tokenPath, 'utf8');
        if (token === savedToken) {
            await fs.remove(sitePath);
            return res.sendStatus(200);
        }
    }
    res.sendStatus(403);
});

app.listen(process.env.PORT || 10000);
