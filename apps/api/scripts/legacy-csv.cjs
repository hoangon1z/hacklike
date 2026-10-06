'use strict';
const {createHash}=require('node:crypto');
const sha=value=>createHash('sha256').update(value).digest('hex');
function csv(text){
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(!quoted&&cell==='='){
        const end=text.indexOf('"',i+1);
        if(end<0||![';', '\n','\r',undefined].includes(text[end+1]))throw new Error('Invalid Excel text wrapper');
        cell+=text.slice(i,end+1);i=end;continue;
      }
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}
      else if(quoted||cell==='')quoted=!quoted;
      else throw new Error('Invalid CSV quote');
    }else if(!quoted&&c===';'){row.push(cell);cell='';}
    else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quote');
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows;
}
// The legacy exporter wraps number/text cells in Excel's ="..." representation.
function unwrap(value){const s=value.trim();return /^="[^"]*"$/.test(s)?s.slice(2,-1):s;}
function money(value,row,column){const s=unwrap(value);if(!/^\d{1,18}(\.\d{1,2})?$/.test(s))throw new Error(`Row ${row}: invalid ${column}`);return s;}
function parseLegacy(text){
  const table=csv(text),headers=['Tên đăng nhập','Email','Chức vụ','SDT','Số dư','Tổng nạp','Ngày tạo'];
  if(JSON.stringify(table.shift())!==JSON.stringify(headers))throw new Error('Unexpected CSV headers or delimiter (expected semicolon)');
  if(!table.length||table.length>10000)throw new Error('Invalid record count');
  const emails=new Set();
  return table.map((cells,i)=>{
    const n=i+2;if(cells.length!==headers.length)throw new Error(`Row ${n}: wrong column count`);
    const [name,mail,role,phone,balance,total,date]=cells.map(unwrap);
    const email=mail.toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error(`Row ${n}: invalid email`);
    if(emails.has(email))throw new Error(`Row ${n}: duplicate email`);emails.add(email);
    if(!name||name.length>80||phone.length>80)throw new Error(`Row ${n}: invalid name/phone`);
    if(role!=='Thành Viên')throw new Error(`Row ${n}: unexpected role; no automatic admin promotion`);
    if(!/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(date))throw new Error(`Row ${n}: invalid date`);
    const iso=date.slice(0,10).replaceAll('/','-')+'T'+date.slice(11)+'+07:00';
    const createdAt=new Date(iso);
    if(!Number.isFinite(createdAt.getTime())||new Date(createdAt.getTime()+7*3600000).toISOString().slice(0,19)!==iso.slice(0,19)||createdAt>new Date())throw new Error(`Row ${n}: invalid/future date`);
    const record={email,legacyUsername:name,phone:phone||null,openingBalance:money(balance,n,'balance'),historicalDeposited:money(total,n,'total deposits'),legacyCreatedAt:createdAt};
    return {...record,rowHash:sha(JSON.stringify(record)),line:n};
  });
}
module.exports={parseLegacy,sha};
