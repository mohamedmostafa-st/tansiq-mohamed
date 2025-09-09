// ---------------- Helpers ----------------
const mobileDigits = /\d+/g;
function normalizeEgMobile(val){
  if(val===undefined||val===null) return '';
  let s = String(val);
  let digits = (s.match(mobileDigits)||[]).join('');
  if(!digits) return '';
  if(digits.startsWith('0020')) digits = '0'+digits.slice(4);
  else if(digits.startsWith('20') && digits.length>=12) digits = '0'+digits.slice(2);
  if(digits.startsWith('0') && digits.length>11) digits = digits.slice(-11);
  if(digits.length===10 && digits.startsWith('1')) digits = '0'+digits;
  return digits;
}

const CITY_TO_GOV = {
  'Cairo':'القاهرة','Giza':'الجيزة','Alexandria':'الإسكندرية','El Kalioubia':'القليوبية','Qalyubia':'القليوبية','Al Qalyubia':'القليوبية','Kaliobeya':'القليوبية','Kalyoubia':'القليوبية',
  'Damietta':'دمياط','Domiatta':'دمياط','Dakahlia':'الدقهلية','Sharqia':'الشرقية','Gharbia':'الغربية','Monufia':'المنوفية','Menoufia':'المنوفية','Kafr El Sheikh':'كفر الشيخ','Beheira':'البحيرة',
  'Port Said':'بورسعيد','Ismailia':'الإسماعيلية','Suez':'السويس','North Sinai':'شمال سيناء','South Sinai':'جنوب سيناء','Red Sea':'البحر الأحمر',
  'Beni Suef':'بني سويف','Fayoum':'الفيوم','Minya':'المنيا','Assiut':'أسيوط','Sohag':'سوهاج','Qena':'قنا','Luxor':'الأقصر','Aswan':'أسوان','New Valley':'الوادي الجديد',
  'Banha':'القليوبية','Tanta':'الغربية','Zagazig':'الشرقية','Mansoura':'الدقهلية','Mahalla':'الغربية','Kafr El-Dawar':'البحيرة','6th of October City':'الجيزة'
};

const ADDR_KW_TO_GOV = {
  'القاهرة':'القاهرة','مدينة نصر':'القاهرة','الجيزة':'الجيزة','اكتوبر':'الجيزة','٦ اكتوبر':'الجيزة','اوسيم':'الجيزة','الاسكندرية':'الإسكندرية','اسكندرية':'الإسكندرية',
  'القليوبية':'القليوبية','بنها':'القليوبية','شبرا الخيمة':'القليوبية','قليوب':'القليوبية','الخانكة':'القليوبية','دمياط':'دمياط','المنصورة':'الدقهلية','الدقهلية':'الدقهلية',
  'الشرقية':'الشرقية','الزقازيق':'الشرقية','الغربية':'الغربية','طنطا':'الغربية','المحلة':'الغربية','المنوفية':'المنوفية','شبين الكوم':'المنوفية','كفر الشيخ':'كفر الشيخ','البحيرة':'البحيرة',
  'بورسعيد':'بورسعيد','الاسماعيلية':'الإسماعيلية','الإسماعيلية':'الإسماعيلية','السويس':'السويس','شمال سيناء':'شمال سيناء','جنوب سيناء':'جنوب سيناء','البحر الأحمر':'البحر الأحمر',
  'بني سويف':'بني سويف','الفيوم':'الفيوم','المنيا':'المنيا','أسيوط':'أسيوط','اسيوط':'أسيوط','سوهاج':'سوهاج','قنا':'قنا','الأقصر':'الأقصر','الاقصر':'الأقصر','أسوان':'أسوان','اسوان':'أسوان',
  'الوادي الجديد':'الوادي الجديد','مطروح':'مطروح'
};

const PRODUCT_ALIAS_RULES = [
  [/nail\s*lotion/i, 'سيرم الأظافر'],
  [/lash\s*serum/i, 'سيرم الرموش والحواجب'],
  [/(رموش|حواجب)/, 'سيرم الرموش والحواجب'],
  [/(ضوافر|اظافر|أظافر)/, 'سيرم الأظافر'],
  [/(زيت)/, 'زيت شعر'],
];

function normalizeProductName(name){
  let base = String(name||'').trim();
  if(!base || base.toLowerCase()==='nan') return '';
  base = base.replace(/[\s\u200f\u200e]+/g,' ').trim();
  for(const [patt,repl] of PRODUCT_ALIAS_RULES){
    if(patt.test(base)) return repl;
  }
  return base;
}

function parseDescription(desc){
  if(desc===undefined || desc===null || String(desc).trim()==='') return [];
  const parts = String(desc).split(/[+،,]+/);
  const items = [];
  for(let p of parts){
    p = p.trim(); if(!p) continue;
    const m = p.match(/[xX]\s*(\d+)/);
    const qty = m? parseInt(m[1],10): 1;
    const pClean = p.replace(/[xX]\s*\d+/,'').replace('×','').replace('*','').trim();
    const name = normalizeProductName(pClean);
    if(name) items.push([name, qty]);
  }
  const agg = {};
  for(const [n,q] of items){ agg[n] = (agg[n]||0)+q; }
  return Object.entries(agg); // [ [name, qty], ... ]
}

function firstArabicToken(name){
  const s = String(name||'').trim();
  if(!s) return '';
  return s.split(/\s+/)[0];
}

function findFirstCol(headers, candidates){
  // exact
  for(const c of candidates){ if(headers.includes(c)) return c; }
  // case-insensitive
  const lowerMap = Object.fromEntries(headers.map(h=>[String(h).trim().toLowerCase(), h]));
  for(const c of candidates){ const key = String(c).trim().toLowerCase(); if(lowerMap[key]) return lowerMap[key]; }
  return null;
}

function extractGovernorate(row){
  const city = String(row['DropOff City']||'').trim();
  if(CITY_TO_GOV[city]) return CITY_TO_GOV[city];
  const addr = [row['DropOff First Line']||'', row['DropOff City']||'', row['Address']||''].join(' ');
  for(const [kw,g] of Object.entries(ADDR_KW_TO_GOV)){
    if(addr.includes(kw)) return g;
  }
  return '';
}

function transformSheet(json){
  const headers = Object.keys(json[0]||{});
  const nameCol = findFirstCol(headers, ['Consignee Name','Customer Name','الاسم']);
  const phoneCol = findFirstCol(headers, ['Consignee phone','Phone','Mobile','رقم الهاتف','الموبايل']);
  const addrCol  = findFirstCol(headers, ['DropOff First Line','Address','العنوان']);
  const cityCol  = findFirstCol(headers, ['DropOff City','City','المدينة']);
  const codCol   = findFirstCol(headers, ['Cod Amount','COD','Amount','المبلغ','التوتال']);
  const notesCol = findFirstCol(headers, ['Notes','ملاحظات','ملاحظات الشحن']);
  const descCol  = findFirstCol(headers, ['Description','Products','المنتجات']);
  const orderCol = findFirstCol(headers, ['Business Reference Number','Order Number','رقم الأوردر']);

  const out = [];
  for(const r of json){
    const name = nameCol? r[nameCol]: '';
    const phone1 = phoneCol? normalizeEgMobile(r[phoneCol]): '';
    const address = addrCol? String(r[addrCol]||'').trim(): '';

    const viewRow = {
      'DropOff City': cityCol? r[cityCol]: '',
      'DropOff First Line': address,
      'Address': r['Address']||''
    };
    const gov = extractGovernorate(viewRow);

    const items = descCol? parseDescription(r[descCol]): [];
    const productsStr = items.length? items.map(([n,q])=>`${n} X ${q}`).join(' + '): '';
    const qtySum = items.reduce((a,[,q])=>a+q,0);
    const totalPrice = codCol? (r[codCol]||0): 0;
    let notes = notesCol? (r[notesCol]||''): '';
    notes = String(notes).replace('الشحن مجاني','').replace('شحن مجاني','').trim();
    let orderNum = orderCol? (r[orderCol]||''): '';
    if(!orderNum && 'Tracking Number' in r) orderNum = r['Tracking Number'];

    out.push({
      'الاسم': name || '',
      'رقم الهاتف': phone1 || '',
      'الرقم التاني': '',
      'العنوان': address || '',
      'المحافظة': gov || '',
      'المنتجات': productsStr || '',
      'عدد القطع': qtySum || 0,
      'التوتال': Number(totalPrice)||0,
      'ملاحظات الشحن': notes || '',
      'رقم الأوردر (إن وجد)': orderNum || ''
    });
  }

  // merge by order if present
  const ordCol = 'رقم الأوردر (إن وجد)';
  const hasOrder = out.some(r=> String(r[ordCol]||'').trim() !== '');
  if(hasOrder){
    const map = new Map();
    const firstNonEmpty = (a,b)=> a && String(a).trim()!=='' ? a : (b||'');
    for(const r of out){
      const key = String(r[ordCol]||'');
      if(!map.has(key)) map.set(key, {...r});
      else {
        const prev = map.get(key);
        prev['الاسم'] = firstNonEmpty(prev['الاسم'], r['الاسم']);
        prev['رقم الهاتف'] = firstNonEmpty(prev['رقم الهاتف'], r['رقم الهاتف']);
        prev['الرقم التاني'] = firstNonEmpty(prev['الرقم التاني'], r['الرقم التاني']);
        prev['العنوان'] = firstNonEmpty(prev['العنوان'], r['العنوان']);
        prev['المحافظة'] = firstNonEmpty(prev['المحافظة'], r['المحافظة']);
        prev['المنتجات'] = [prev['المنتجات'], r['المنتجات']].filter(Boolean).join(' + ');
        prev['عدد القطع'] = (prev['عدد القطع']||0) + (r['عدد القطع']||0);
        prev['التوتال'] = (prev['التوتال']||0) + (r['التوتال']||0);
        prev['ملاحظات الشحن'] = firstNonEmpty(prev['ملاحظات الشحن'], r['ملاحظات الشحن']);
        map.set(key, prev);
      }
    }
    return Array.from(map.values());
  }
  return out;
}

function buildMessages(rows){
  return rows.map(r=>{
    const fname = firstArabicToken(r['الاسم']);
    const mobile = normalizeEgMobile(r['رقم الهاتف']);
    const text = `السلام عليكم استاذه ${fname} معاكي نعمه من شركة سحر (${mobile})`;
    return {'الاسم': r['الاسم'], 'الاسم الأول': fname, 'رقم الهاتف': mobile, 'رسالة قيد تنفيذ': text};
  });
}

// ---------------- UI Logic ----------------
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const statusBox = document.getElementById('status');
const exportMessages = document.getElementById('exportMessages');

fileInput.addEventListener('change', ()=>{ processBtn.disabled = !fileInput.files.length; status(''); });
processBtn.addEventListener('click', async ()=>{
  try{
    if(!fileInput.files.length) return;
    const file = fileInput.files[0];
    status('جارِ القراءة…');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, {type:'array'});

    // Merge all sheets
    let allRows = [];
    wb.SheetNames.forEach(sn=>{
      const ws = wb.Sheets[sn];
      const json = XLSX.utils.sheet_to_json(ws, {defval:''});
      if(!json.length) return;
      const transformed = transformSheet(json);
      allRows = allRows.concat(transformed);
    });

    status('تم التحويل… يتم التجهيز للتنزيل');

    // Build output workbook
    const outWb = XLSX.utils.book_new();
    const ordersWs = XLSX.utils.json_to_sheet(allRows);
    XLSX.utils.book_append_sheet(outWb, ordersWs, 'الطلبات');

    if(exportMessages.checked){
      const msgs = buildMessages(allRows);
      const msgWs = XLSX.utils.json_to_sheet(msgs);
      XLSX.utils.book_append_sheet(outWb, msgWs, 'Messages');
    }

    const outName = 'تنسيق_محمد_' + file.name.replace(/\s+/g,'_');
    XLSX.writeFile(outWb, outName);
    status('تم التحميل بنجاح ✅');
  }catch(err){
    console.error(err);
    status('حدث خطأ أثناء المعالجة: '+ err.message, true);
  }
});

function status(msg, isErr=false){
  statusBox.textContent = msg;
  statusBox.style.color = isErr? '#c00' : '#0a6';
}
